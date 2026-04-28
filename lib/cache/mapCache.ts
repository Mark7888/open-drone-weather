import { File, Paths } from 'expo-file-system';
import { GridPoint } from '../../types';

// Grid weather data is cached for 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedGridData {
  points: GridPoint[];
  fetchedAt: number;
}

function gridCacheKey(lat: number, lon: number): string {
  // ~1km precision for grid point keys
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

function gridCacheFileName(lat: number, lon: number): string {
  return `grid_${gridCacheKey(lat, lon)}.json`;
}

function getCacheFile(lat: number, lon: number): File {
  return new File(Paths.cache, gridCacheFileName(lat, lon));
}

export async function readGridCache(lat: number, lon: number): Promise<GridPoint | null> {
  try {
    const file = getCacheFile(lat, lon);
    if (!file.exists) return null;
    const contents = await file.text();
    const cached: CachedGridData = JSON.parse(contents);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached.points[0] ?? null;
  } catch {
    return null;
  }
}

export async function readGridCacheMulti(
  points: { lat: number; lon: number }[],
): Promise<Map<string, GridPoint>> {
  const result = new Map<string, GridPoint>();
  await Promise.all(
    points.map(async (pt) => {
      const cached = await readGridCache(pt.lat, pt.lon);
      if (cached) {
        result.set(gridCacheKey(pt.lat, pt.lon), cached);
      }
    }),
  );
  return result;
}

export function writeGridCache(points: GridPoint[]): void {
  for (const point of points) {
    try {
      const file = getCacheFile(point.lat, point.lon);
      const data: CachedGridData = { points: [point], fetchedAt: point.fetchedAt };
      file.write(JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to write grid cache', e);
    }
  }
}

export function clearGridCache(): void {
  try {
    const items = Paths.cache.list();
    for (const item of items) {
      if (item instanceof File && item.name.startsWith('grid_') && item.name.endsWith('.json')) {
        item.delete();
      }
    }
  } catch (e) {
    console.warn('Failed to clear grid cache', e);
  }
}

export function getGridCacheKey(lat: number, lon: number): string {
  return gridCacheKey(lat, lon);
}
