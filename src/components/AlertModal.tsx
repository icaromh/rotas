import React, { useEffect, useRef } from 'react';
import { Button } from './ui/Button';

interface Props {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  title?: string;
}

export const AlertModal: React.FC<Props> = ({ isOpen, message, onClose, title }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      // Move focus to the close button for accessibility
      setTimeout(() => closeBtnRef.current?.focus(), 50);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Trap Escape key — <dialog> handles it natively but we also call onClose
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      id="alert-modal"
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="alert-modal-title"
      aria-describedby="alert-modal-message"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="backdrop:bg-black/60 backdrop:backdrop-blur-sm rounded-3xl p-0 shadow-2xl border-0 m-auto bg-transparent w-[90%] max-w-sm open:animate-in open:fade-in open:zoom-in-95 transition-all"
    >
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(244,241,234,0.97) 100%)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.5)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-6 pt-6 pb-3"
        >
          {/* Warning icon + title */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            {title && (
              <h2
                id="alert-modal-title"
                className="text-base font-extrabold text-gray-900 tracking-tight"
              >
                {title}
              </h2>
            )}
          </div>

          {/* Close X button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <p
            id="alert-modal-message"
            className="text-sm text-gray-600 leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4">
          <Button
            ref={closeBtnRef}
            id="alert-modal-ok-btn"
            onClick={onClose}
            variant="primary"
            size="md"
            fullWidth
          >
            OK
          </Button>
        </div>
      </div>
    </dialog>
  );
};
