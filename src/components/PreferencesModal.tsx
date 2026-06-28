import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SettingsIcon, XIcon, ChevronDownIcon } from './icons';
import { Button } from './ui/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PreferencesModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  const bufferMeters = useAppStore(state => state.bufferMeters);
  const setBufferMeters = useAppStore(state => state.setBufferMeters);
  const safetyPreference = useAppStore(state => state.safetyPreference);
  const setSafetyPreference = useAppStore(state => state.setSafetyPreference);
  const sportMode = useAppStore(state => state.sportMode);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const handleSave = () => {
    onClose();
  };

  return (
    <dialog
      id="preferences-modal"
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="backdrop:bg-gray-900/60 backdrop:backdrop-blur-sm p-0 rounded-3xl shadow-2xl bg-white w-[90%] max-w-md mx-auto fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 open:flex flex-col"
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <SettingsIcon size={20} />
            Route Settings
          </h2>
          <Button id="close-preferences" onClick={onClose} variant="icon-ghost" size="icon-sm" className="p-1">
            <XIcon size={20} />
          </Button>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-800 flex justify-between">
              Polygon Expansion
              <span id="buffer-value-display" className="text-[#4a6b46]">{bufferMeters}m</span>
            </label>
            <p className="text-xs text-gray-500 leading-relaxed mb-1">Expand the generated area to include streets slightly outside your drawing.</p>
            <input 
              type="range" 
              id="buffer-slider" 
              min="0" max="100" 
              value={bufferMeters} 
              onChange={(e) => setBufferMeters(parseInt(e.target.value, 10))}
              className="w-full accent-[#4a6b46] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-medium">
              <span>0m</span>
              <span>100m</span>
            </div>
          </div>

          {sportMode !== 'walk' && (
            <div id="safety-preference-container" className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-800">Cycling Preference</label>
              <p className="text-xs text-gray-500 leading-relaxed mb-1">Filter which types of streets are acceptable for riding.</p>
              <div className="relative bg-gray-50 rounded-lg border border-gray-200">
                <select 
                  id="safety-select"
                  value={safetyPreference}
                  onChange={(e) => setSafetyPreference(e.target.value as any)}
                  className="appearance-none bg-transparent w-full text-sm font-medium text-gray-800 py-2.5 pl-3 pr-8 cursor-pointer outline-none"
                >
                  <option value="any">Any Roads (Default)</option>
                  <option value="safe">Safer (Avoid busy avenues)</option>
                  <option value="strict">Strict Cycleways Only</option>
                </select>
                <ChevronDownIcon className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        <Button 
          id="save-preferences" 
          onClick={handleSave} 
          variant="primary"
          size="lg"
          fullWidth
          className="mt-8 text-sm"
        >
          Save Settings
        </Button>
      </div>
    </dialog>
  );
};
