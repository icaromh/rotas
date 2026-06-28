import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Link } from '@tanstack/react-router';
import { ChevronDownIcon, SettingsIcon, RefreshIcon, RouteIcon, InfoIcon } from './icons';
import { Button } from './ui/Button';

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
          <Button id="about-btn" variant="ghost-text" size="none" onClick={onOpenAbout}>About</Button>
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
              <ChevronDownIcon className="w-3.5 h-3.5 text-[#4a6b46] absolute right-2.5 pointer-events-none" />
            </div>

            <Button id="mobile-settings-btn" onClick={onOpenSettings} variant="icon-secondary" size="icon-sm" className="md:hidden">
              <SettingsIcon size={16} />
            </Button>
          </>
        )}

        <Button 
          id="mobile-generate-btn" 
          onClick={onGenerate}
          variant="primary"
          size="md"
          className="md:hidden"
        >
          {isDoneMode ? (
            <>
              <RefreshIcon size={16} />
              New Plan
            </>
          ) : (
            <>
              <RouteIcon size={16} />
              Plan
            </>
          )}
        </Button>

        <Button id="mobile-about-btn" onClick={onOpenAbout} variant="icon-secondary" size="icon-sm" className="md:hidden p-2">
          <InfoIcon size={18} />
        </Button>
      </div>
    </nav>
  );
};
