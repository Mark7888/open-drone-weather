import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { SavedLocation } from '../types';

const GPS_LOCATION_ID = 'gps-my-location';

export const GPS_LOCATION: SavedLocation = {
  id: GPS_LOCATION_ID,
  customName: null,
  placeName: 'My Location',
  countryCode: '',
  lat: 0,
  lon: 0,
  isGPS: true,
};

const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('SecureStore setItem failed', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};

interface LocationState {
  saved: SavedLocation[];   // does NOT include GPS entry (always prepended in UI)
  active: SavedLocation | null;
  setActive: (location: SavedLocation) => void;
  addSaved: (location: SavedLocation) => void;
  removeSaved: (id: string) => void;
  updateSavedName: (id: string, customName: string | null) => void;
  updateGPSCoords: (lat: number, lon: number, placeName: string) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      saved: [],
      active: null,
      setActive: (location) => set({ active: location }),
      addSaved: (location) =>
        set((s) => {
          // Avoid duplicates by id
          const exists = s.saved.some((l) => l.id === location.id);
          if (exists) return s;
          return { saved: [...s.saved, location] };
        }),
      removeSaved: (id) =>
        set((s) => {
          const newSaved = s.saved.filter((l) => l.id !== id);
          const newActive =
            s.active?.id === id ? (newSaved[0] ?? null) : s.active;
          return { saved: newSaved, active: newActive };
        }),
      updateSavedName: (id, customName) =>
        set((s) => ({
          saved: s.saved.map((l) => (l.id === id ? { ...l, customName } : l)),
          active:
            s.active?.id === id ? { ...s.active, customName } : s.active,
        })),
      updateGPSCoords: (lat, lon, placeName) =>
        set((s) => {
          if (!s.active?.isGPS) return s;
          const prev = s.active;
          // Only update coords if they've changed significantly (>= 0.01° ≈ 1 km).
          // This prevents spurious re-fetches caused by GPS measurement noise.
          const coordsUnchanged =
            prev.lat !== 0 &&
            Math.abs(prev.lat - lat) < 0.01 &&
            Math.abs(prev.lon - lon) < 0.01;
          if (coordsUnchanged) {
            // Update the display name only
            return prev.placeName !== placeName ? { active: { ...prev, placeName } } : s;
          }
          return { active: { ...prev, lat, lon, placeName } };
        }),
    }),
    {
      name: 'dronecast-locations',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
