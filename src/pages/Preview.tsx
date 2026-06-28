import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { TopNav } from '../components/TopNav';
import { MapContainer } from '../components/MapContainer';
import { Sidebar } from '../components/Sidebar';
import { AboutModal } from '../components/AboutModal';
import { decodeRoute } from '../utils/routeSharing';
import { previewRoute } from '../router';

export const Preview: React.FC = () => {
  const { route, name, mode, distance } = previewRoute.useSearch();
  
  const setSportMode = useAppStore(state => state.setSportMode);

  const [routeData, setRouteData] = useState<{
    path: { lat: number; lng: number }[];
    distanceKm: number;
    neighborhoodName: string | null;
  }>({
    path: [],
    distanceKm: 0,
    neighborhoodName: null,
  });

  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    // TanStack Router might aggressively decode URI components, so we extract the raw param directly
    const rawRouteParam = new URLSearchParams(window.location.search).get('route') || route;

    if (rawRouteParam) {
      try {
        const decodedPoints = decodeRoute(rawRouteParam);
        if (decodedPoints.length > 0) {
          setRouteData({
            path: decodedPoints,
            distanceKm: parseFloat(distance || '0'),
            neighborhoodName: name || null
          });
          if (mode === 'bike' || mode === 'walk') {
            setSportMode(mode);
          }
        }
      } catch (err) {
        console.error('Failed to decode shared route', err);
      }
    }
  }, [route, name, mode, distance]);

  const handleExportGpx = () => {
    if (routeData.path.length === 0) return;

    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1" creator="Rotas App">\n';
    gpx += '  <trk>\n';
    gpx += '    <name>Optimized Route</name>\n';
    gpx += '    <trkseg>\n';
    routeData.path.forEach(p => {
      gpx += `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>\n`;
    });
    gpx += '    </trkseg>\n';
    gpx += '  </trk>\n';
    gpx += '</gpx>';

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rotas-optimized.gpx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <TopNav 
        onOpenAbout={() => setIsAboutOpen(true)}
      />
      
      <div className="flex-1 relative w-full h-full bg-gray-200 overflow-hidden">
        <MapContainer 
          onPolygonDrawn={() => {}}
          onPolygonDeleted={() => {}}
          setGlobalLoader={() => {}}
          currentPolylineData={routeData.path}
          isPreviewing={isPreviewing}
          onPreviewFinished={() => setIsPreviewing(false)}
          isSharedView={true}
          isDoneMode={true}
        />

        <div className="absolute inset-0 pointer-events-none p-4 md:p-6 z-[1000] flex items-start gap-4">
          <Sidebar 
            onPreviewToggle={() => setIsPreviewing(!isPreviewing)}
            onExportGpx={handleExportGpx}
            isPreviewing={isPreviewing}
            isSharedView={true}
            isDoneMode={true}
            currentDistanceKm={routeData.distanceKm}
            currentNeighborhoodName={routeData.neighborhoodName}
            currentPathData={routeData.path}
          />
        </div>
      </div>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
};
