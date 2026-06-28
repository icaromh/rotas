import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  const getFlag = (lang: string) => {
    switch (lang) {
      case 'pt-BR': return '🇧🇷';
      case 'es-ES': return '🇪🇸';
      case 'en-US':
      default: return '🇺🇸';
    }
  };

  return (
    <div className="relative w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
      <span className="text-lg pointer-events-none">{getFlag(i18n.language)}</span>
      
      <select
        value={i18n.language}
        onChange={handleLanguageChange}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      >
        <option value="en-US">English</option>
        <option value="pt-BR">Português</option>
        <option value="es-ES">Español</option>
      </select>
    </div>
  );
};
