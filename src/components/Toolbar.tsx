import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { ChevronDownIcon, SettingsIcon, RefreshIcon, RouteIcon, BikeIcon, WalkIcon } from './icons';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';

interface Props {
  onOpenSettings: () => void;
  onGenerate: () => void;
  isDoneMode: boolean;
}

export const Toolbar: React.FC<Props> = ({ onOpenSettings, onGenerate, isDoneMode }) => {
  const sportMode = useAppStore(state => state.sportMode);
  const setSportMode = useAppStore(state => state.setSportMode);
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex justify-between items-start pointer-events-none">
      {/* Left Side: Tools + Dropdown */}
      <div 
        id="desktop-tools" 
        className={`flex flex-col md:flex-row items-start gap-3 pointer-events-auto transition-all ${isDoneMode ? 'hidden' : ''}`}
      >
        {/* Draw Controls Container (Leaflet injects here) */}
        <div id="draw-tools-container" className="flex flex-col md:flex-row items-start gap-3"></div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Sport Dropdown */}
          <div className="flex relative bg-white rounded-full shadow-lg border border-gray-200 items-center justify-center h-11 w-11 md:w-auto md:pl-4 md:pr-3 hover:bg-gray-50 transition-colors cursor-pointer group">
            
            {/* Visual Label: Icon (Mobile) / Text (Desktop) */}
            <div className="pointer-events-none flex items-center md:pr-6">
              <span className="hidden md:inline text-sm font-extrabold text-gray-800">
                {sportMode === 'bike' ? t('preferences.sport.cycling') : t('preferences.sport.walking')}
              </span>
              <span className="md:hidden text-gray-800 flex items-center justify-center">
                {sportMode === 'bike' ? <BikeIcon size={20} /> : <WalkIcon size={20} />}
              </span>
            </div>

            <ChevronDownIcon className="hidden md:block w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />

            {/* Invisible Native Select Overlay */}
            <select 
              id="sport-select"
              value={sportMode}
              onChange={(e) => setSportMode(e.target.value as any)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            >
              <option value="bike">{t('preferences.sport.cycling')}</option>
              <option value="walk">{t('preferences.sport.walking')}</option>
            </select>
          </div>

          {/* Settings Button */}
          <Button 
            id="settings-btn" 
            onClick={onOpenSettings}
            variant="icon"
            size="icon"
            className="flex"
          >
            <SettingsIcon size={18} />
          </Button>
        </div>
      </div>

      {/* Right Side: Generate Button */}
      <div id="desktop-generate-wrapper" className="pointer-events-auto ml-auto hidden md:block">
        <Button 
          id="generate-btn" 
          onClick={onGenerate}
          variant="primary"
          size="md"
          className="h-11"
        >
          {isDoneMode ? (
            <>
              <RefreshIcon size={18} />
              {t('toolbar.newPlan')}
            </>
          ) : (
            <>
              <RouteIcon size={18} />
              {t('toolbar.plan')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
