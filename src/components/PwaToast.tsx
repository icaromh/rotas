import React, { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RefreshIcon } from './icons';

export const PwaToast: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateFn = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
    });
    setUpdateSW(() => updateFn);
  }, []);

  if (!needRefresh) return null;

  return (
    <div id="pwa-toast" className="fixed bottom-4 right-4 z-[9999] bg-white border border-gray-200 shadow-xl rounded-xl p-4 flex flex-col gap-3 max-w-sm w-[calc(100%-2rem)] mx-auto md:w-auto md:mx-0 animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0 mt-0.5">
          <RefreshIcon size={18} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Update Available</h3>
          <p className="text-xs text-gray-500 mt-0.5">A new version of Rotas is ready. Reload to apply.</p>
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-1">
        <button id="pwa-close-btn" onClick={() => setNeedRefresh(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-md transition-colors">Later</button>
        <button id="pwa-reload-btn" onClick={() => updateSW?.(true)} className="px-3 py-1.5 text-xs font-semibold bg-[#4a6b46] hover:bg-[#395336] text-white rounded-md transition-colors shadow-sm">Reload Now</button>
      </div>
    </div>
  );
};
