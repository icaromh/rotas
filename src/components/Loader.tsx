import React from 'react';
import { LoaderIcon } from './icons';

interface Props {
  isLoading: boolean;
  title: string;
  subtitle: string;
}

export const Loader: React.FC<Props> = ({ isLoading, title, subtitle }) => {
  if (!isLoading) return null;

  return (
    <div id="loader-overlay" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center transition-opacity">
      <div className="bg-white px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-[280px] text-center transform transition-all">
        <LoaderIcon className="text-[#4a6b46] w-10 h-10" />
        <div className="flex flex-col gap-1">
          <p id="loader-title" className="text-lg text-gray-800 font-bold">{title}</p>
          <p id="loader-subtitle" className="text-sm text-gray-500 font-medium">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};
