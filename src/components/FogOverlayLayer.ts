import L from 'leaflet';

export interface FogOverlayOptions extends L.LayerOptions {
  fogColor?: string;
  fogOpacity?: number;
  fogBrushSize?: number;
}

export const FogOverlayLayer = L.Layer.extend({
  initialize: function (geojsonData: any, options: FogOverlayOptions) {
    this._geojsonData = geojsonData;
    L.setOptions(this, options);
  },

  onAdd: function (map: L.Map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'leaflet-fog-layer leaflet-zoom-animated');
    this._ctx = this._canvas.getContext('2d');

    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;

    map.getPanes().overlayPane.appendChild(this._canvas);

    map.on('move', this._redraw, this); // Redraw continuously during pan for smooth experience, canvas is fast enough.
    map.on('zoom', this._redraw, this);
    map.on('resize', this._resize, this);

    this._redraw();
  },

  onRemove: function (map: L.Map) {
    L.DomUtil.remove(this._canvas);
    map.off('move', this._redraw, this);
    map.off('zoom', this._redraw, this);
    map.off('resize', this._resize, this);
  },

  setGeoJSON: function(geojsonData: any) {
    this._geojsonData = geojsonData;
    this._redraw();
  },

  setOptions: function(options: FogOverlayOptions) {
    L.setOptions(this, options);
    this._redraw();
  },

  _resize: function () {
    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    this._redraw();
  },

  _redraw: function () {
    if (!this._map || !this._ctx) return;
    
    const size = this._map.getSize();
    // Position the canvas at the top-left of the current viewport
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    const ctx = this._ctx;
    ctx.clearRect(0, 0, size.x, size.y);

    // Draw fog
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.options.fogColor || '#000000';
    ctx.globalAlpha = this.options.fogOpacity !== undefined ? this.options.fogOpacity : 0.8;
    ctx.fillRect(0, 0, size.x, size.y);

    if (!this._geojsonData || !this._geojsonData.features) return;

    // Erase paths
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = this.options.fogBrushSize || 15;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    
    // Convert paths
    for (const feature of this._geojsonData.features) {
      if (feature.geometry && feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates;
        let isFirst = true;
        for (let i = 0; i < coords.length; i++) {
          const pt = this._map.latLngToContainerPoint([coords[i][1], coords[i][0]]);
          if (isFirst) {
            ctx.moveTo(pt.x, pt.y);
            isFirst = false;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
    }

    ctx.stroke();
  }
});
