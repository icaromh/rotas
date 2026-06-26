import './style.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
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
  const speedLabel = document.getElementById('speed-label') as HTMLLabelElement;
  const speedInput = document.getElementById('speed-input') as HTMLInputElement;
  const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLButtonElement;
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

  // State
  let currentBounds: L.LatLngBounds | null = null;
  let currentPolyline: L.Polyline | null = null;
  let currentPathData: { lat: number, lng: number }[] = [];
  let currentRawInput: any = null;

  // Animation State
  let animPolyline: L.Polyline | null = null;
  let animMarker: L.CircleMarker | null = null;
  let animReqId: number | null = null;
  console.log('[Main] Instanciando Web Worker...');
  const worker = new OptimizerWorker();

  worker.onerror = (err) => {
    console.error('[Main] Erro capturado na thread do Worker:', err);
  };

  // Initialize Map
  const map = L.map('map-container', { zoomControl: false }).setView([41.3874, 2.1686], 16); // Default to Barcelona
  (window as any).map = map;
  L.control.zoom({ position: 'topright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Check URL for Shared Route
  const urlParams = new URLSearchParams(window.location.search);
  const sharedRouteParam = urlParams.get('route');
  let isSharedView = false;

  if (sharedRouteParam) {
    const decodedPath = decodeRoute(sharedRouteParam);
    if (decodedPath && decodedPath.length > 0) {
      isSharedView = true;
      currentPathData = decodedPath;

      // Calculate total distance for UI
      let distanceMeters = 0;
      for (let i = 0; i < decodedPath.length - 1; i++) {
        distanceMeters += L.latLng(decodedPath[i].lat, decodedPath[i].lng)
          .distanceTo(L.latLng(decodedPath[i + 1].lat, decodedPath[i + 1].lng));
      }

      const distanceKm = distanceMeters / 1000;
      resultDistance.textContent = `${distanceKm.toFixed(2)} km`;
      resultTime.parentElement!.style.display = 'none'; // Hide estimated time as it depends on mode

      // Update UI panels
      creatorPanel.classList.add('hidden');
      resultsPanel.classList.remove('hidden');
      sharedNotice.classList.remove('hidden');
      shareBtn.classList.add('hidden'); // No need to share an already shared route

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
    options: { position: 'topright' },
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
    }
  }

  map.on(L.Draw.Event.CREATED, (e: any) => {
    const layerType = e.layerType;
    if (layerType === 'polygon') {
      drawnItems.clearLayers();
      if (currentPolyline) {
        map.removeLayer(currentPolyline);
        currentPolyline = null;
      }
      currentRawInput = null; // Clear any previous fixture data
      resultsPanel.classList.add('hidden');

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
  });

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
  });

  if (sportSelect) {
    sportSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.value === 'bike') {
        speedLabel.textContent = 'Speed (km/h)';
        speedInput.value = '17';
        speedInput.min = '1';
        speedInput.max = '100';
      } else {
        speedLabel.textContent = 'Pace (min/km)';
        speedInput.value = '10';
        speedInput.min = '1';
        speedInput.max = '30';
      }
    });
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
      return;
    }

    // Reset button
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      Plan Route
    `;

    if (!data.path || data.path.length === 0) {
      alert("Nenhum caminho foi gerado.");
      return;
    }
    currentPathData = data.path;
    currentRawInput = data.rawInput;

    if (data.type === 'success' && data.path) {
      currentPathData = data.path;
      const distanceKm = data.distance as number;

      if (currentPolyline) map.removeLayer(currentPolyline);

      currentPolyline = L.polyline(data.path, {
        color: '#ef4444',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);

      map.fitBounds(currentPolyline.getBounds());

      // Update UI
      resultDistance.textContent = `${distanceKm.toFixed(2)} km`;

      const mode = sportSelect ? sportSelect.value : 'bike';
      const speedVal = parseFloat(speedInput.value);

      let totalMinutes = 0;
      if (mode === 'bike') {
        // speedVal is km/h
        const hours = distanceKm / speedVal;
        totalMinutes = hours * 60;
      } else {
        // speedVal is min/km
        totalMinutes = distanceKm * speedVal;
      }

      const h = Math.floor(totalMinutes / 60);
      const m = Math.round(totalMinutes % 60);
      resultTime.textContent = h > 0 ? `${h}h ${m}m` : `${m} min`;

      resultsPanel.classList.remove('hidden');
    }
  };

  generateBtn.addEventListener('click', () => {
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
        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      `;
    }
    resultsPanel.classList.add('hidden');

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
        Animar Rota
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
          Animar Rota
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
    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rota Otimizada - GPS',
          text: 'Veja esta rota gerada no Otimizador de Quadrantes GPS!',
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
