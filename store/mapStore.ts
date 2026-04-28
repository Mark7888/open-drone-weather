import { create } from 'zustand';
import { GridPoint, MapLayer, MapDisplayMode } from '../types';
import { fetchWeatherGrid } from '../lib/api/openMeteo';
import { readGridCacheMulti, writeGridCache, getGridCacheKey } from '../lib/cache/mapCache';
import { generateGrid, gridStepForZoom, expandBBox } from '../lib/utils/mapGrid';

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface MapState {
  // Active layer and display options
  activeLayer: MapLayer;
  displayMode: MapDisplayMode;

  // For wind layers: this sets the layer directly via activeLayer
  // Date/time selection
  selectedDate: string;   // 'YYYY-MM-DD'
  selectedHour: number;   // 0–23

  // Grid data: key = "lat_lon" (2dp), value = GridPoint
  gridData: Map<string, GridPoint>;

  // Loading / error state
  isLoading: boolean;
  error: string | null;

  // Last loaded bounding box and zoom
  lastBBox: BoundingBox | null;
  lastZoom: number;

  // Actions
  setActiveLayer: (layer: MapLayer) => void;
  setDisplayMode: (mode: MapDisplayMode) => void;
  setSelectedDate: (date: string) => void;
  setSelectedHour: (hour: number) => void;
  loadGrid: (bbox: BoundingBox, zoom: number, forecastDays?: number) => Promise<void>;
  getPoint: (lat: number, lon: number) => GridPoint | null;
}

// In-flight fetch tracking to avoid duplicate requests
const activeRequests = new Set<string>();

function createRequestKey(
  minLat: number, maxLat: number,
  minLon: number, maxLon: number,
  step: number,
): string {
  return `${minLat.toFixed(2)}_${maxLat.toFixed(2)}_${minLon.toFixed(2)}_${maxLon.toFixed(2)}_${step}`;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useMapStore = create<MapState>()((set, get) => ({
  activeLayer: 'windSpeed80m',
  displayMode: 'weather',
  selectedDate: todayDateString(),
  selectedHour: Math.max(0, new Date().getHours()),
  gridData: new Map(),
  isLoading: false,
  error: null,
  lastBBox: null,
  lastZoom: 9,

  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedHour: (hour) => set({ selectedHour: hour }),

  getPoint: (lat, lon) => {
    const key = getGridCacheKey(lat, lon);
    return get().gridData.get(key) ?? null;
  },

  loadGrid: async (bbox, zoom, forecastDays = 7) => {
    const step = gridStepForZoom(zoom);

    // Expand the bounding box so panning feels seamless
    const expanded = expandBBox(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon, 0.3);
    const allPoints = generateGrid(
      expanded.minLat,
      expanded.maxLat,
      expanded.minLon,
      expanded.maxLon,
      step,
    );

    if (allPoints.length === 0) return;

    // Read cached points first
    const existing = get().gridData;
    const cached = await readGridCacheMulti(allPoints);
    let updated = false;

    const newData = new Map(existing);
    for (const [key, point] of cached.entries()) {
      if (!newData.has(key)) {
        newData.set(key, point);
        updated = true;
      }
    }
    if (updated) {
      set({ gridData: newData });
    }

    // Find points that still need fetching
    const missing = allPoints.filter((p) => {
      const key = getGridCacheKey(p.lat, p.lon);
      return !newData.has(key);
    });

    if (missing.length === 0) {
      set({ lastBBox: bbox, lastZoom: zoom });
      return;
    }

    // De-duplicate in-flight requests
    const requestKey = createRequestKey(
      expanded.minLat, expanded.maxLat,
      expanded.minLon, expanded.maxLon,
      step,
    );
    if (activeRequests.has(requestKey)) return;
    activeRequests.add(requestKey);

    set({ isLoading: true, error: null });

    try {
      const fetched = await fetchWeatherGrid(missing, forecastDays);
      writeGridCache(fetched);

      const updatedData = new Map(get().gridData);
      for (const point of fetched) {
        const key = getGridCacheKey(point.lat, point.lon);
        updatedData.set(key, point);
      }

      set({
        gridData: updatedData,
        isLoading: false,
        lastBBox: bbox,
        lastZoom: zoom,
      });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? 'Failed to load map data' });
    } finally {
      activeRequests.delete(requestKey);
    }
  },
}));
