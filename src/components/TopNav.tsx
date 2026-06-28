import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Link } from '@tanstack/react-router';

interface Props {
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onGenerate: () => void;
  isDoneMode: boolean;
}

export const TopNav: React.FC<Props> = ({ onOpenSettings, onOpenAbout, onGenerate, isDoneMode }) => {
  const sportMode = useAppStore(state => state.sportMode);
  const setSportMode = useAppStore(state => state.setSportMode);

  return (
    <nav className="h-16 bg-[#f4f1ea] border-b border-[#e5e0d4] flex items-center justify-between px-6 z-[1000] shrink-0 shadow-sm relative">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Rotas Logo" className="h-8 w-auto drop-shadow-sm" />
          <span className="hidden md:block text-2xl font-extrabold text-gray-800 tracking-tight">Rotas</span>
        </div>
        <div className="hidden md:flex gap-5 text-sm font-bold text-gray-700 mt-1">
          <Link to="/" className="hover:text-[#4a6b46] transition-colors">Planner</Link>
          <button id="about-btn" onClick={onOpenAbout} className="hover:text-[#4a6b46] transition-colors cursor-pointer">About</button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!isDoneMode && (
          <>
            <div id="mobile-sport-dropdown" className="relative md:hidden bg-[#f0ece1] rounded-full flex items-center h-9 pl-3 pr-2 cursor-pointer group transition-opacity duration-300">
              <select 
                id="sport-select-mobile"
                value={sportMode}
                onChange={(e) => setSportMode(e.target.value as any)}
                className="appearance-none bg-transparent text-xs font-extrabold text-[#4a6b46] h-full pr-5 cursor-pointer outline-none"
              >
                <option value="bike">Cycling</option>
                <option value="walk">Walking</option>
              </select>
              <svg className="w-3.5 h-3.5 text-[#4a6b46] absolute right-2.5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>

            <button id="mobile-settings-btn" onClick={onOpenSettings} className="md:hidden bg-[#f0ece1] hover:bg-[#e5decb] text-[#4a6b46] h-9 w-9 rounded-full transition-colors flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </>
        )}

        <button 
          id="mobile-generate-btn" 
          onClick={onGenerate}
          className="md:hidden bg-[#4a6b46] text-white font-bold px-4 py-2 rounded-full text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
        >
          {isDoneMode ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
              New Plan
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              Plan
            </>
          )}
        </button>

        <button id="mobile-about-btn" onClick={onOpenAbout} className="md:hidden bg-[#f0ece1] hover:bg-[#e5decb] text-[#4a6b46] p-2 rounded-full transition-colors flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
        </button>
      </div>
    </nav>
  );
};
