import { File, Paths } from 'expo-file-system';
import { WeatherData } from '../../types';

function locationKey(lat: number, lon: number): string {
  // 2 decimal places ≈ 1km precision — prevents cache misses from GPS drift
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

function cacheFileName(lat: number, lon: number): string {
  // No date in filename — cache is valid across days; freshness is managed via fetchedAt
  return `weather_${locationKey(lat, lon)}.json`;
}

function getCacheFile(lat: number, lon: number): File {
  return new File(Paths.cache, cacheFileName(lat, lon));
}

export async function readCache(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const file = getCacheFile(lat, lon);
    if (!file.exists) return null;
    const contents = await file.text();
    return JSON.parse(contents) as WeatherData;
  } catch {
    return null;
  }
}

export function writeCache(data: WeatherData): void {
  try {
    const file = getCacheFile(data.location.lat, data.location.lon);
    file.write(JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to write weather cache', e);
  }
}

export function clearAllCache(): void {
  try {
    const items = Paths.cache.list();
    for (const item of items) {
      if (item instanceof File && item.name.startsWith('weather_') && item.name.endsWith('.json')) {
        item.delete();
      }
    }
  } catch (e) {
    console.warn('Failed to clear weather cache', e);
  }
}

export function getCacheInfo(): { lastUpdated: number | null; fileCount: number } {
  try {
    const items = Paths.cache.list();
    const weatherFiles = items.filter(
      (item): item is File =>
        item instanceof File &&
        item.name.startsWith('weather_') &&
        item.name.endsWith('.json')
    );

    if (weatherFiles.length === 0) return { lastUpdated: null, fileCount: 0 };

    let latest: number | null = null;
    for (const f of weatherFiles) {
      try {
        const info = f.info();
        if (info.modificationTime && (!latest || info.modificationTime > latest)) {
          latest = info.modificationTime * 1000;
        }
      } catch {
        // ignore files we can't stat
      }
    }

    return { lastUpdated: latest, fileCount: weatherFiles.length };
  } catch {
    return { lastUpdated: null, fileCount: 0 };
  }
}
