import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';
import i18n from '../lib/i18n';
import { ThemeOverride, UnitsSettings } from '../types';

// Custom storage adapter for expo-secure-store
// SecureStore has a 2048-byte value limit per key, so we keep settings small
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

interface SettingsState {
  units: UnitsSettings;
  themeOverride: ThemeOverride;
  goldenHourEnabled: boolean;
  nightFlyingEnabled: boolean;
  hideDronePresets: boolean;
  language: string;
  setTemperatureUnit: (unit: UnitsSettings['temperature']) => void;
  setWindUnit: (unit: UnitsSettings['wind']) => void;
  setDistanceUnit: (unit: UnitsSettings['distance']) => void;
  setThemeOverride: (override: ThemeOverride) => void;
  setGoldenHourEnabled: (enabled: boolean) => void;
  setNightFlyingEnabled: (enabled: boolean) => void;
  setHideDronePresets: (enabled: boolean) => void;
  setLanguage: (lang: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      units: { temperature: 'C', wind: 'kmh', distance: 'km' },
      themeOverride: 'system',
      goldenHourEnabled: true,
      nightFlyingEnabled: false,
      hideDronePresets: false,
      language: 'system',
      setTemperatureUnit: (unit) => set((s) => ({ units: { ...s.units, temperature: unit } })),
      setWindUnit: (unit) => set((s) => ({ units: { ...s.units, wind: unit } })),
      setDistanceUnit: (unit) => set((s) => ({ units: { ...s.units, distance: unit } })),
      setThemeOverride: (override) => set({ themeOverride: override }),
      setGoldenHourEnabled: (enabled) => set({ goldenHourEnabled: enabled }),
      setNightFlyingEnabled: (enabled) => set({ nightFlyingEnabled: enabled }),
      setHideDronePresets: (enabled) => set({ hideDronePresets: enabled }),
      setLanguage: (lang) => {
        set({ language: lang });
        if (lang === 'system') {
          i18n.changeLanguage(Localization.getLocales()[0]?.languageCode ?? 'en');
        } else {
          i18n.changeLanguage(lang);
        }
      },
    }),
    {
      name: 'opendroneweather-settings',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
