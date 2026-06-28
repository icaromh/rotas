import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RefreshIcon, RouteIcon, InfoIcon } from './icons';
import { Button } from './ui/Button';
import { LanguageSelector } from './LanguageSelector';

interface Props {
  onOpenAbout: () => void;
}

export const TopNav: React.FC<Props> = ({ onOpenAbout }) => {
  const { t } = useTranslation();

  return (
    <nav className="h-16 bg-[#f4f1ea] border-b border-[#e5e0d4] flex items-center justify-between px-6 z-[1000] shrink-0 shadow-sm relative">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Rotas Logo" className="h-8 w-auto drop-shadow-sm" />
          <span className="hidden md:block text-2xl font-extrabold text-gray-800 tracking-tight">Rotas</span>
        </div>
        <div className="hidden md:flex gap-5 text-sm font-bold text-gray-700 mt-1">
          <Link to="/" className="hover:text-[#4a6b46] transition-colors">{t('nav.planner')}</Link>
          <Button id="about-btn" variant="ghost-text" size="none" onClick={onOpenAbout}>{t('nav.about')}</Button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSelector />

        <Button id="mobile-about-btn" onClick={onOpenAbout} variant="icon-secondary" size="icon-sm" className="md:hidden p-2">
          <InfoIcon size={18} />
        </Button>
      </div>
    </nav>
  );
};
