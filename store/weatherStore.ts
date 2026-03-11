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
  return `${lat.toFixed(4)}_${lon.toFixed(4)}`;
}

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

    // Always attempt background fetch
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
