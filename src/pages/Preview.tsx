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
  
  const setRouteData = useAppStore(state => state.setRouteData);
  const setSportMode = useAppStore(state => state.setSportMode);
  const setSharedView = useAppStore(state => state.setSharedView);
  const currentPathData = useAppStore(state => state.currentPathData);

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
          setSharedView(true);
        }
      } catch (err) {
        console.error('Failed to decode shared route', err);
      }
    }
  }, [route, name, mode, distance]);

  const handleExportGpx = () => {
    if (currentPathData.length === 0) return;

    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1" creator="Rotas App">\n';
    gpx += '  <trk>\n';
    gpx += '    <name>Optimized Route</name>\n';
    gpx += '    <trkseg>\n';
    currentPathData.forEach(p => {
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
        onOpenSettings={() => {}} // No settings in preview
        onOpenAbout={() => setIsAboutOpen(true)}
        onGenerate={() => {}} // No generate in preview
      />
      
      <div className="flex-1 relative w-full h-full bg-gray-200 overflow-hidden">
        <MapContainer 
          onPolygonDrawn={() => {}}
          onPolygonDeleted={() => {}}
          setGlobalLoader={() => {}}
          currentPolylineData={currentPathData}
          isPreviewing={isPreviewing}
          onPreviewFinished={() => setIsPreviewing(false)}
        />

        <div className="absolute inset-0 pointer-events-none p-4 md:p-6 z-[1000] flex items-start gap-4">
          <Sidebar 
            onPreviewToggle={() => setIsPreviewing(!isPreviewing)}
            onExportGpx={handleExportGpx}
            isPreviewing={isPreviewing}
          />
        </div>
      </div>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
};
