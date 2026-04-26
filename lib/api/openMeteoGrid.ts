import { GridPoint, HourlyWeather } from '../../types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'visibility',
  'wind_speed_10m',
  'wind_speed_80m',
  'wind_speed_120m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'wind_direction_80m',
  'wind_direction_120m',
];

// Maximum points per single API request
const MAX_BATCH_SIZE = 100;

/**
 * Generates a grid of lat/lon points covering a bounding box.
 * stepDeg is the spacing in degrees between points.
 */
export function buildGridPoints(
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number,
  stepDeg: number
): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = [];
  for (let lat = latMin; lat <= latMax + stepDeg * 0.01; lat += stepDeg) {
    for (let lon = lonMin; lon <= lonMax + stepDeg * 0.01; lon += stepDeg) {
      points.push({
        lat: Math.round(lat * 1e6) / 1e6,
        lon: Math.round(lon * 1e6) / 1e6,
      });
    }
  }
  return points;
}

/**
 * Returns the grid step in degrees appropriate for the given map zoom level.
 * Higher zoom = finer resolution.
 */
export function stepDegForZoom(zoom: number): number {
  if (zoom >= 11) return 0.05;   // ~5.5 km
  if (zoom >= 9) return 0.1;     // ~11 km
  if (zoom >= 7) return 0.2;     // ~22 km
  if (zoom >= 5) return 0.4;     // ~44 km
  return 0.8;                    // ~88 km
}

/**
 * Fetches weather data for a batch of lat/lon points from Open-Meteo.
 * Requests are batched into chunks of MAX_BATCH_SIZE to comply with API limits.
 */
export async function fetchGridWeather(
  points: Array<{ lat: number; lon: number }>,
  forecastDays: number = 16,
  signal?: AbortSignal
): Promise<GridPoint[]> {
  if (points.length === 0) return [];

  const results: GridPoint[] = [];

  // Split into batches
  for (let i = 0; i < points.length; i += MAX_BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = points.slice(i, i + MAX_BATCH_SIZE);
    const batchResults = await fetchBatch(batch, forecastDays, signal);
    results.push(...batchResults);
  }

  return results;
}

async function fetchBatch(
  points: Array<{ lat: number; lon: number }>,
  forecastDays: number,
  signal?: AbortSignal
): Promise<GridPoint[]> {
  const lats = points.map((p) => p.lat.toFixed(4)).join(',');
  const lons = points.map((p) => p.lon.toFixed(4)).join(',');

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: HOURLY_VARIABLES.join(','),
    timezone: 'UTC',
    forecast_days: String(forecastDays),
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
  });

  const url = `${BASE_URL}?${params.toString().replace(/%2C/gi, ',')}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Grid weather API error: ${response.status}`);
  }

  const json = await response.json();
  return parseGridResponse(json, points);
}

function parseGridResponse(
  json: any,
  points: Array<{ lat: number; lon: number }>
): GridPoint[] {
  // When multiple points are requested, Open-Meteo returns an array of objects.
  // When only 1 point, it returns a single object.
  const items: any[] = Array.isArray(json) ? json : [json];

  return items.map((item, idx) => {
    const h = item.hourly;
    const lat = item.latitude ?? points[idx]?.lat ?? 0;
    const lon = item.longitude ?? points[idx]?.lon ?? 0;
    const times: string[] = h.time ?? [];

    const hourly: HourlyWeather[] = times.map((time: string, i: number) => ({
      time,
      temperature: h.temperature_2m?.[i] ?? 0,
      humidity: h.relative_humidity_2m?.[i] ?? 0,
      precipitationProbability: h.precipitation_probability?.[i] ?? 0,
      precipitation: h.precipitation?.[i] ?? 0,
      weatherCode: h.weather_code?.[i] ?? 0,
      cloudCover: h.cloud_cover?.[i] ?? 0,
      visibility: h.visibility?.[i] ?? 10000,
      windSpeed10m: h.wind_speed_10m?.[i] ?? 0,
      windSpeed80m: h.wind_speed_80m?.[i] ?? 0,
      windSpeed120m: h.wind_speed_120m?.[i] ?? 0,
      windGust10m: h.wind_gusts_10m?.[i] ?? 0,
      windGust80m: h.wind_gusts_10m?.[i] ?? 0,  // API does not provide gusts at 80m; use surface gusts as proxy
      windDirection10m: h.wind_direction_10m?.[i] ?? 0,
      windDirection80m: h.wind_direction_80m?.[i] ?? 0,
      windDirection120m: h.wind_direction_120m?.[i] ?? 0,
    }));

    return { lat, lon, hourly };
  });
}
