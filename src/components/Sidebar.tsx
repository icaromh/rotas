import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { StopCircleIcon, PlayCircleIcon, DownloadIcon, ShareIcon } from './icons';
import { Button } from './ui/Button';
import { encodeRoute } from '../utils/routeSharing';
import { Link } from '@tanstack/react-router';

interface Props {
  onPreviewToggle: () => void;
  onExportGpx: () => void;
  isPreviewing: boolean;
  isDoneMode: boolean;
  isSharedView: boolean;
  currentDistanceKm: number;
  currentNeighborhoodName: string | null;
  currentPathData: { lat: number; lng: number }[];
}

export const Sidebar: React.FC<Props> = ({
  onPreviewToggle,
  onExportGpx,
  isPreviewing,
  isDoneMode,
  isSharedView,
  currentDistanceKm,
  currentNeighborhoodName,
  currentPathData
}) => {
  const sportMode = useAppStore(state => state.sportMode);

  if (!isDoneMode && !isSharedView) return null;

  const PACE_WALK = 10; // min/km
  const SPEED_BIKE = 17; // km/h

  let totalMinutes = 0;
  if (sportMode === 'bike') {
    totalMinutes = (currentDistanceKm / SPEED_BIKE) * 60;
  } else {
    totalMinutes = currentDistanceKm * PACE_WALK;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);

  const handleShare = async () => {
    if (currentPathData.length === 0) return;
    const encoded = encodeRoute(currentPathData);
    const url = new URL(window.location.origin + '/preview');
    url.searchParams.set('route', encoded);

    if (currentNeighborhoodName) {
      url.searchParams.set('name', currentNeighborhoodName);
    }
    url.searchParams.set('mode', sportMode);
    url.searchParams.set('distance', currentDistanceKm.toFixed(2));

    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        console.log('Rota compartilhada com sucesso!');
      } catch (err) {
        console.log('Compartilhamento cancelado ou falhou.', err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link da rota copiado para a área de transferência!');
      }).catch(err => {
        console.error('Falha ao copiar link:', err);
        alert('Não foi possível copiar o link.');
      });
    }
  };

  return (
    <aside id="sidebar" className="fixed bottom-6 inset-x-4 md:inset-auto md:relative md:w-80 bg-white shadow-2xl md:shadow-xl flex flex-col pointer-events-auto h-auto max-h-[50vh] md:max-h-none md:h-full rounded-3xl overflow-hidden z-[1002] md:z-50">

      <div className="hidden md:block p-5 bg-white border-b border-gray-100 shrink-0">
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Explore Every Inch</h1>
        <p className="text-xs text-gray-400 mt-1">Draw an area on the map and get an optimized GPX track to walk or ride through every single street inside it.</p>
      </div>

      <div className="p-4 md:p-5 flex-grow overflow-y-auto flex flex-col gap-4 md:gap-6 bg-white md:bg-[#f8f7f5] custom-scrollbar">
        <div id="results-panel" className="flex-col gap-4 md:pt-4 md:border-t border-gray-100 flex-grow flex">
          <h2 id="neighborhood-title" className="flex justify-center items-center gap-2 mt-2 mb-1">
            <span id="neighborhood-name" className="text-xl font-extrabold text-gray-900">
              {currentNeighborhoodName || 'Custom Route'}
            </span>
            <span id="sport-tag" className="bg-[#4a6b46] text-white text-[10px] px-2 py-1 rounded-md uppercase tracking-wider font-extrabold">
              {sportMode === 'bike' ? 'Ride' : 'Walk'}
            </span>
          </h2>
          <div className="flex justify-around items-center pt-2 pb-1">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl font-extrabold text-gray-900" id="result-distance">
                {currentDistanceKm.toFixed(2)} <span className="text-sm font-medium text-gray-500">km</span>
              </div>
              <div className="text-[12px] text-gray-500 font-medium mt-1">Distance</div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl font-extrabold text-gray-900" id="result-time">
                {h > 0 ? (
                  <>{h}<span className="text-sm font-medium text-gray-500">h</span> {m}<span className="text-sm font-medium text-gray-500">m</span></>
                ) : (
                  <>{m} <span className="text-sm font-medium text-gray-500">min</span></>
                )}
              </div>
              <div className="text-[12px] text-gray-500 font-medium mt-1">Est. time</div>
            </div>
          </div>
        </div>
      </div>

      <div id="actions-footer" className="shrink-0 flex flex-col gap-3 p-4 md:p-5 bg-white md:bg-[#f8f7f5] border-t border-gray-100">
        <div className="grid grid-cols-2 gap-2">
          <Button
            id="preview-btn"
            onClick={onPreviewToggle}
            variant="secondary"
            size="md"
            className={isSharedView ? 'col-span-1' : 'col-span-2'}
          >
            {isPreviewing ? (
              <>
                <StopCircleIcon className="w-5 h-5 mr-1" />
                Stop
              </>
            ) : (
              <>
                <PlayCircleIcon className="w-5 h-5 mr-1" />
                Preview
              </>
            )}
          </Button>

          <Button
            id="export-gpx-btn"
            onClick={onExportGpx}
            variant="dark"
            size="sm"
            className="col-span-1 text-sm"
          >
            <DownloadIcon size={16} />
            GPX
          </Button>

          {!isSharedView && (
            <Button
              id="share-btn"
              onClick={handleShare}
              variant="primary"
              size="sm"
              className="col-span-1 text-sm shadow-md"
            >
              <ShareIcon size={16} />
              Share
            </Button>
          )}
        </div>

        {isSharedView && (
          <div id="shared-notice" className={isSharedView ? "block" : "hidden"}>
            <p className="text-sm font-medium text-gray-700">Viewing an external route. <Link to="/" className="text-[#4a6b46] hover:underline font-bold">Start over</Link>.</p>
          </div>
        )}
      </div>
    </aside>
  );
};
