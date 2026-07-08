import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { TopNav } from '../components/TopNav';
import { MapContainer } from '../components/MapContainer';
import { Sidebar } from '../components/Sidebar';
import { Toolbar } from '../components/Toolbar';
import { PreferencesModal } from '../components/PreferencesModal';
import { AboutModal } from '../components/AboutModal';
import { Loader } from '../components/Loader';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { fetchRoadNetwork } from '../api/overpass';
import { usePostHog } from 'posthog-js/react';

export const Planner: React.FC = () => {
  const sportMode = useAppStore(state => state.sportMode);
  const bufferMeters = useAppStore(state => state.bufferMeters);
  const safetyPreference = useAppStore(state => state.safetyPreference);
  const { t } = useTranslation();
  const posthog = usePostHog();

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

  const roadNetworkMutation = useMutation({
    mutationFn: ({ polygon, mode, bufferMeters, safety }: any) =>
      fetchRoadNetwork(polygon, mode, bufferMeters, safety)
  });



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
        posthog.capture('route_generated', {
          sport_mode: sportMode,
          distance_km: distance,
          neighborhood_name: currentNeighborhoodNameRef.current,
          buffer_meters: bufferMeters,
          safety_preference: safetyPreference,
          waypoint_count: path.length,
        });
      } else if (type === 'error') {
        alert(t('planner.errorGeneration') + ' ' + message);
        setLoader({ isLoading: false, title: '', subtitle: '' });
        posthog.capture('route_generation_failed', {
          sport_mode: sportMode,
          buffer_meters: bufferMeters,
          safety_preference: safetyPreference,
          error_message: message,
        });
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

  const handleGenerate = async () => {
    if (isDoneMode) {
      // Start over
      setIsDoneMode(false);
      setRouteData({ path: [], distanceKm: 0, neighborhoodName: null });
      currentPolygonBounds.current = null;
      currentNeighborhoodNameRef.current = null;
      return;
    }

    if (!currentPolygonBounds.current) {
      alert(t('planner.errorNoArea'));
      return;
    }

    setLoader({
      isLoading: true,
      title: t('planner.generatingRoute'),
      subtitle: sportMode === 'bike' ? t('planner.analyzingBike') : t('planner.analyzingWalk')
    });

    try {
      const overpassData = await roadNetworkMutation.mutateAsync({
        polygon: currentPolygonBounds.current,
        mode: sportMode,
        bufferMeters,
        safety: safetyPreference
      });

      workerRef.current?.postMessage({
        overpassData,
        polygon: currentPolygonBounds.current,
        mode: sportMode,
        bufferMeters,
        safety: safetyPreference
      });
    } catch (err: any) {
      alert(t('planner.errorGeneration') + ' ' + err.message);
      setLoader({ isLoading: false, title: '', subtitle: '' });
    }
  };


  return (
    <>
      <TopNav 
        onOpenAbout={() => setIsAboutOpen(true)}
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
            isPreviewing={isPreviewing}
            isSharedView={false}
            isDoneMode={isDoneMode}
            currentDistanceKm={routeData.distanceKm}
            currentNeighborhoodName={routeData.neighborhoodName}
            currentPathData={routeData.path}
            onReset={handleGenerate}
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
