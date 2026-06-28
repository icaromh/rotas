import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { ChevronDownIcon, SettingsIcon, RefreshIcon, RouteIcon } from './icons';

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
        <button 
          id="settings-btn" 
          onClick={onOpenSettings}
          className="hidden md:flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700 h-11 w-11 rounded-full shadow-lg border border-gray-200 transition-colors"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      {/* Right Side: Generate Button */}
      <div id="desktop-generate-wrapper" className="pointer-events-auto ml-auto hidden md:block">
        <button 
          id="generate-btn" 
          onClick={onGenerate}
          className="bg-[#4a6b46] hover:bg-[#395336] text-white font-bold py-2.5 px-5 rounded-full shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-11"
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
        </button>
      </div>
    </div>
  );
};
