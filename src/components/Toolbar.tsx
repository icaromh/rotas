import React from 'react';
import { useAppStore } from '../store/useAppStore';

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
          <svg className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        {/* Settings Button */}
        <button 
          id="settings-btn" 
          onClick={onOpenSettings}
          className="hidden md:flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700 h-11 w-11 rounded-full shadow-lg border border-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 21v-5h5"/>
              </svg>
              New Plan
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              Plan Route
            </>
          )}
        </button>
      </div>
    </div>
  );
};
