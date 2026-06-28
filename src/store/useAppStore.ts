import { create } from 'zustand';
import { z } from 'zod';

const AppStateSchema = z.object({
  sportMode: z.enum(['bike', 'walk']),
  bufferMeters: z.number().min(0).max(100),
  safetyPreference: z.enum(['any', 'safe', 'strict']),
  isDoneMode: z.boolean(),
  isSharedView: z.boolean(),
  currentDistanceKm: z.number(),
  currentNeighborhoodName: z.string().nullable(),
  currentPathData: z.array(z.object({ lat: z.number(), lng: z.number() })),
});

type AppState = z.infer<typeof AppStateSchema>;

interface AppStore extends AppState {
  setSportMode: (mode: AppState['sportMode']) => void;
  setBufferMeters: (meters: number) => void;
  setSafetyPreference: (pref: AppState['safetyPreference']) => void;
  setDoneMode: (done: boolean) => void;
  setSharedView: (shared: boolean) => void;
  setRouteData: (data: {
    path: { lat: number; lng: number }[];
    distanceKm: number;
    neighborhoodName: string | null;
  }) => void;
  resetRoute: () => void;
}

export const useAppStore = create<AppStore>((set) => {
  // Try to load initial preferences from localStorage
  let initialBuffer = 20;
  let initialSafety: AppState['safetyPreference'] = 'any';
  
  try {
    const savedBuffer = localStorage.getItem('rotas_bufferMeters');
    const savedSafety = localStorage.getItem('rotas_safety');
    if (savedBuffer !== null) initialBuffer = parseInt(savedBuffer, 10);
    if (savedSafety !== null && ['any', 'safe', 'strict'].includes(savedSafety)) {
      initialSafety = savedSafety as AppState['safetyPreference'];
    }
  } catch (e) {
    console.warn("Failed to read preferences from localStorage", e);
  }

  return {
    sportMode: 'bike',
    bufferMeters: initialBuffer,
    safetyPreference: initialSafety,
    isDoneMode: false,
    isSharedView: false,
    currentDistanceKm: 0,
    currentNeighborhoodName: null,
    currentPathData: [],

    setSportMode: (mode) => set({ sportMode: mode }),
    
    setBufferMeters: (meters) => {
      set({ bufferMeters: meters });
      try { localStorage.setItem('rotas_bufferMeters', meters.toString()); } catch(e) {}
    },
    
    setSafetyPreference: (pref) => {
      set({ safetyPreference: pref });
      try { localStorage.setItem('rotas_safety', pref); } catch(e) {}
    },
    
    setDoneMode: (done) => set({ isDoneMode: done }),
    
    setSharedView: (shared) => set({ isSharedView: shared }),
    
    setRouteData: (data) => set({
      currentPathData: data.path,
      currentDistanceKm: data.distanceKm,
      currentNeighborhoodName: data.neighborhoodName,
    }),
    
    resetRoute: () => set({
      currentPathData: [],
      currentDistanceKm: 0,
      currentNeighborhoodName: null,
    })
  };
});
