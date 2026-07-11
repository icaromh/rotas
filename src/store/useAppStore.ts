import { create } from 'zustand';
import { z } from 'zod';

const AppStateSchema = z.object({
  sportMode: z.enum(['bike', 'walk']),
  bufferMeters: z.number().min(0).max(100),
  safetyPreference: z.enum(['any', 'safe', 'strict']),
  stravaOpacity: z.number().min(0).max(1),
  stravaColor: z.string(),
  isFogModeEnabled: z.boolean(),
  fogOpacity: z.number().min(0).max(1),
  fogBrushSize: z.number().min(1).max(50),
});

type AppState = z.infer<typeof AppStateSchema>;

interface AppStore extends AppState {
  setSportMode: (mode: AppState['sportMode']) => void;
  setBufferMeters: (meters: number) => void;
  setSafetyPreference: (pref: AppState['safetyPreference']) => void;
  setStravaOpacity: (opacity: number) => void;
  setStravaColor: (color: string) => void;
  setIsFogModeEnabled: (enabled: boolean) => void;
  setFogOpacity: (opacity: number) => void;
  setFogBrushSize: (size: number) => void;
}

export const useAppStore = create<AppStore>((set) => {
  // Try to load initial preferences from localStorage
  let initialBuffer = 20;
  let initialSafety: AppState['safetyPreference'] = 'any';
  let initialStravaOpacity = 0.6;
  let initialStravaColor = '#fc4c02';
  let initialFogModeEnabled = false;
  let initialFogOpacity = 0.8;
  let initialFogBrushSize = 15;
  
  try {
    const savedBuffer = localStorage.getItem('rotas_bufferMeters');
    const savedSafety = localStorage.getItem('rotas_safety');
    const savedOpacity = localStorage.getItem('rotas_stravaOpacity');
    const savedColor = localStorage.getItem('rotas_stravaColor');
    const savedFogMode = localStorage.getItem('rotas_fogModeEnabled');
    const savedFogOpacity = localStorage.getItem('rotas_fogOpacity');
    const savedFogBrushSize = localStorage.getItem('rotas_fogBrushSize');

    if (savedBuffer !== null) initialBuffer = parseInt(savedBuffer, 10);
    if (savedSafety !== null && ['any', 'safe', 'strict'].includes(savedSafety)) {
      initialSafety = savedSafety as AppState['safetyPreference'];
    }
    if (savedOpacity !== null) initialStravaOpacity = parseFloat(savedOpacity);
    if (savedColor !== null) initialStravaColor = savedColor;
    if (savedFogMode !== null) initialFogModeEnabled = savedFogMode === 'true';
    if (savedFogOpacity !== null) initialFogOpacity = parseFloat(savedFogOpacity);
    if (savedFogBrushSize !== null) initialFogBrushSize = parseInt(savedFogBrushSize, 10);
  } catch (e) {
    console.warn("Failed to read preferences from localStorage", e);
  }

  return {
    sportMode: 'bike',
    bufferMeters: initialBuffer,
    safetyPreference: initialSafety,
    stravaOpacity: initialStravaOpacity,
    stravaColor: initialStravaColor,
    isFogModeEnabled: initialFogModeEnabled,
    fogOpacity: initialFogOpacity,
    fogBrushSize: initialFogBrushSize,

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

    setIsFogModeEnabled: (enabled) => {
      set({ isFogModeEnabled: enabled });
      try { localStorage.setItem('rotas_fogModeEnabled', enabled.toString()); } catch(e) {}
    },

    setFogOpacity: (opacity) => {
      set({ fogOpacity: opacity });
      try { localStorage.setItem('rotas_fogOpacity', opacity.toString()); } catch(e) {}
    },

    setFogBrushSize: (size) => {
      set({ fogBrushSize: size });
      try { localStorage.setItem('rotas_fogBrushSize', size.toString()); } catch(e) {}
    },
  };
});
