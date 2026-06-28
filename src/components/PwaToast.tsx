import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshIcon } from './icons';
import { Button } from './ui/Button';

export const PwaToast: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });

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
        <Button id="pwa-close-btn" onClick={() => setNeedRefresh(false)} variant="ghost" size="sm" className="text-xs">Later</Button>
        <Button id="pwa-reload-btn" onClick={() => updateServiceWorker?.(true)} variant="primary" size="sm" className="text-xs shadow-sm">Reload Now</Button>
      </div>
    </div>
  );
};
