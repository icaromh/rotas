import L from 'leaflet';

export interface FogOverlayOptions extends L.LayerOptions {
  fogColor?: string;
  fogOpacity?: number;
  fogBrushSize?: number;
  padding?: number;
}

/**
 * FogOverlayLayer — A custom Leaflet layer that renders a "Fog of War" overlay.
 *
 * This implementation mirrors L.Renderer's zoom-animation pipeline:
 *   1. On `zoomanim`, the *existing* canvas pixels are CSS-transformed (scale + translate)
 *      so they stay perfectly in sync with the tile zoom animation — zero redraws.
 *   2. On `moveend` (fires after zoom/pan completes), a single full redraw occurs
 *      using `latLngToLayerPoint` in the Leaflet layer-coordinate system.
 *   3. Retina / HiDPI displays are handled by doubling the canvas buffer and scaling ctx.
 *
 * Performance characteristics:
 *   - Coordinates are pre-converted to L.LatLng once on data load (avoids GC churn).
 *   - A single batched `ctx.beginPath()` + `ctx.stroke()` call draws all paths.
 *   - The canvas is padded beyond the viewport so short pans don't trigger redraws.
 */
export const FogOverlayLayer = L.Layer.extend({
  options: {
    padding: 0.1,
    fogColor: '#000000',
    fogOpacity: 0.8,
    fogBrushSize: 15,
  },

  initialize: function (geojsonData: any, options?: FogOverlayOptions) {
    this._geojsonData = geojsonData;
    this._paths = []; // L.LatLng[][]
    L.setOptions(this, options);
    this._preprocessPaths();
  },

  /** Convert GeoJSON coordinates to L.LatLng arrays once so we avoid repeated object creation. */
  _preprocessPaths: function () {
    this._paths = [];
    if (!this._geojsonData?.features) return;
    for (const feature of this._geojsonData.features) {
      if (feature.geometry?.type === 'LineString') {
        const latlngs = feature.geometry.coordinates.map(
          (c: number[]) => L.latLng(c[1], c[0])
        );
        if (latlngs.length > 0) this._paths.push(latlngs);
      }
    }
  },

  onAdd: function (map: L.Map) {
    this._map = map;

    this._canvas = document.createElement('canvas');
    this._canvas.style.pointerEvents = 'none';
    this._ctx = this._canvas.getContext('2d')!;

    // Attach to Leaflet's overlayPane — the same pane used by L.Canvas renderer
    const pane = this.getPane();
    if (pane) pane.appendChild(this._canvas);

    // Mirror L.Renderer event bindings
    map.on('zoomanim', this._onAnimZoom, this);
    map.on('zoom', this._onZoom, this);
    map.on('moveend', this._update, this);
    map.on('resize', this._update, this);

    this._update();
    return this;
  },

  onRemove: function (map: L.Map) {
    if (this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    map.off('zoomanim', this._onAnimZoom, this);
    map.off('zoom', this._onZoom, this);
    map.off('moveend', this._update, this);
    map.off('resize', this._update, this);
    return this;
  },

  // ────────────────────────────────────────────────────
  // Zoom-animation sync  (identical to L.Renderer)
  // ────────────────────────────────────────────────────

  /** During animated zoom: CSS-transform the existing raster — no canvas redraw. */
  _onAnimZoom: function (ev: any) {
    this._updateTransform(ev.center, ev.zoom);
  },

  /** During non-animated / programmatic zoom: also CSS-transform. */
  _onZoom: function () {
    this._updateTransform(this._map.getCenter(), this._map.getZoom());
  },

  /**
   * Replicates L.Renderer._updateTransform:
   * Calculates the CSS scale+translate needed to warp the canvas from the
   * stored (_center, _zoom) to the new (center, zoom) during animation.
   */
  _updateTransform: function (center: L.LatLng, zoom: number) {
    const scale = this._map.getZoomScale(zoom, this._zoom);
    const viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding);
    const currentCenterPoint = this._map.project(this._center, zoom);
    const topLeftOffset = viewHalf
      .multiplyBy(-1)
      .add(currentCenterPoint)
      .subtract((this._map as any)._getNewPixelOrigin(center, zoom));

    if (L.Browser.any3d) {
      L.DomUtil.setTransform(this._canvas, topLeftOffset, scale);
    } else {
      L.DomUtil.setPosition(this._canvas, topLeftOffset);
    }
  },

  // ────────────────────────────────────────────────────
  // Full redraw  (runs once after zoom / pan completes)
  // ────────────────────────────────────────────────────

  _update: function () {
    if (!this._map) return;
    // Skip if a zoom animation is in flight — the CSS transform handles it
    if ((this._map as any)._animatingZoom && this._bounds) return;

    const p = this.options.padding;
    const size = this._map.getSize();
    const min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();
    const bounds = new L.Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());

    this._bounds = bounds;
    this._center = this._map.getCenter();
    this._zoom = this._map.getZoom();

    const bSize = bounds.getSize();
    const retina = L.Browser.retina ? 2 : 1;

    // Position canvas element at bounds origin
    L.DomUtil.setPosition(this._canvas, bounds.min!);

    // Size the backing buffer (retina-aware)
    this._canvas.width = retina * bSize.x;
    this._canvas.height = retina * bSize.y;
    this._canvas.style.width = bSize.x + 'px';
    this._canvas.style.height = bSize.y + 'px';

    const ctx = this._ctx;
    if (L.Browser.retina) {
      ctx.scale(2, 2);
    }

    // Translate canvas so latLngToLayerPoint coordinates map directly to pixels
    ctx.translate(-bounds.min!.x, -bounds.min!.y);

    this._redraw();
  },

  _redraw: function () {
    const ctx = this._ctx;
    const bounds = this._bounds;
    if (!bounds) return;

    const min = bounds.min!;
    const bSize = bounds.getSize();

    // 1. Fill fog (in layer-coordinate space)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.options.fogColor;
    ctx.globalAlpha = this.options.fogOpacity;
    ctx.fillRect(min.x, min.y, bSize.x, bSize.y);

    if (this._paths.length === 0) return;

    // 2. Cut out explored paths
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = this.options.fogBrushSize;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();

    for (const path of this._paths) {
      const first = this._map.latLngToLayerPoint(path[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < path.length; i++) {
        const pt = this._map.latLngToLayerPoint(path[i]);
        ctx.lineTo(pt.x, pt.y);
      }
    }

    ctx.stroke();
  },

  // ────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────

  setGeoJSON: function (geojsonData: any) {
    this._geojsonData = geojsonData;
    this._preprocessPaths();
    if (this._map) this._update();
  },

  setOptions: function (options: FogOverlayOptions) {
    L.setOptions(this, options);
    if (this._map) this._update();
  },
});
