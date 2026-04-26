import { create } from 'zustand';
import { MapLayer, MapDisplayMode, WindAltitude, GridPoint, MapGridTile } from '../types';
import { buildGridPoints, fetchGridWeather, stepDegForZoom } from '../lib/api/openMeteoGrid';
import { readMapCache, readFreshMapCache, writeMapCache } from '../lib/cache/mapCache';
import { toDateString } from '../lib/utils/time';

/** Standard web-mercator tile math */
function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

function tileToLon(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function makeTileKey(zoom: number, x: number, y: number): string {
  return `${zoom}_${x}_${y}`;
}

interface MapState {
  // UI selections
  selectedLayer: MapLayer;
  selectedDate: string;
  selectedHour: number;
  displayMode: MapDisplayMode;
  windAltitude: WindAltitude;

  // Loaded data (keyed by tile key)
  tiles: Record<string, GridPoint[]>;
  loadingKeys: Set<string>;

  // Actions
  setLayer: (layer: MapLayer) => void;
  setDate: (date: string) => void;
  setHour: (hour: number) => void;
  setDisplayMode: (mode: MapDisplayMode) => void;
  setWindAltitude: (alt: WindAltitude) => void;
  loadRegion: (
    latMin: number,
    latMax: number,
    lonMin: number,
    lonMax: number,
    zoom: number
  ) => Promise<void>;
}

function getInitialHour(): number {
  return new Date().getHours();
}

// Module-level abort controller map for in-flight requests
const abortControllers = new Map<string, AbortController>();

export const useMapStore = create<MapState>()((set, get) => ({
  selectedLayer: 'wind_80m',
  selectedDate: toDateString(new Date()),
  selectedHour: getInitialHour(),
  displayMode: 'raw',
  windAltitude: '80m',
  tiles: {},
  loadingKeys: new Set(),

  setLayer: (layer) => set({ selectedLayer: layer }),
  setDate: (date) => set({ selectedDate: date }),
  setHour: (hour) => set({ selectedHour: hour }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setWindAltitude: (alt) => set({ windAltitude: alt }),

  loadRegion: async (latMin, latMax, lonMin, lonMax, zoom) => {
    const tileZoom = Math.max(5, Math.min(11, Math.round(zoom)));
    const stepDeg = stepDegForZoom(tileZoom);

    // Determine which tiles cover this bounding box
    const xMin = lonToTileX(lonMin, tileZoom);
    const xMax = lonToTileX(lonMax, tileZoom);
    const yMin = latToTileY(latMax, tileZoom); // note: y is inverted
    const yMax = latToTileY(latMin, tileZoom);

    const tilesToLoad: Array<{ key: string; zoom: number; x: number; y: number }> = [];

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const key = makeTileKey(tileZoom, x, y);
        const { tiles, loadingKeys } = get();
        if (tiles[key] || loadingKeys.has(key)) continue;
        tilesToLoad.push({ key, zoom: tileZoom, x, y });
      }
    }

    if (tilesToLoad.length === 0) return;

    // Mark all as loading
    set((s) => {
      const next = new Set(s.loadingKeys);
      for (const t of tilesToLoad) next.add(t.key);
      return { loadingKeys: next };
    });

    await Promise.all(
      tilesToLoad.map(async ({ key, zoom: tz, x, y }) => {
        try {
          // Check fresh cache first
          const fresh = await readFreshMapCache(key);
          if (fresh) {
            set((s) => {
              const next = new Set(s.loadingKeys);
              next.delete(key);
              return { tiles: { ...s.tiles, [key]: fresh.points }, loadingKeys: next };
            });
            return;
          }

          // Check stale cache — use immediately while fetching fresh data
          const stale = await readMapCache(key);
          if (stale) {
            set((s) => ({ tiles: { ...s.tiles, [key]: stale.points } }));
          }

          // Abort any previous request for this tile
          abortControllers.get(key)?.abort();
          const controller = new AbortController();
          abortControllers.set(key, controller);

          // Compute bounding box for this tile
          const tileLonMin = tileToLon(x, tz);
          const tileLonMax = tileToLon(x + 1, tz);
          const tileLatMax = tileToLat(y, tz);
          const tileLatMin = tileToLat(y + 1, tz);

          const pts = buildGridPoints(tileLatMin, tileLatMax, tileLonMin, tileLonMax, stepDeg);
          if (pts.length === 0) return;

          const points = await fetchGridWeather(pts, 16, controller.signal);

          const tile: MapGridTile = {
            key,
            zoom: tz,
            tileX: x,
            tileY: y,
            fetchedAt: Date.now(),
            points,
          };
          writeMapCache(tile);

          set((s) => {
            const next = new Set(s.loadingKeys);
            next.delete(key);
            return { tiles: { ...s.tiles, [key]: points }, loadingKeys: next };
          });
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          console.warn(`Failed to load map tile ${key}:`, e);
          set((s) => {
            const next = new Set(s.loadingKeys);
            next.delete(key);
            return { loadingKeys: next };
          });
        } finally {
          abortControllers.delete(key);
        }
      })
    );
  },
}));
