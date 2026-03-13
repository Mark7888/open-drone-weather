import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { DroneProfile } from '../types';
import dronePresetsData from '../constants/dronePresets.json';

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

const allPresetsData: DroneProfile[] = dronePresetsData as DroneProfile[];
const dronePresets: DroneProfile[] = allPresetsData.filter((p) => p.isPreset);
const defaultCustomProfiles: DroneProfile[] = allPresetsData.filter((p) => !p.isPreset);
const defaultActiveDroneId = dronePresets[0]?.id ?? defaultCustomProfiles[0]?.id ?? '';

function getCustomProfiles(profiles: DroneProfile[] = []): DroneProfile[] {
  return profiles.filter((profile) => !profile.isPreset);
}

function buildProfiles(customProfiles: DroneProfile[]): DroneProfile[] {
  return [...dronePresets, ...customProfiles];
}

function resolveActiveDroneId(activeDroneId: string | undefined, profiles: DroneProfile[]): string {
  if (activeDroneId && profiles.some((profile) => profile.id === activeDroneId)) {
    return activeDroneId;
  }

  return profiles[0]?.id ?? '';
}

interface DroneState {
  profiles: DroneProfile[];
  activeDroneId: string;
  setActiveDrone: (id: string) => void;
  addProfile: (profile: DroneProfile) => void;
  updateProfile: (id: string, updates: Partial<DroneProfile>) => void;
  deleteProfile: (id: string) => void;
  duplicatePreset: (id: string) => void;
}

export const useDroneStore = create<DroneState>()(
  persist(
    (set, get) => ({
      profiles: buildProfiles(defaultCustomProfiles),
      activeDroneId: defaultActiveDroneId,
      setActiveDrone: (id) => set({ activeDroneId: id }),
      addProfile: (profile) => set((s) => ({ profiles: [...s.profiles, profile] })),
      updateProfile: (id, updates) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deleteProfile: (id) =>
        set((s) => {
          const newProfiles = s.profiles.filter((p) => p.id !== id);
          const newActiveId =
            s.activeDroneId === id ? (newProfiles[0]?.id ?? '') : s.activeDroneId;
          return { profiles: newProfiles, activeDroneId: newActiveId };
        }),
      duplicatePreset: (id) => {
        const original = get().profiles.find((p) => p.id === id);
        if (!original) return;
        const newProfile: DroneProfile = {
          ...original,
          id: `custom-${Date.now()}`,
          name: `${original.name} (Custom)`,
          isPreset: false,
        };
        set((s) => ({ profiles: [...s.profiles, newProfile] }));
      },
    }),
    {
      name: 'dronecast-drones',
      storage: createJSONStorage(() => secureStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<DroneState> | undefined;
        // First run (nothing persisted yet): seed with non-preset defaults from JSON.
        // Subsequent runs: use only what was persisted (respects deletions/edits).
        const customProfiles =
          persisted?.profiles === undefined
            ? defaultCustomProfiles
            : getCustomProfiles(Array.isArray(persisted.profiles) ? persisted.profiles : []);
        const profiles = buildProfiles(customProfiles);

        return {
          ...currentState,
          profiles,
          activeDroneId: resolveActiveDroneId(persisted?.activeDroneId, profiles),
        };
      },
      partialize: (s) => ({
        profiles: getCustomProfiles(s.profiles),
        activeDroneId: s.activeDroneId,
      }),
    }
  )
);
