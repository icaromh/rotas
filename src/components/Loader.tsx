import React from 'react';

interface Props {
  isLoading: boolean;
  title: string;
  subtitle: string;
}

export const Loader: React.FC<Props> = ({ isLoading, title, subtitle }) => {
  if (!isLoading) return null;

  return (
    <div id="loader-overlay" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center transition-opacity">
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl animate-in fade-in zoom-in duration-200">
        <svg className="animate-spin text-[#4a6b46] w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="text-gray-800 font-bold text-center">
          <p id="loader-title" className="text-lg">{title}</p>
          <p id="loader-subtitle" className="text-sm text-gray-500 font-medium">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};
