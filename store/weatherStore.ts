import { create } from 'zustand';
import { WeatherData, SavedLocation } from '../types';
import { fetchWeather } from '../lib/api/openMeteo';
import { readCache, writeCache } from '../lib/cache/weatherCache';

interface WeatherState {
  data: WeatherData | null;
  locationKey: string;
  lastFetched: number | null;
  isLoading: boolean;
  error: string | null;
  fetch: (location: SavedLocation) => Promise<void>;
  forceRefresh: (location: SavedLocation) => Promise<void>;
  loadFromCache: (location: SavedLocation) => Promise<boolean>;
}

function makeKey(lat: number, lon: number): string {
  // 2 decimal places matches cache key precision
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

// Module-level lock prevents duplicate concurrent fetches for the same location
let activeFetchKey: string | null = null;

async function doFetch(location: SavedLocation): Promise<WeatherData> {
  return fetchWeather(location.lat, location.lon, location.customName ?? location.placeName);
}

export const useWeatherStore = create<WeatherState>()((set, get) => ({
  data: null,
  locationKey: '',
  lastFetched: null,
  isLoading: false,
  error: null,

  loadFromCache: async (location) => {
    const cached = await readCache(location.lat, location.lon);
    if (cached) {
      set({
        data: cached,
        locationKey: makeKey(location.lat, location.lon),
        lastFetched: cached.fetchedAt,
        error: null,
      });
      return true;
    }
    return false;
  },

  fetch: async (location) => {
    const key = makeKey(location.lat, location.lon);
    const current = get();

    // Load cache first if not already loaded for this location
    if (current.locationKey !== key) {
      const cached = await readCache(location.lat, location.lon);
      if (cached) {
        set({
          data: cached,
          locationKey: key,
          lastFetched: cached.fetchedAt,
          error: null,
        });
      }
    }

    // Prevent duplicate concurrent background fetches for the same key
    if (activeFetchKey === key) return;
    activeFetchKey = key;

    set({ isLoading: true, error: null });
    try {
      const fresh = await doFetch(location);
      writeCache(fresh);
      set({
        data: fresh,
        locationKey: key,
        lastFetched: fresh.fetchedAt,
        isLoading: false,
        error: null,
      });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? 'Failed to fetch weather' });
    } finally {
      if (activeFetchKey === key) activeFetchKey = null;
    }
  },

  forceRefresh: async (location) => {
    const key = makeKey(location.lat, location.lon);
    set({ isLoading: true, error: null });
    try {
      const fresh = await doFetch(location);
      writeCache(fresh);
      set({
        data: fresh,
        locationKey: key,
        lastFetched: fresh.fetchedAt,
        isLoading: false,
        error: null,
      });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? 'Failed to fetch weather' });
      throw e;
    }
  },
}));
