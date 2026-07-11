import { create } from 'zustand';
import { z } from 'zod';

const AppStateSchema = z.object({
  sportMode: z.enum(['bike', 'walk']),
  bufferMeters: z.number().min(0).max(100),
  safetyPreference: z.enum(['any', 'safe', 'strict']),
  stravaOpacity: z.number().min(0).max(1),
  stravaColor: z.string(),
});

type AppState = z.infer<typeof AppStateSchema>;

interface AppStore extends AppState {
  setSportMode: (mode: AppState['sportMode']) => void;
  setBufferMeters: (meters: number) => void;
  setSafetyPreference: (pref: AppState['safetyPreference']) => void;
  setStravaOpacity: (opacity: number) => void;
  setStravaColor: (color: string) => void;
}

export const useAppStore = create<AppStore>((set) => {
  // Try to load initial preferences from localStorage
  let initialBuffer = 20;
  let initialSafety: AppState['safetyPreference'] = 'any';
  let initialStravaOpacity = 0.6;
  let initialStravaColor = '#fc4c02';
  
  try {
    const savedBuffer = localStorage.getItem('rotas_bufferMeters');
    const savedSafety = localStorage.getItem('rotas_safety');
    const savedOpacity = localStorage.getItem('rotas_stravaOpacity');
    const savedColor = localStorage.getItem('rotas_stravaColor');

    if (savedBuffer !== null) initialBuffer = parseInt(savedBuffer, 10);
    if (savedSafety !== null && ['any', 'safe', 'strict'].includes(savedSafety)) {
      initialSafety = savedSafety as AppState['safetyPreference'];
    }
    if (savedOpacity !== null) initialStravaOpacity = parseFloat(savedOpacity);
    if (savedColor !== null) initialStravaColor = savedColor;
  } catch (e) {
    console.warn("Failed to read preferences from localStorage", e);
  }

  return {
    sportMode: 'bike',
    bufferMeters: initialBuffer,
    safetyPreference: initialSafety,
    stravaOpacity: initialStravaOpacity,
    stravaColor: initialStravaColor,

    setSportMode: (mode) => set({ sportMode: mode }),
    
    setBufferMeters: (meters) => {
      set({ bufferMeters: meters });
      try { localStorage.setItem('rotas_bufferMeters', meters.toString()); } catch(e) {}
    },
    
    setSafetyPreference: (pref) => {
      set({ safetyPreference: pref });
      try { localStorage.setItem('rotas_safety', pref); } catch(e) {}
    },

    setStravaOpacity: (opacity) => {
      set({ stravaOpacity: opacity });
      try { localStorage.setItem('rotas_stravaOpacity', opacity.toString()); } catch(e) {}
    },

    setStravaColor: (color) => {
      set({ stravaColor: color });
      try { localStorage.setItem('rotas_stravaColor', color); } catch(e) {}
    },
  };
});
