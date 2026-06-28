import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { encodeRoute } from '../utils/routeSharing';

interface Props {
  onPreviewToggle: () => void;
  onExportGpx: () => void;
  isPreviewing: boolean;
}

export const Sidebar: React.FC<Props> = ({ onPreviewToggle, onExportGpx, isPreviewing }) => {
  const isDoneMode = useAppStore(state => state.isDoneMode);
  const isSharedView = useAppStore(state => state.isSharedView);
  const sportMode = useAppStore(state => state.sportMode);
  const currentDistanceKm = useAppStore(state => state.currentDistanceKm);
  const currentNeighborhoodName = useAppStore(state => state.currentNeighborhoodName);
  const currentPathData = useAppStore(state => state.currentPathData);

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
    const url = new URL(window.location.href);
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
      <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto md:hidden shrink-0 mt-4 mb-1"></div>

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
          <button id="preview-btn" onClick={onPreviewToggle} className={`${isSharedView ? 'col-span-1' : 'col-span-2'} bg-[#f0ece1] hover:bg-[#e6dfcf] text-[#4a6b46] font-bold py-2.5 px-4 rounded-full shadow-sm transition-colors flex justify-center items-center gap-2`}>
            {isPreviewing ? (
              <>
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Stop
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Preview
              </>
            )}
          </button>
          
          <button id="export-gpx-btn" onClick={onExportGpx} className="col-span-1 bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-3 rounded-full shadow transition-colors flex justify-center items-center gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            GPX
          </button>

          {!isSharedView && (
            <button id="share-btn" onClick={handleShare} className="col-span-1 bg-[#4a6b46] hover:bg-[#395336] text-white font-bold py-2 px-3 rounded-full shadow transition-colors flex justify-center items-center gap-2 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          )}
        </div>

        {isSharedView && (
          <div id="shared-notice">
            <p className="text-sm font-medium text-gray-700">Viewing an external route. <a href="/" className="text-[#4a6b46] hover:underline font-bold">Start over</a>.</p>
          </div>
        )}
      </div>
    </aside>
  );
};
