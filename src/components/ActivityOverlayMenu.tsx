import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { RefreshIcon } from './icons';
import { useAppStore } from '../store/useAppStore';
import {
  activitiesToFeatureCollection,
  parseActivityFiles,
  type ActivityFeatureCollection,
  type LocalActivity,
} from '../utils/activityParser';
import {
  clearStoredActivities,
  loadStoredActivities,
  saveStoredActivities,
} from '../utils/activityStorage';

interface Props {
  onPathsFetched?: (paths: ActivityFeatureCollection) => void;
  showPaths?: boolean;
  setShowPaths?: (show: boolean) => void;
}

export const ActivityOverlayMenu: React.FC<Props> = ({
  onPathsFetched,
  showPaths = false,
  setShowPaths,
}) => {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<LocalActivity[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stravaColor = useAppStore((state) => state.stravaColor);
  const stravaOpacity = useAppStore((state) => state.stravaOpacity);
  const setStravaColor = useAppStore((state) => state.setStravaColor);
  const setStravaOpacity = useAppStore((state) => state.setStravaOpacity);

  useEffect(() => {
    loadStoredActivities()
      .then((stored) => setActivities(stored))
      .catch((err) => console.warn('Failed to load local activities:', err));

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setStatusMessage(t('activities.importing'));

    try {
      const parsed = await parseActivityFiles(files);
      if (parsed.length === 0) {
        setStatusMessage(t('activities.noTracksFound'));
      } else {
        await saveStoredActivities(parsed);
        const updated = await loadStoredActivities();
        setActivities(updated);
        setStatusMessage(t('activities.importSuccess', { count: parsed.length }));

        if (onPathsFetched) {
          onPathsFetched(activitiesToFeatureCollection(updated));
        }
        if (setShowPaths) {
          setShowPaths(true);
        }
      }
    } catch (err) {
      console.error('Failed to import activities:', err);
      setStatusMessage(t('activities.importError'));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleTogglePaths = () => {
    const next = !showPaths;
    if (next) {
      onPathsFetched?.(activitiesToFeatureCollection(activities));
    } else {
      onPathsFetched?.({ type: 'FeatureCollection', features: [] });
    }
    setShowPaths?.(next);
  };

  const handleClear = async () => {
    await clearStoredActivities();
    setActivities([]);
    onPathsFetched?.({ type: 'FeatureCollection', features: [] });
    setShowPaths?.(false);
    setStatusMessage(t('activities.cleared'));
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition outline-none overflow-hidden border border-gray-300 shrink-0 relative"
        title={t('activities.title')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={activities.length > 0 ? 'text-[#fc4c02]' : 'text-gray-600'}
        >
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M17 7h4v4" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-[9999] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="font-semibold text-gray-700 text-sm">{t('activities.title')}</span>
            {activities.length > 0 && (
              <span className="text-xs font-medium text-gray-500">
                {t('activities.storedCount', { count: activities.length })}
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".gpx,.tcx,.geojson,.json,.zip,.gz"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 leading-relaxed">{t('activities.description')}</p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="primary"
              size="sm"
              className="w-full justify-center bg-[#4a6b46] text-white hover:bg-[#3d593a]"
            >
              {isImporting ? t('activities.importing') : t('activities.importButton')}
            </Button>
            {statusMessage && (
              <div className="p-2 bg-gray-50 rounded text-xs text-center border border-gray-100 text-gray-600">
                {statusMessage}
              </div>
            )}
          </div>

          {activities.length > 0 && (
            <div className="flex flex-col gap-3 text-sm border-t border-gray-100 pt-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('activities.mapOverlay')}
                </span>
                <label className="flex items-center justify-between cursor-pointer p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
                  <span className="font-medium text-gray-700 text-sm">
                    {t('activities.showMyPaths')}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={showPaths}
                      onChange={handleTogglePaths}
                    />
                    <div
                      className={`block w-10 h-6 rounded-full transition-colors ${
                        showPaths ? 'bg-[#fc4c02]' : 'bg-gray-300'
                      }`}
                    />
                    <div
                      className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                        showPaths ? 'transform translate-x-4' : ''
                      }`}
                    />
                  </div>
                </label>

                {showPaths && (
                  <div className="flex flex-col gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        {t('activities.color')}
                      </span>
                      <div className="flex items-center gap-2">
                        {stravaColor !== '#fc4c02' && (
                          <button
                            onClick={() => setStravaColor('#fc4c02')}
                            className="text-gray-400 hover:text-gray-600 transition-colors outline-none"
                            title={t('activities.resetColor')}
                          >
                            <RefreshIcon size={14} />
                          </button>
                        )}
                        <input
                          type="color"
                          value={stravaColor}
                          onChange={(e) => setStravaColor(e.target.value)}
                          className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-600">
                        {t('activities.opacity')}
                      </span>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={stravaOpacity}
                        onChange={(e) => setStravaOpacity(parseFloat(e.target.value))}
                        className="w-24 accent-[#fc4c02]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-2">
                <Button
                  onClick={handleClear}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  {t('activities.clearAll')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
