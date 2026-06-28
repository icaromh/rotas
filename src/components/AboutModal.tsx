import React, { useEffect, useRef } from 'react';

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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            View on GitHub
          </a>
        </div>
        <button id="close-about-btn" onClick={onClose} className="mt-4 bg-[#4a6b46] hover:bg-[#395336] text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] w-full focus:outline-none">
          Close
        </button>
      </div>
    </dialog>
  );
};
