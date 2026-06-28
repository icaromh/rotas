import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import osmtogeojson from 'osmtogeojson';
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
}

export const MapContainer: React.FC<Props> = ({ 
  onPolygonDrawn, 
  onPolygonDeleted, 
  setGlobalLoader,
  currentPolylineData,
  isPreviewing,
  onPreviewFinished
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const animPolylineRef = useRef<L.Polyline | null>(null);
  const animMarkerRef = useRef<L.CircleMarker | null>(null);
  const animReqIdRef = useRef<number | null>(null);

  const isSharedView = useAppStore(state => state.isSharedView);
  const isDoneMode = useAppStore(state => state.isDoneMode);

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

        container.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M8 13A5 5 0 1 1 8 3a5 5 0 0 1 0 10zm0 1A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"/>
            <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
            <path d="M8 1.5a.5.5 0 0 1 .5-.5h1V0H6.5v1h1a.5.5 0 0 1 .5.5v1H8v-1zM1.5 8a.5.5 0 0 1-.5.5v1H0V6.5h1v1a.5.5 0 0 1 .5.5H3V8H1.5zM16 8h-1.5v-.5H16v1h-1.5v-.5H16zm-8 8v-1.5h-.5V16h1v-1.5H8V16z"/>
          </svg>
        `;

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
        magicWandBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/>
            <path d="m14 7 3 3"/>
            <path d="M5 6v4"/>
            <path d="M19 14v4"/>
            <path d="M10 2v2"/>
            <path d="M7 8H3"/>
            <path d="M21 16h-4"/>
            <path d="M11 3H9"/>
          </svg>
        `;
        drawToolsContainer.appendChild(magicWandControl);

        let activeNeighborhoodLayer: L.GeoJSON | null = null;
        let isLoadingNeighborhoods = false;

        magicWandBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (isLoadingNeighborhoods) return;
          if (activeNeighborhoodLayer) {
            map.removeLayer(activeNeighborhoodLayer);
            activeNeighborhoodLayer = null;
            magicWandBtn.style.backgroundColor = '';
            return;
          }

          isLoadingNeighborhoods = true;
          setGlobalLoader(true, 'Searching Neighborhoods', 'Fetching boundaries from OpenStreetMap...');

          try {
            const bounds = map.getBounds();
            const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
            const query = `
              [out:json][timeout:25];
              (
                relation["admin_level"~"9|10"](${bbox});
                relation["place"~"neighbourhood|suburb"](${bbox});
              );
              out geom;
            `;

            const cacheKeyUrl = 'https://rotas-overpass-proxy.icaro-mh.workers.dev/api/interpreter?bbox=' + encodeURIComponent(bbox);
            const cache = await caches.open('rotas-neighborhoods-cache');
            let res = await cache.match(cacheKeyUrl);

            if (!res) {
              res = await fetch('https://rotas-overpass-proxy.icaro-mh.workers.dev/api/interpreter', {
                method: 'POST',
                body: 'data=' + encodeURIComponent(query)
              });
              if (res.ok) await cache.put(cacheKeyUrl, res.clone());
            }

            const data = await res.json();
            if (!data.elements || data.elements.length === 0) {
              alert('No neighborhoods found in this area. Try moving or zooming out the map.');
              return;
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

                  map.removeLayer(activeNeighborhoodLayer!);
                  activeNeighborhoodLayer = null;
                  magicWandBtn.style.backgroundColor = '';
                });
              }
            }).addTo(map);

            magicWandBtn.style.backgroundColor = '#e5e7eb';
          } catch (error) {
            console.error(error);
            alert('Failed to load neighborhoods from OpenStreetMap.');
          } finally {
            isLoadingNeighborhoods = false;
            setGlobalLoader(false);
          }
        };
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
          alert(`O polígono possui ${areaKm2.toFixed(2)} km², excedendo o limite de ${MAX_AREA_KM2} km². Desenhe uma área menor.`);
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
          alert(`O polígono editado possui ${areaKm2.toFixed(2)} km², excedendo o limite. Seleção cancelada.`);
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

  return <div className="absolute inset-0 z-0 pointer-events-auto" ref={mapRef} id="map-container"></div>;
};
