import React, { useEffect, useRef, useState } from 'react';
import { AlertModal } from './AlertModal';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import osmtogeojson from 'osmtogeojson';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { fetchNeighborhoods } from '../api/overpass';
import { useAppStore } from '../store/useAppStore';

// Fix Leaflet's default icon paths for Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Fix Leaflet-Draw "type is not defined" ReferenceError in ES modules/strict mode
const defaultPrecision = { km: 2, ha: 2, m: 0, mi: 2, ac: 2, yd: 0, ft: 0, nm: 2 };
if (L.GeometryUtil) {
  (L.GeometryUtil as any).readableArea = function (area: number, isMetric?: any, precision?: any): string {
    const p = L.Util.extend({}, defaultPrecision, precision);
    let areaStr: string;

    if (isMetric) {
      let units = ['ha', 'm'];
      const type = typeof isMetric;
      if (type === 'string') units = [isMetric];
      else if (type !== 'boolean') units = isMetric;

      if (area >= 1000000 && units.indexOf('km') !== -1) {
        areaStr = L.GeometryUtil.formattedNumber((area * 0.000001) as any, p.km) + ' km²';
      } else if (area >= 10000 && units.indexOf('ha') !== -1) {
        areaStr = L.GeometryUtil.formattedNumber((area * 0.0001) as any, p.ha) + ' ha';
      } else {
        areaStr = L.GeometryUtil.formattedNumber(area as any, p.m) + ' m²';
      }
    } else {
      const areaYards = area / 0.836127;
      if (areaYards >= 3097600) {
        areaStr = L.GeometryUtil.formattedNumber((areaYards / 3097600) as any, p.mi) + ' mi²';
      } else if (areaYards >= 4840) {
        areaStr = L.GeometryUtil.formattedNumber((areaYards / 4840) as any, p.ac) + ' acres';
      } else {
        areaStr = L.GeometryUtil.formattedNumber(areaYards as any, p.yd) + ' yd²';
      }
    }
    return areaStr;
  };
}

const MAX_AREA_KM2 = 4;

interface Props {
  onPolygonDrawn: (bounds: any, neighborhoodName: string | null) => void;
  onPolygonDeleted: () => void;
  setGlobalLoader: (loading: boolean, title?: string, sub?: string) => void;
  currentPolylineData: { lat: number, lng: number }[];
  isPreviewing: boolean;
  onPreviewFinished: () => void;
  isSharedView: boolean;
  isDoneMode: boolean;
  stravaPaths?: any;
  showStravaPaths?: boolean;
}

export const MapContainer: React.FC<Props> = ({ 
  onPolygonDrawn, 
  onPolygonDeleted, 
  setGlobalLoader,
  currentPolylineData,
  isPreviewing,
  onPreviewFinished,
  isSharedView,
  isDoneMode,
  stravaPaths,
  showStravaPaths
}) => {
  const { t, i18n } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  // AlertModal state — lifted above Leaflet event scope so it can trigger a React re-render
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  const stravaOpacity = useAppStore(state => state.stravaOpacity);
  const stravaColor = useAppStore(state => state.stravaColor);

  const neighborhoodsMutation = useMutation({ mutationFn: fetchNeighborhoods });
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const animPolylineRef = useRef<L.Polyline | null>(null);
  const animMarkerRef = useRef<L.CircleMarker | null>(null);
  const animReqIdRef = useRef<number | null>(null);
  const stravaLayerRef = useRef<L.GeoJSON | null>(null);
  const stravaRendererRef = useRef<L.Canvas | null>(null);

  // Update Leaflet Draw Localization on language change
  useEffect(() => {
    L.drawLocal.draw.toolbar.actions.title = t('draw.cancel');
    L.drawLocal.draw.toolbar.actions.text = t('draw.cancel');
    L.drawLocal.draw.toolbar.finish.title = t('draw.finish');
    L.drawLocal.draw.toolbar.finish.text = t('draw.finish');
    L.drawLocal.draw.toolbar.undo.title = t('draw.deleteLastPoint');
    L.drawLocal.draw.toolbar.undo.text = t('draw.deleteLastPoint');
    L.drawLocal.draw.toolbar.buttons.polygon = t('draw.drawPolygon');
    
    L.drawLocal.draw.handlers.polygon.tooltip.start = t('draw.clickToStart');
    L.drawLocal.draw.handlers.polygon.tooltip.cont = t('draw.clickToContinue');
    L.drawLocal.draw.handlers.polygon.tooltip.end = t('draw.clickToEnd');

    // Manually update the draw button title if it exists
    const polyBtn = document.querySelector('.leaflet-draw-draw-polygon');
    if (polyBtn) polyBtn.setAttribute('title', t('draw.drawPolygon'));
  }, [i18n.language, t]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const isMobile = window.innerWidth < 768;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([41.3874, 2.1686], 16);
    mapInstance.current = map;
    (window as any).map = map;
    (window as any).L = L;

    L.control.zoom({ position: isMobile ? 'topright' : 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Locate Control
    const LocateControl = L.Control.extend({
      options: { position: isMobile ? 'topright' : 'bottomright' },
      onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        container.style.backgroundColor = 'white';
        container.style.width = '34px';
        container.style.height = '34px';
        container.style.cursor = 'pointer';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.title = 'Minha Localização (GPS)';

        container.innerHTML = `<img src="/icons/gps-locate.svg" width="16" height="16" alt="Locate me" />`;

        container.onclick = function (e: Event) {
          e.stopPropagation();
          map.locate({ setView: true, maxZoom: 16 });
        }
        return container;
      }
    });
    map.addControl(new LocateControl());

    let userMarker: L.CircleMarker | null = null;
    map.on('locationfound', (e: L.LocationEvent) => {
      if (!userMarker) {
        userMarker = L.circleMarker(e.latlng, {
          radius: 8, color: '#ffffff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1
        }).addTo(map);
      } else {
        userMarker.setLatLng(e.latlng);
      }
    });

    const drawnItems = new L.FeatureGroup();
    drawnItemsRef.current = drawnItems;
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: false,
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e1e100',
            message: '<strong>Ops!<strong> Você não pode cruzar as linhas do polígono!'
          },
          shapeOptions: { color: '#1f2937', weight: 2, dashArray: '5, 5', fillOpacity: 0.2 }
        },
        circle: false, rectangle: false, circlemarker: false, marker: false
      },
      edit: { featureGroup: drawnItems, remove: true }
    });
    
    // Defer the toolbar attachment until the DOM container is ready
    setTimeout(() => {
      const drawToolsContainer = document.getElementById('draw-tools-container');
      if (drawToolsContainer && !isSharedView) {
        map.addControl(drawControl);
        drawToolsContainer.appendChild(drawControl.getContainer() as Node);

        // Magic Wand
        const magicWandControl = L.DomUtil.create('div', 'leaflet-control leaflet-draw');
        const magicWandToolbar = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar', magicWandControl);
        const magicWandBtn = L.DomUtil.create('a', 'leaflet-draw-draw-polygon', magicWandToolbar);
        magicWandBtn.href = '#';
        magicWandBtn.title = 'Magic Wand: Select Neighborhood';
        magicWandBtn.style.backgroundImage = 'none';
        magicWandBtn.style.display = 'flex';
        magicWandBtn.style.alignItems = 'center';
        magicWandBtn.style.justifyContent = 'center';
        magicWandBtn.innerHTML = `<img src="/icons/magic-wand.svg" width="16" height="16" alt="Magic Wand" />`;
        drawToolsContainer.appendChild(magicWandControl);

        let activeNeighborhoodLayer: L.GeoJSON | null = null;
        let isLoadingNeighborhoods = false;
        let isMagicWandActive = false;

        const disableMagicWand = () => {
          isMagicWandActive = false;
          magicWandBtn.style.backgroundColor = '';
          if (activeNeighborhoodLayer) {
            map.removeLayer(activeNeighborhoodLayer);
            activeNeighborhoodLayer = null;
          }
        };

        const loadNeighborhoods = async () => {
          if (isLoadingNeighborhoods || !isMagicWandActive) return;
          isLoadingNeighborhoods = true;
          setGlobalLoader(true, t('neighborhood.searching'), t('neighborhood.fetching'));

          try {
            const bounds = map.getBounds();
            const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

            const data = await neighborhoodsMutation.mutateAsync(bbox);
            
            if (activeNeighborhoodLayer) {
              map.removeLayer(activeNeighborhoodLayer);
              activeNeighborhoodLayer = null;
            }

            if (!isMagicWandActive) return; // In case it was disabled while fetching

            if (!data.elements || data.elements.length === 0) {
              return; // Do nothing if no neighborhoods are found, allowing user to pan further
            }

            const geojson = osmtogeojson(data);
            activeNeighborhoodLayer = L.geoJSON(geojson, {
              style: { color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.2, dashArray: '5, 5' },
              filter: (feature) => feature.geometry.type !== 'Point' && feature.geometry.type !== 'MultiPoint',
              onEachFeature: (feature, layer) => {
                const name = feature?.properties?.name || feature?.properties?.tags?.name || feature?.properties?.['name:en'] || null;
                if (name) {
                  layer.bindTooltip(name, { className: 'custom-black-tooltip', sticky: true, direction: 'top', offset: [0, -10] });
                }
                layer.on('mouseover', function () {
                  if (layer instanceof L.Path) layer.setStyle({ fillOpacity: 0.5, weight: 3 });
                });
                layer.on('mouseout', function () {
                  activeNeighborhoodLayer!.resetStyle(layer as L.Path);
                });
                layer.on('click', function () {
                  drawnItems.clearLayers();
                  const clickedLayer = layer as any;
                  clickedLayer.setStyle({ color: '#1f2937', weight: 2, dashArray: '5, 5', fillOpacity: 0.2 });

                  let latlngs: any[] = clickedLayer.getLatLngs();
                  while (latlngs.length > 0 && Array.isArray(latlngs[0])) {
                    latlngs = latlngs.reduce((prev, current) => (prev.length > current.length) ? prev : current);
                  }

                  const mappedBounds = latlngs.map((ll: any) => ({ lat: ll.lat, lng: ll.lng }));
                  const newPolygon = L.polygon(latlngs, clickedLayer.options);
                  drawnItems.addLayer(newPolygon);

                  onPolygonDrawn(mappedBounds, name);
                  disableMagicWand();
                });
              }
            }).addTo(map);
          } catch (error) {
            console.error(error);
          } finally {
            isLoadingNeighborhoods = false;
            setGlobalLoader(false);
          }
        };

        map.on('moveend', () => {
          if (isMagicWandActive) {
            loadNeighborhoods();
          }
        });

        magicWandBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (isMagicWandActive) {
            disableMagicWand();
          } else {
            isMagicWandActive = true;
            magicWandBtn.style.backgroundColor = '#e5e7eb';
            
            // Disable draw tool if it's active
            // @ts-ignore
            if (drawControl._toolbars && drawControl._toolbars.draw && drawControl._toolbars.draw._activeMode) {
              // @ts-ignore
              drawControl._toolbars.draw._activeMode.handler.disable();
            }

            await loadNeighborhoods();
          }
        };

        map.on(L.Draw.Event.DRAWSTART, () => {
          disableMagicWand();
        });


      }
    }, 100);

    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layerType = e.layerType;
      if (layerType === 'polygon') {
        drawnItems.clearLayers();
        const layer = e.layer as L.Polygon;
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        const areaM2 = L.GeometryUtil.geodesicArea(latlngs);
        const areaKm2 = areaM2 / 1_000_000;

        if (areaKm2 > MAX_AREA_KM2) {
          setAlertMessage(t('map.polygonTooLarge', { areaKm2: areaKm2.toFixed(2), maxArea: MAX_AREA_KM2 }));
          setIsAlertOpen(true);
          return;
        }

        drawnItems.addLayer(layer);
        const bounds = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
        onPolygonDrawn(bounds, null);
      }
    });

    map.on(L.Draw.Event.EDITED, (e: any) => {
      e.layers.eachLayer((layer: any) => {
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        const areaM2 = L.GeometryUtil.geodesicArea(latlngs);
        const areaKm2 = areaM2 / 1_000_000;
        if (areaKm2 > MAX_AREA_KM2) {
          setAlertMessage(t('map.polygonEditedTooLarge'));
          setIsAlertOpen(true);
          drawnItems.clearLayers();
          onPolygonDeleted();
        } else {
          const bounds = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
          // Note: using null for neighborhood name on manual edits
          onPolygonDrawn(bounds, null);
        }
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      onPolygonDeleted();
    });

  }, []);

  // Handle currentPathData updates (Drawing the route polyline)
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    if (pathLayerRef.current) {
      map.removeLayer(pathLayerRef.current);
      pathLayerRef.current = null;
    }

    if (currentPolylineData.length > 0) {
      const latlngs = currentPolylineData.map(p => [p.lat, p.lng] as [number, number]);
      pathLayerRef.current = L.polyline(latlngs, {
        color: '#ef4444',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);

      if (isSharedView) {
        pathLayerRef.current.setStyle({ color: '#10b981', weight: 6 }); // Green for shared
      }

      map.fitBounds(pathLayerRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [currentPolylineData, isSharedView]);

  // Handle Done mode logic (clearing map)
  useEffect(() => {
    if (!isDoneMode && !isSharedView) {
      if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();
      if (pathLayerRef.current) {
        mapInstance.current?.removeLayer(pathLayerRef.current);
        pathLayerRef.current = null;
      }
      if (animReqIdRef.current !== null) {
        cancelAnimationFrame(animReqIdRef.current);
        animReqIdRef.current = null;
        if (animPolylineRef.current) mapInstance.current?.removeLayer(animPolylineRef.current);
        if (animMarkerRef.current) mapInstance.current?.removeLayer(animMarkerRef.current);
      }
    }
  }, [isDoneMode, isSharedView]);

  // Handle Animation Preview
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (!isPreviewing) {
      if (animReqIdRef.current !== null) {
        cancelAnimationFrame(animReqIdRef.current);
        animReqIdRef.current = null;
      }
      if (animPolylineRef.current) map.removeLayer(animPolylineRef.current);
      if (animMarkerRef.current) map.removeLayer(animMarkerRef.current);
      if (pathLayerRef.current) pathLayerRef.current.setStyle({ opacity: 0.8 });
      return;
    }

    if (currentPolylineData.length === 0) return;

    if (pathLayerRef.current) pathLayerRef.current.setStyle({ opacity: 0.2 });

    animPolylineRef.current = L.polyline([], {
      color: '#ef4444', weight: 5, opacity: 1, lineJoin: 'round'
    }).addTo(map);

    animMarkerRef.current = L.circleMarker(currentPolylineData[0], {
      color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 1, radius: 6, weight: 2
    }).addTo(map);

    let startTime: number | null = null;
    const duration = 10000;
    const totalPoints = currentPolylineData.length;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / duration;

      if (progress >= 1) {
        animPolylineRef.current?.setLatLngs(currentPolylineData);
        animReqIdRef.current = null;
        if (pathLayerRef.current) pathLayerRef.current.setStyle({ opacity: 0.8 });
        if (animMarkerRef.current) map.removeLayer(animMarkerRef.current);
        onPreviewFinished();
        return;
      }

      const targetIndex = Math.floor(progress * totalPoints);
      animPolylineRef.current?.setLatLngs(currentPolylineData.slice(0, targetIndex + 1));
      animMarkerRef.current?.setLatLng(currentPolylineData[targetIndex]);

      animReqIdRef.current = requestAnimationFrame(animate);
    };

    animReqIdRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount or when previewing changes
    return () => {
      if (animReqIdRef.current !== null) {
        cancelAnimationFrame(animReqIdRef.current);
        animReqIdRef.current = null;
      }
    };
  }, [isPreviewing, currentPolylineData, onPreviewFinished]);

  // Handle Strava Paths rendering
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Remove old layer
    if (stravaLayerRef.current) {
      map.removeLayer(stravaLayerRef.current);
      stravaLayerRef.current = null;
    }

    // Render new layer if we should show them and data exists
    if (showStravaPaths && stravaPaths && stravaPaths.features) {
      if (!stravaRendererRef.current) {
        stravaRendererRef.current = L.canvas({ pane: 'overlayPane' });
      }

      stravaLayerRef.current = L.geoJSON(stravaPaths, {
        renderer: stravaRendererRef.current,
        style: {
          color: stravaColor,
          weight: 3,
          opacity: 1, // We draw at full opacity to avoid overlapping line darkness
          lineJoin: 'round'
        }
      } as any).addTo(map);

      // Apply the user's selected opacity to the entire canvas container
      const container = (stravaRendererRef.current as any)._container as HTMLElement;
      if (container) {
        container.style.opacity = stravaOpacity.toString();
        // Use CSS mix-blend-mode for a cleaner look if desired, e.g. container.style.mixBlendMode = 'multiply';
      }
    }
  }, [stravaPaths, showStravaPaths]); // intentional: don't re-render entire layer when only color/opacity changes

  // Update Strava styles dynamically
  useEffect(() => {
    if (stravaLayerRef.current) {
      stravaLayerRef.current.setStyle({
        color: stravaColor,
        opacity: 1 // Keep paths fully opaque
      });
    }
    if (stravaRendererRef.current) {
      const container = (stravaRendererRef.current as any)._container as HTMLElement;
      if (container) {
        container.style.opacity = stravaOpacity.toString();
      }
    }
  }, [stravaColor, stravaOpacity]);

  return (
    <>
      <div className="absolute inset-0 z-0 pointer-events-auto" ref={mapRef} id="map-container" />
      <AlertModal
        isOpen={isAlertOpen}
        title={t('map.areaLimitTitle')}
        message={alertMessage}
        onClose={() => setIsAlertOpen(false)}
      />
    </>
  );
};
