import './style.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';

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

document.addEventListener('DOMContentLoaded', () => {
  const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
  const speedLabel = document.getElementById('speed-label') as HTMLLabelElement;
  const speedInput = document.getElementById('speed-input') as HTMLInputElement;
  const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLButtonElement;
  const sidebar = document.getElementById('sidebar') as HTMLElement;
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;

  // State
  let currentBounds: L.LatLngBounds | null = null;

  // Initialize Map
  const map = L.map('map-container').setView([-23.55052, -46.633308], 13); // Default to São Paulo
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Initialize Draw Control
  const drawnItems = new L.FeatureGroup();
  map.addTo(drawnItems);
  
  const drawControl = new L.Control.Draw({
    draw: {
      polyline: false,
      polygon: false,
      circle: false,
      marker: false,
      circlemarker: false,
      rectangle: {
        shapeOptions: {
          color: '#3b82f6',
          weight: 2,
          fillOpacity: 0.1
        }
      }
    },
    edit: {
      featureGroup: drawnItems,
      remove: true
    }
  });
  map.addControl(drawControl);

  function getAreaInKm2(bounds: L.LatLngBounds): number {
    const nw = bounds.getNorthWest();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const widthKm = nw.distanceTo(ne) / 1000;
    const heightKm = nw.distanceTo(sw) / 1000;
    return widthKm * heightKm;
  }

  map.on(L.Draw.Event.CREATED, (e: any) => {
    drawnItems.clearLayers(); // Only allow one rectangle
    const layer = e.layer;
    const bounds = layer.getBounds();
    const area = getAreaInKm2(bounds);
    
    if (area > MAX_AREA_KM2) {
      alert(`O quadrante selecionado possui ${area.toFixed(2)} km², excedendo o limite máximo de ${MAX_AREA_KM2} km² para processamento no navegador. Por favor, desenhe uma área menor.`);
      return;
    }

    currentBounds = bounds;
    drawnItems.addLayer(layer);
  });

  map.on(L.Draw.Event.EDITED, (e: any) => {
    e.layers.eachLayer((layer: any) => {
      const bounds = layer.getBounds();
      const area = getAreaInKm2(bounds);
      if (area > MAX_AREA_KM2) {
        alert(`O quadrante editado possui ${area.toFixed(2)} km², excedendo o limite de ${MAX_AREA_KM2} km². A seleção foi cancelada.`);
        drawnItems.clearLayers();
        currentBounds = null;
      } else {
        currentBounds = bounds;
      }
    });
  });

  map.on(L.Draw.Event.DELETED, () => {
    currentBounds = null;
  });

  // Toggle Sidebar on Mobile
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
  });

  // Handle Mode Change (Bike vs Walk)
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.value === 'bike') {
        speedLabel.textContent = 'Velocidade (km/h)';
        speedInput.value = '20';
        speedInput.min = '1';
        speedInput.max = '100';
      } else {
        speedLabel.textContent = 'Pace (min/km)';
        speedInput.value = '10'; // Default walking pace
        speedInput.min = '1';
        speedInput.max = '30';
      }
    });
  });

  generateBtn.addEventListener('click', () => {
    if (!currentBounds) {
      alert("Por favor, desenhe um retângulo no mapa primeiro.");
      return;
    }
    
    console.log('Gerar rota para bounds:', currentBounds.toBBoxString());
    console.log('Modo:', (document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value);
    console.log('Velocidade/Pace:', speedInput.value);
  });
});
