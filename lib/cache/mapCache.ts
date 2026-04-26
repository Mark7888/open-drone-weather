import { File, Paths } from 'expo-file-system';
import { MapGridTile } from '../../types';

/** Cache TTL: 1 hour */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Maximum number of tiles to keep in the in-memory LRU cache */
const MAX_LRU_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory LRU cache
// ---------------------------------------------------------------------------

const lruCache = new Map<string, MapGridTile>();

function lruGet(key: string): MapGridTile | undefined {
  const tile = lruCache.get(key);
  if (tile) {
    // Re-insert to mark as most recently used
    lruCache.delete(key);
    lruCache.set(key, tile);
  }
  return tile;
}

function lruSet(key: string, tile: MapGridTile): void {
  if (lruCache.size >= MAX_LRU_SIZE) {
    // Evict least recently used (first entry)
    const firstKey = lruCache.keys().next().value;
    if (firstKey !== undefined) lruCache.delete(firstKey);
  }
  lruCache.set(key, tile);
}

// ---------------------------------------------------------------------------
// File cache helpers
// ---------------------------------------------------------------------------

function cacheFileName(key: string): string {
  // Sanitize key for use as a filename
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mapgrid_${safe}.json`;
}

function getCacheFile(key: string): File {
  return new File(Paths.cache, cacheFileName(key));
}

function isFresh(tile: MapGridTile): boolean {
  return Date.now() - tile.fetchedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a cached tile. Returns the tile (possibly stale) or null if not found.
 * Checks in-memory LRU first, falls back to file cache.
 */
export async function readMapCache(key: string): Promise<MapGridTile | null> {
  // 1. Check in-memory LRU
  const lruHit = lruGet(key);
  if (lruHit) return lruHit;

  // 2. Check file cache
  try {
    const file = getCacheFile(key);
    if (!file.exists) return null;
    const contents = await file.text();
    const tile = JSON.parse(contents) as MapGridTile;
    lruSet(key, tile);
    return tile;
  } catch {
    return null;
  }
}

/**
 * Returns a cached tile only if it is still within the TTL.
 */
export async function readFreshMapCache(key: string): Promise<MapGridTile | null> {
  const tile = await readMapCache(key);
  if (!tile) return null;
  return isFresh(tile) ? tile : null;
}

/**
 * Write a tile to both the in-memory LRU and the file cache.
 */
export function writeMapCache(tile: MapGridTile): void {
  lruSet(tile.key, tile);
  try {
    const file = getCacheFile(tile.key);
    file.write(JSON.stringify(tile));
  } catch (e) {
    console.warn('Failed to write map cache tile', e);
  }
}

/**
 * Clear all map grid cache files from disk and flush the in-memory LRU.
 */
export function clearMapCache(): void {
  lruCache.clear();
  try {
    const items = Paths.cache.list();
    for (const item of items) {
      if (item instanceof File && item.name.startsWith('mapgrid_') && item.name.endsWith('.json')) {
        item.delete();
      }
    }
  } catch (e) {
    console.warn('Failed to clear map cache', e);
  }
}

/**
 * Returns info about the map tile cache for display in Settings.
 */
export function getMapCacheInfo(): { lastUpdated: number | null; fileCount: number } {
  try {
    const items = Paths.cache.list();
    const mapFiles = items.filter(
      (item): item is File =>
        item instanceof File &&
        item.name.startsWith('mapgrid_') &&
        item.name.endsWith('.json')
    );

    if (mapFiles.length === 0) return { lastUpdated: null, fileCount: 0 };

    let latest: number | null = null;
    for (const f of mapFiles) {
      try {
        const info = f.info();
        if (info.modificationTime && (!latest || info.modificationTime > latest)) {
          latest = info.modificationTime * 1000;
        }
      } catch {
        // ignore
      }
    }

    return { lastUpdated: latest, fileCount: mapFiles.length };
  } catch {
    return { lastUpdated: null, fileCount: 0 };
  }
}
