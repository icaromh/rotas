import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { TopNav } from '../components/TopNav';
import { MapContainer } from '../components/MapContainer';
import { Sidebar } from '../components/Sidebar';
import { Toolbar } from '../components/Toolbar';
import { PreferencesModal } from '../components/PreferencesModal';
import { AboutModal } from '../components/AboutModal';
import { Loader } from '../components/Loader';

export const Planner: React.FC = () => {
  const sportMode = useAppStore(state => state.sportMode);
  const bufferMeters = useAppStore(state => state.bufferMeters);
  const safetyPreference = useAppStore(state => state.safetyPreference);

  const [isDoneMode, setIsDoneMode] = useState(false);
  const [routeData, setRouteData] = useState<{
    path: { lat: number; lng: number }[];
    distanceKm: number;
    neighborhoodName: string | null;
  }>({
    path: [],
    distanceKm: 0,
    neighborhoodName: null,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [loader, setLoader] = useState({ isLoading: false, title: '', subtitle: '' });
  const [isPreviewing, setIsPreviewing] = useState(false);

  const currentPolygonBounds = useRef<{ lat: number, lng: number }[] | null>(null);
  const currentNeighborhoodNameRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);



  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/optimizer.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, path, distance, message } = e.data;
      if (type === 'success') {
        setRouteData({
          path,
          distanceKm: distance,
          neighborhoodName: currentNeighborhoodNameRef.current
        });
        setLoader({ isLoading: false, title: '', subtitle: '' });
        setIsDoneMode(true);
      } else if (type === 'error') {
        alert('Falha ao gerar a rota: ' + message);
        setLoader({ isLoading: false, title: '', subtitle: '' });
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handlePolygonDrawn = (bounds: { lat: number, lng: number }[], neighborhoodName: string | null) => {
    currentPolygonBounds.current = bounds;
    currentNeighborhoodNameRef.current = neighborhoodName;
  };

  const handlePolygonDeleted = () => {
    currentPolygonBounds.current = null;
    currentNeighborhoodNameRef.current = null;
    setRouteData({ path: [], distanceKm: 0, neighborhoodName: null });
    setIsDoneMode(false);
  };

  const handleGenerate = () => {
    if (isDoneMode) {
      // Start over
      setIsDoneMode(false);
      setRouteData({ path: [], distanceKm: 0, neighborhoodName: null });
      currentPolygonBounds.current = null;
      currentNeighborhoodNameRef.current = null;
      return;
    }

    if (!currentPolygonBounds.current) {
      alert("Por favor, desenhe uma área no mapa primeiro ou use a Magic Wand para selecionar um bairro.");
      return;
    }

    setLoader({
      isLoading: true,
      title: 'Generating Route',
      subtitle: sportMode === 'bike' ? 'Analyzing street network...' : 'Generating pedestrian paths...'
    });

    workerRef.current?.postMessage({
      polygon: currentPolygonBounds.current,
      mode: sportMode,
      bufferMeters,
      safety: safetyPreference
    });
  };

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
        onGenerate={handleGenerate}
        isDoneMode={isDoneMode}
      />
      
      <div className="flex-1 relative w-full h-full bg-gray-200 overflow-hidden">
        <MapContainer 
          onPolygonDrawn={handlePolygonDrawn}
          onPolygonDeleted={handlePolygonDeleted}
          setGlobalLoader={(l, t, s) => setLoader({ isLoading: l, title: t || '', subtitle: s || '' })}
          currentPolylineData={routeData.path}
          isPreviewing={isPreviewing}
          onPreviewFinished={() => setIsPreviewing(false)}
          isSharedView={false}
          isDoneMode={isDoneMode}
        />

        <div className="absolute inset-0 pointer-events-none p-4 md:p-6 z-[1000] flex items-start gap-4">
          <Sidebar 
            onPreviewToggle={() => setIsPreviewing(!isPreviewing)}
            onExportGpx={handleExportGpx}
            isPreviewing={isPreviewing}
            isSharedView={false}
            isDoneMode={isDoneMode}
            currentDistanceKm={routeData.distanceKm}
            currentNeighborhoodName={routeData.neighborhoodName}
            currentPathData={routeData.path}
          />
          <Toolbar 
            onOpenSettings={() => setIsSettingsOpen(true)}
            onGenerate={handleGenerate}
            isDoneMode={isDoneMode}
          />
        </div>
      </div>

      <PreferencesModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <Loader {...loader} />
    </>
  );
};
