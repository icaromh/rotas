import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import './style.css';
import L from 'leaflet';
import 'leaflet-draw';
import osmtogeojson from 'osmtogeojson';
import { encodeRoute, decodeRoute } from './utils/routeSharing';

// Fix Leaflet-Draw "type is not defined" ReferenceError in ES modules/strict mode
const defaultPrecision = {
  km: 2,
  ha: 2,
  m: 0,
  mi: 2,
  ac: 2,
  yd: 0,
  ft: 0,
  nm: 2
};

if (L.GeometryUtil) {
  L.GeometryUtil.readableArea = function (area: number, isMetric?: any, precision?: any): string {
    const p = L.Util.extend({}, defaultPrecision, precision);
    let areaStr: string;

    if (isMetric) {
      let units = ['ha', 'm'];
      const type = typeof isMetric;
      if (type === 'string') {
        units = [isMetric];
      } else if (type !== 'boolean') {
        units = isMetric;
      }

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

import OptimizerWorker from './workers/optimizer.worker?worker';

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

const MAX_AREA_KM2 = 4;

function generateGPX(path: { lat: number, lng: number }[]): string {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Otimizador GPS" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Rota Otimizada</name>
    <trkseg>
`;
  for (const pt of path) {
    gpx += `      <trkpt lat="${pt.lat}" lon="${pt.lng}"></trkpt>\n`;
  }
  gpx += `    </trkseg>
  </trk>
</gpx>`;
  return gpx;
}

document.addEventListener('DOMContentLoaded', () => {
  const sportSelect = document.getElementById('sport-select') as HTMLSelectElement;
  const sportSelectMobile = document.getElementById('sport-select-mobile') as HTMLSelectElement;
  const SPEED_BIKE = 17;  // km/h
  const PACE_WALK = 10;   // min/km
  const sidebar = document.getElementById('sidebar') as HTMLElement;
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
  const mobileGenerateBtn = document.getElementById('mobile-generate-btn') as HTMLButtonElement;
  const resultsPanel = document.getElementById('results-panel') as HTMLDivElement;
  const resultDistance = document.getElementById('result-distance') as HTMLDivElement;
  const resultTime = document.getElementById('result-time') as HTMLDivElement;
  const exportBtn = document.getElementById('export-gpx-btn') as HTMLButtonElement;
  const previewBtn = document.getElementById('preview-btn') as HTMLButtonElement;
  const shareBtn = document.getElementById('share-btn') as HTMLButtonElement;
  const creatorPanel = document.getElementById('creator-panel') as HTMLDivElement;
  const sharedNotice = document.getElementById('shared-notice') as HTMLDivElement;
  const actionsFooter = document.getElementById('actions-footer') as HTMLDivElement;

  // State
  let currentBounds: any = null; // Used to hold L.LatLngBounds or an array of LatLng objects
  let currentNeighborhoodName: string | null = null;
  let currentPolyline: L.Polyline | null = null;
  let currentPathData: { lat: number, lng: number }[] = [];
  let currentRawInput: any = null;
  let currentDistanceKm: number = 0;

  // Animation State
  let animPolyline: L.Polyline | null = null;
  let animMarker: L.CircleMarker | null = null;
  let animReqId: number | null = null;
  let isDoneMode = false;

  const desktopTools = document.getElementById('desktop-tools');

  function setDoneMode(done: boolean) {
    isDoneMode = done;
    
    // Ensure button is always enabled when we switch modes
    const mainBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    const mobBtn = document.getElementById('mobile-generate-btn') as HTMLButtonElement;
    if (mainBtn) mainBtn.disabled = false;
    if (mobBtn) mobBtn.disabled = false;

    if (done) {
      desktopTools?.classList.add('hidden');
      creatorPanel?.classList.add('hidden');
      document.getElementById('mobile-sport-dropdown')?.classList.add('hidden');
      
      const refreshIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>`;
      
      generateBtn.innerHTML = `${refreshIcon} New Plan`;
      if (mobileGenerateBtn) mobileGenerateBtn.innerHTML = `${refreshIcon} New Plan`;
    } else {
      desktopTools?.classList.remove('hidden');
      creatorPanel?.classList.remove('hidden');
      document.getElementById('mobile-sport-dropdown')?.classList.remove('hidden');
      
      const planIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>`;
      
      generateBtn.innerHTML = `${planIcon} Plan Route`;
      if (mobileGenerateBtn) mobileGenerateBtn.innerHTML = `${planIcon} Plan Route`;
      
      // Clear Map State
      drawnItems.clearLayers();
      if (currentPolyline) {
        map.removeLayer(currentPolyline);
        currentPolyline = null;
      }
      currentBounds = null;
      currentPathData = [];
      resultsPanel.classList.add('hidden');
      actionsFooter.classList.add('hidden');
      
      const neighborhoodTitle = document.getElementById('neighborhood-title');
      if(neighborhoodTitle) {
        neighborhoodTitle.classList.add('hidden');
        neighborhoodTitle.innerText = '';
      }
      
      // Stop Animation
      if (animReqId !== null) {
        cancelAnimationFrame(animReqId);
        animReqId = null;
        if (animPolyline) map.removeLayer(animPolyline);
        if (animMarker) map.removeLayer(animMarker);
        previewBtn.innerHTML = `
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Preview
        `;
      }
    }
  }

  console.log('[Main] Instanciando Web Worker...');
  const worker = new OptimizerWorker();

  worker.onerror = (err) => {
    console.error('[Main] Erro capturado na thread do Worker:', err);
  };

  // Initialize Map
  const isMobile = window.innerWidth < 768;
  const map = L.map('map-container', { zoomControl: false }).setView([41.3874, 2.1686], 16); // Default to Barcelona
  (window as any).map = map;
  L.control.zoom({ position: isMobile ? 'topright' : 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Check URL for Shared Route
  const urlParams = new URLSearchParams(window.location.search);
  const sharedRouteParam = urlParams.get('route');
  const sharedNameParam = urlParams.get('name');
  const sharedModeParam = urlParams.get('mode');
  const sharedDistanceParam = urlParams.get('distance');
  let isSharedView = false;

  if (sharedRouteParam) {
    const decodedPath = decodeRoute(sharedRouteParam);
    if (decodedPath && decodedPath.length > 0) {
      isSharedView = true;
      currentPathData = decodedPath;

      // Use distance from URL if available (accurate), otherwise fallback to point-to-point calculation
      let distanceKm: number;
      if (sharedDistanceParam) {
        distanceKm = parseFloat(sharedDistanceParam);
      } else {
        let distanceMeters = 0;
        for (let i = 0; i < decodedPath.length - 1; i++) {
          distanceMeters += L.latLng(decodedPath[i].lat, decodedPath[i].lng)
            .distanceTo(L.latLng(decodedPath[i + 1].lat, decodedPath[i + 1].lng));
        }
        distanceKm = distanceMeters / 1000;
      }

      currentDistanceKm = distanceKm;
      resultDistance.innerHTML = `${distanceKm.toFixed(2)} <span class="text-sm font-medium text-gray-500">km</span>`;

      // Calculate and display estimated time dynamically in shared view using shared mode
      const mode = sharedModeParam || 'bike';
      let totalMinutes = 0;
      if (mode === 'bike') {
        totalMinutes = (distanceKm / SPEED_BIKE) * 60;
      } else {
        totalMinutes = distanceKm * PACE_WALK;
      }
      const h = Math.floor(totalMinutes / 60);
      const m = Math.round(totalMinutes % 60);
      if (h > 0) {
        resultTime.innerHTML = `${h}<span class="text-sm font-medium text-gray-500">h</span> ${m}<span class="text-sm font-medium text-gray-500">m</span>`;
      } else {
        resultTime.innerHTML = `${m} <span class="text-sm font-medium text-gray-500">min</span>`;
      }
      resultTime.parentElement!.style.display = 'flex';

      // Update UI panels
      sidebar.classList.remove('hidden');
      resultsPanel.classList.remove('hidden');
      sharedNotice.classList.remove('hidden');
      shareBtn.classList.add('hidden'); // No need to share an already shared route

      // Set to done mode to update buttons and hide creator panel & sport selectors
      setDoneMode(true);

      if (sharedNameParam) {
        const neighborhoodTitle = document.getElementById('neighborhood-title');
        const neighborhoodName = document.getElementById('neighborhood-name');
        if (neighborhoodTitle && neighborhoodName) {
          neighborhoodName.textContent = sharedNameParam;
          neighborhoodTitle.classList.remove('hidden');
          
          if (sharedModeParam) {
            const sportTag = document.getElementById('sport-tag');
            if (sportTag) {
              sportTag.textContent = sharedModeParam === 'bike' ? 'Ride' : 'Walk';
              sportTag.classList.remove('hidden');
            }
          }
        }
      }

      // Show actions footer; in shared view collapse Preview to col-span-1 so it sits beside GPX
      previewBtn.classList.remove('col-span-2');
      actionsFooter.classList.remove('hidden');

      // Draw the polyline
      const latlngs = decodedPath.map(p => [p.lat, p.lng] as [number, number]);
      currentPolyline = L.polyline(latlngs, {
        color: '#10b981', // green-500
        weight: 6,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);

      map.fitBounds(currentPolyline.getBounds(), { padding: [50, 50] });
    }
  }

  // GPS Locate Control
  const LocateControl = L.Control.extend({
    options: { position: isMobile ? 'topright' : 'bottomright' },
    onAdd: function (map: L.Map) {
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
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 1
      }).addTo(map);
    } else {
      userMarker.setLatLng(e.latlng);
    }
  });

  map.on('locationerror', (e: L.ErrorEvent) => {
    alert("Não foi possível acessar sua localização: " + e.message);
  });

  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  if (!isSharedView) {
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: false,
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e1e100', // Color the shape will turn when intersects
            message: '<strong>Ops!<strong> Você não pode cruzar as linhas do polígono!'
          },
          shapeOptions: {
            color: '#1f2937', // dark gray almost black
            weight: 2,
            dashArray: '5, 5',
            fillOpacity: 0.2
          }
        },
        circle: false,
        rectangle: false,
        circlemarker: false,
        marker: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });
    map.addControl(drawControl);

    // Move the generated DOM elements into our custom Flex container
    const drawToolsContainer = document.getElementById('draw-tools-container');
    if (drawToolsContainer) {
      drawToolsContainer.appendChild(drawControl.getContainer() as Node);

      // Create Magic Wand Tool
      const magicWandControl = L.DomUtil.create('div', 'leaflet-control leaflet-draw');
      const magicWandToolbar = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar', magicWandControl);
      const magicWandBtn = L.DomUtil.create('a', 'leaflet-draw-draw-polygon', magicWandToolbar);
      magicWandBtn.href = '#';
      magicWandBtn.title = 'Magic Wand: Select Neighborhood';
      magicWandBtn.style.backgroundImage = 'none';
      magicWandBtn.style.display = 'flex';
      magicWandBtn.style.alignItems = 'center';
      magicWandBtn.style.justifyContent = 'center';

      const defaultWandIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      const loadingSpinner = `
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      `;

      magicWandBtn.innerHTML = defaultWandIcon;
      drawToolsContainer.appendChild(magicWandControl);

      let activeNeighborhoodLayer: L.GeoJSON | null = null;
      let isLoadingNeighborhoods = false;

      magicWandBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isLoadingNeighborhoods) return;

        // Toggle Off
        if (activeNeighborhoodLayer) {
          map.removeLayer(activeNeighborhoodLayer);
          activeNeighborhoodLayer = null;
          magicWandBtn.style.backgroundColor = '';
          return;
        }

        isLoadingNeighborhoods = true;
        magicWandBtn.innerHTML = loadingSpinner;

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

          const res = await fetch('https://rotas-overpass-proxy.icaro-mh.workers.dev/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query)
          });
          const data = await res.json();

          if (!data.elements || data.elements.length === 0) {
            alert('No neighborhoods found in this area. Try moving or zooming out the map.');
            return;
          }

          const geojson = osmtogeojson(data);

          activeNeighborhoodLayer = L.geoJSON(geojson, {
            style: {
              color: '#10b981', // Emerald outline
              weight: 2,
              fillColor: '#10b981',
              fillOpacity: 0.2,
              dashArray: '5, 5'
            },
            filter: (feature) => {
              // Hide POI markers, we only care about the administrative boundaries
              return feature.geometry.type !== 'Point' && feature.geometry.type !== 'MultiPoint';
            },
            onEachFeature: (feature, layer) => {
              const name = feature?.properties?.name || feature?.properties?.tags?.name || feature?.properties?.['name:en'] || null;
              
              if (name) {
                layer.bindTooltip(name, {
                  className: 'custom-black-tooltip',
                  sticky: true,
                  direction: 'top',
                  offset: [0, -10]
                });
              }

              layer.on('mouseover', function () {
                if (layer instanceof L.Path) {
                  layer.setStyle({ fillOpacity: 0.5, weight: 3 });
                }
              });
              layer.on('mouseout', function () {
                activeNeighborhoodLayer!.resetStyle(layer as L.Path);
              });
              layer.on('click', function () {
                drawnItems.clearLayers();
                if (currentPolyline) {
                  map.removeLayer(currentPolyline);
                  currentPolyline = null;
                }
                currentRawInput = null;
                resultsPanel.classList.add('hidden');
                actionsFooter.classList.add('hidden');

                const name = feature?.properties?.name || feature?.properties?.tags?.name || feature?.properties?.['name:en'] || null;
                currentNeighborhoodName = name;

                const clickedLayer = layer as any;
                clickedLayer.setStyle({
                  color: '#1f2937', // Custom dark gray style to match Draw tools
                  weight: 2,
                  dashArray: '5, 5',
                  fillOpacity: 0.2
                });

                // Extract coordinates for LP Solver
                let latlngs: any[] = clickedLayer.getLatLngs();
                // If MultiPolygon, drill down to the longest array
                while (latlngs.length > 0 && Array.isArray(latlngs[0])) {
                  latlngs = latlngs.reduce((prev, current) => (prev.length > current.length) ? prev : current);
                }

                currentBounds = latlngs.map((ll: any) => ({ lat: ll.lat, lng: ll.lng }));

                // In order to make it editable by Leaflet Draw, we wrap the extracted flat latlngs in a new L.Polygon
                const newPolygon = L.polygon(latlngs, clickedLayer.options);
                drawnItems.addLayer(newPolygon);

                // Clean up Magic Wand state
                map.removeLayer(activeNeighborhoodLayer!);
                activeNeighborhoodLayer = null;
                magicWandBtn.style.backgroundColor = '';
              });
            }
          }).addTo(map);

          magicWandBtn.style.backgroundColor = '#e5e7eb'; // Active highlighted state
        } catch (error) {
          console.error(error);
          alert('Failed to load neighborhoods from OpenStreetMap.');
        } finally {
          isLoadingNeighborhoods = false;
          magicWandBtn.innerHTML = defaultWandIcon;
        }
      };
    }
  }

  map.on(L.Draw.Event.CREATED, (e: any) => {
    const layerType = e.layerType;
    if (layerType === 'polygon') {
      currentNeighborhoodName = null;
      drawnItems.clearLayers();
      if (currentPolyline) {
        map.removeLayer(currentPolyline);
        currentPolyline = null;
      }
      currentRawInput = null; // Clear any previous fixture data
      resultsPanel.classList.add('hidden');
      actionsFooter.classList.add('hidden');

      const layer = e.layer as L.Polygon;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];

      // Calculate area of the polygon using Leaflet GeometryUtil
      const areaM2 = L.GeometryUtil.geodesicArea(latlngs);
      const areaKm2 = areaM2 / 1_000_000;

      if (areaKm2 > MAX_AREA_KM2) {
        alert(`O polígono possui ${areaKm2.toFixed(2)} km², excedendo o limite de ${MAX_AREA_KM2} km². Desenhe uma área menor.`);
        return;
      }

      drawnItems.addLayer(layer);

      // Store the polygon coordinates instead of bounds
      currentBounds = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng })) as any;
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
        currentBounds = null;
      } else {
        currentBounds = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng })) as any;
      }
    });
  });

  map.on(L.Draw.Event.DELETED, () => {
    currentBounds = null;
    if (currentPolyline) {
      map.removeLayer(currentPolyline);
      currentPolyline = null;
    }
    resultsPanel.classList.add('hidden');
    actionsFooter.classList.add('hidden');
    sidebar.classList.add('hidden');
  });

  function syncSportSelect(value: string) {
    if (sportSelect) sportSelect.value = value;
    if (sportSelectMobile) sportSelectMobile.value = value;
  }

  if (sportSelect) {
    sportSelect.addEventListener('change', (e) => syncSportSelect((e.target as HTMLSelectElement).value));
  }
  if (sportSelectMobile) {
    sportSelectMobile.addEventListener('change', (e) => syncSportSelect((e.target as HTMLSelectElement).value));
  }

  worker.onmessage = (e: MessageEvent) => {
    const data = e.data;

    if (data.type === 'error') {
      alert("Erro na geração da rota:\n" + data.message);
      if (data.rawInput) {
        currentRawInput = data.rawInput;
        console.log('[Main] Fixture de debug salva mesmo com erro. Digite downloadFixture() no console para baixar.');
      }
      generateBtn.disabled = false;
      generateBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        Plan Route
      `;
      if (mobileGenerateBtn) {
        mobileGenerateBtn.disabled = false;
        mobileGenerateBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          Plan Route
        `;
      }
      return;
    }

    // Reset button implicitly via done mode
    setDoneMode(true);

    if (!data.path || data.path.length === 0) {
      alert("Nenhum caminho foi gerado.");
      return;
    }
    currentPathData = data.path;
    currentRawInput = data.rawInput;

    if (data.type === 'success' && data.path) {
      currentPathData = data.path;
      const distanceKm = data.distance as number;
      currentDistanceKm = distanceKm;

      if (currentPolyline) map.removeLayer(currentPolyline);

      currentPolyline = L.polyline(data.path, {
        color: '#ef4444',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);

      map.fitBounds(currentPolyline.getBounds());

      // Show sidebar on mobile when route is ready
      sidebar.classList.remove('hidden');

      // Update UI
      resultDistance.innerHTML = `${distanceKm.toFixed(2)} <span class="text-sm font-medium text-gray-500">km</span>`;

      const mode = sportSelect ? sportSelect.value : 'bike';

      let totalMinutes = 0;
      if (mode === 'bike') {
        totalMinutes = (distanceKm / SPEED_BIKE) * 60;
      } else {
        totalMinutes = distanceKm * PACE_WALK;
      }

      const h = Math.floor(totalMinutes / 60);
      const m = Math.round(totalMinutes % 60);

      if (h > 0) {
        resultTime.innerHTML = `${h}<span class="text-sm font-medium text-gray-500">h</span> ${m}<span class="text-sm font-medium text-gray-500">m</span>`;
      } else {
        resultTime.innerHTML = `${m} <span class="text-sm font-medium text-gray-500">min</span>`;
      }

      if (currentNeighborhoodName) {
        const neighborhoodTitle = document.getElementById('neighborhood-title');
        const neighborhoodName = document.getElementById('neighborhood-name');
        if (neighborhoodTitle && neighborhoodName) {
          neighborhoodName.textContent = currentNeighborhoodName;
          neighborhoodTitle.classList.remove('hidden');
          
          const mode = sportSelect ? sportSelect.value : 'bike';
          const sportTag = document.getElementById('sport-tag');
          if (sportTag) {
            sportTag.textContent = mode === 'bike' ? 'Ride' : 'Walk';
            sportTag.classList.remove('hidden');
          }
        }
      } else {
        const neighborhoodTitle = document.getElementById('neighborhood-title');
        if (neighborhoodTitle) neighborhoodTitle.classList.add('hidden');
      }

      resultsPanel.classList.remove('hidden');
      actionsFooter.classList.remove('hidden');
    }
  };

  if (mobileGenerateBtn) {
    mobileGenerateBtn.addEventListener('click', () => {
      generateBtn.click(); // Proxy the click to the main button
    });
  }

  generateBtn.addEventListener('click', () => {
    if (isDoneMode) {
      if (isSharedView) {
        window.location.href = '/';
        return;
      }
      setDoneMode(false);
      return;
    }

    if (!currentBounds) {
      alert("Por favor, desenhe um polígono no mapa primeiro.");
      return;
    }

    const mode = sportSelect ? sportSelect.value : 'bike';

    generateBtn.disabled = true;
    if (mobileGenerateBtn) mobileGenerateBtn.disabled = true;
    generateBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      Planning...
    `;
    if (mobileGenerateBtn) {
      mobileGenerateBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        Planning...
      `;
    }
    resultsPanel.classList.add('hidden');
    actionsFooter.classList.add('hidden');

    console.log('[Main] Enviando payload para o Worker:', currentBounds);
    worker.postMessage({
      mode: mode,
      polygon: currentBounds
    });
  });

  exportBtn.addEventListener('click', () => {
    if (currentPathData.length === 0) return;

    const gpxString = generateGPX(currentPathData);
    const blob = new Blob([gpxString], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `rota-otimizada-${Date.now()}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  previewBtn.addEventListener('click', () => {
    if (currentPathData.length === 0) return;

    // Check if playing
    if (animReqId !== null) {
      // Stop animation
      cancelAnimationFrame(animReqId);
      animReqId = null;
      if (animPolyline) map.removeLayer(animPolyline);
      if (animMarker) map.removeLayer(animMarker);
      if (currentPolyline) currentPolyline.setStyle({ opacity: 0.8 });
      previewBtn.innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        Preview
      `;
      return;
    }

    // Start animation
    previewBtn.innerHTML = `
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      Stop
    `;

    if (currentPolyline) currentPolyline.setStyle({ opacity: 0.2 });

    if (animPolyline) map.removeLayer(animPolyline);
    if (animMarker) map.removeLayer(animMarker);

    animPolyline = L.polyline([], {
      color: '#ef4444',
      weight: 5,
      opacity: 1,
      lineJoin: 'round'
    }).addTo(map);

    animMarker = L.circleMarker(currentPathData[0], {
      color: '#b91c1c',
      fillColor: '#ef4444',
      fillOpacity: 1,
      radius: 6,
      weight: 2
    }).addTo(map);

    let startTime: number | null = null;
    const duration = 10000; // 10 seconds for full route
    const totalPoints = currentPathData.length;

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / duration;

      if (progress >= 1) {
        animPolyline!.setLatLngs(currentPathData);
        animReqId = null;
        previewBtn.innerHTML = `
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Preview
        `;
        if (currentPolyline) currentPolyline.setStyle({ opacity: 0.8 });
        if (animMarker) map.removeLayer(animMarker);
        return;
      }

      const targetIndex = Math.floor(progress * totalPoints);
      animPolyline!.setLatLngs(currentPathData.slice(0, targetIndex + 1));
      animMarker!.setLatLng(currentPathData[targetIndex]);

      animReqId = requestAnimationFrame(animate);
    }

    animReqId = requestAnimationFrame(animate);
  });

  shareBtn.addEventListener('click', async () => {
    if (currentPathData.length === 0) return;

    const encoded = encodeRoute(currentPathData);
    const url = new URL(window.location.href);
    url.searchParams.set('route', encoded);

    let text = 'See more in Rotas';
    if (currentNeighborhoodName) {
      const mode = sportSelect ? sportSelect.value : 'bike';
      url.searchParams.set('name', currentNeighborhoodName);
      url.searchParams.set('mode', mode);
      url.searchParams.set('distance', currentDistanceKm.toFixed(2));
      const action = mode === 'bike' ? 'Ride' : 'Walk';
      text = `${action} through ${currentNeighborhoodName}`;
    }

    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Planned route',
          text: text,
          url: shareUrl,
        });
        console.log('Rota compartilhada com sucesso!');
      } catch (err) {
        console.log('Compartilhamento cancelado ou falhou.', err);
      }
    } else {
      // Fallback para clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link da rota copiado para a área de transferência!');
      }).catch(err => {
        console.error('Falha ao copiar link:', err);
        alert('Não foi possível copiar o link. Tente copiar a URL manualmente após adicionar ?route=...');
      });
    }
  });

  (window as any).downloadFixture = () => {
    if (!currentRawInput) {
      console.warn("Nenhuma rota foi gerada ainda.");
      return;
    }
    const blob = new Blob([JSON.stringify(currentRawInput, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixture-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Fixture baixada com sucesso!");
  };
});
