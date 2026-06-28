import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { ChevronDownIcon, SettingsIcon, RefreshIcon, RouteIcon } from './icons';
import { Button } from './ui/Button';

interface Props {
  onOpenSettings: () => void;
  onGenerate: () => void;
  isDoneMode: boolean;
}

export const Toolbar: React.FC<Props> = ({ onOpenSettings, onGenerate, isDoneMode }) => {
  const sportMode = useAppStore(state => state.sportMode);
  const setSportMode = useAppStore(state => state.setSportMode);

  return (
    <div className="flex-1 flex justify-between items-start pointer-events-none">
      {/* Left Side: Tools + Dropdown */}
      <div 
        id="desktop-tools" 
        className={`flex flex-col md:flex-row items-start gap-3 pointer-events-auto transition-all ${isDoneMode ? 'hidden' : ''}`}
      >
        {/* Draw Controls Container (Leaflet injects here) */}
        <div id="draw-tools-container" className="flex items-start gap-3"></div>

        {/* Sport Dropdown */}
        <div className="hidden relative bg-white rounded-full shadow-lg border border-gray-200 md:flex items-center h-11 pl-4 pr-3 hover:bg-gray-50 transition-colors cursor-pointer group">
          <select 
            id="sport-select"
            value={sportMode}
            onChange={(e) => setSportMode(e.target.value as any)}
            className="appearance-none bg-transparent text-sm font-extrabold text-gray-800 h-full pr-6 cursor-pointer outline-none"
          >
            <option value="bike">Cycling</option>
            <option value="walk">Walking</option>
          </select>
          <ChevronDownIcon className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
        </div>

        {/* Settings Button */}
        <Button 
          id="settings-btn" 
          onClick={onOpenSettings}
          variant="icon"
          size="icon"
          className="hidden md:flex"
        >
          <SettingsIcon size={18} />
        </Button>
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
              New Plan
            </>
          ) : (
            <>
              <RouteIcon size={18} />
              Plan Route
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
