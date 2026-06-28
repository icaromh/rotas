import React, { useEffect, useRef } from 'react';
import { GitHubIcon } from './icons';
import { Button } from './ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  return (
    <dialog
      id="about-modal"
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="backdrop:bg-black/50 backdrop:backdrop-blur-sm rounded-3xl p-0 shadow-2xl border-0 m-auto bg-transparent w-[90%] max-w-md open:animate-in open:fade-in open:zoom-in-95 transition-all"
    >
      <div className="bg-white p-6 md:p-8 rounded-3xl flex flex-col gap-4 text-center">
        <div className="mx-auto bg-[#f4f1ea] w-16 h-16 rounded-full flex items-center justify-center mb-2">
          <img src="/logo.svg" alt="Rotas Logo" className="h-10 w-auto drop-shadow-sm" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center justify-center gap-2">
          Rotas
          <span className="bg-[#4a6b46] text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold align-middle">Beta</span>
        </h2>
        <p className="text-gray-600 text-sm md:text-base leading-relaxed">
          Draw an area on the map and get an optimized GPX track to walk or ride through every single street inside it.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 mt-2 flex flex-col items-center gap-3">
          <div>
            <p className="text-sm font-bold text-gray-800">Developed by Icaro MH</p>
            <p className="text-xs text-gray-500 mt-0.5">Open source path planner.</p>
          </div>
          <a href="https://github.com/icaromh/rotas" target="_blank" rel="noreferrer" className="text-sm text-[#4a6b46] hover:text-[#395336] font-bold hover:underline flex items-center gap-1.5 transition-colors">
            <GitHubIcon size={16} />
            View on GitHub
          </a>
        </div>
        <Button 
          id="close-about-btn" 
          onClick={onClose} 
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4"
        >
          Close
        </Button>
      </div>
    </dialog>
  );
};
