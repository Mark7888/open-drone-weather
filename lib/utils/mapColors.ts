import { MapLayer, MapDisplayMode, DroneProfile, UnitsSettings } from '../../types';
import { scoreToColor } from './scoreColors';
import { scoreHour } from '../calc/flightScore';
import { HourlyWeather } from '../../types';
import { convertTemperature, convertWind, formatVisibility } from './units';

type RGBA = [number, number, number, number];

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a})`;
}

function interpolateRgba(stops: Array<{ at: number; color: RGBA }>, value: number): RGBA {
  if (stops.length === 0) return [0, 0, 0, 0];
  if (value <= stops[0].at) return stops[0].color;
  if (value >= stops[stops.length - 1].at) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (value >= a.at && value <= b.at) {
      const t = (value - a.at) / (b.at - a.at);
      return [
        Math.round(a.color[0] + (b.color[0] - a.color[0]) * t),
        Math.round(a.color[1] + (b.color[1] - a.color[1]) * t),
        Math.round(a.color[2] + (b.color[2] - a.color[2]) * t),
        a.color[3] + (b.color[3] - a.color[3]) * t,
      ];
    }
  }
  return stops[stops.length - 1].color;
}

// ---------------------------------------------------------------------------
// Color scales (value → RGBA)
// ---------------------------------------------------------------------------

const TEMPERATURE_STOPS: Array<{ at: number; color: RGBA }> = [
  { at: -20, color: [0, 0, 200, 0.75] },
  { at: 0,   color: [0, 180, 255, 0.75] },
  { at: 10,  color: [0, 230, 130, 0.75] },
  { at: 20,  color: [255, 230, 0, 0.75] },
  { at: 30,  color: [255, 120, 0, 0.75] },
  { at: 45,  color: [200, 0, 0, 0.75] },
];

const HUMIDITY_STOPS: Array<{ at: number; color: RGBA }> = [
  { at: 0,   color: [80, 200, 80, 0.65] },
  { at: 60,  color: [220, 220, 0, 0.70] },
  { at: 100, color: [200, 0, 0, 0.75] },
];

const CLOUD_STOPS: Array<{ at: number; color: RGBA }> = [
  { at: 0,   color: [255, 255, 255, 0.15] },
  { at: 50,  color: [160, 180, 200, 0.55] },
  { at: 100, color: [70, 80, 90, 0.80] },
];

// Visibility: metres
const VISIBILITY_STOPS: Array<{ at: number; color: RGBA }> = [
  { at: 0,     color: [200, 0, 0, 0.80] },
  { at: 1000,  color: [255, 120, 0, 0.75] },
  { at: 3000,  color: [255, 230, 0, 0.70] },
  { at: 10000, color: [0, 180, 80, 0.55] },
  { at: 50000, color: [0, 200, 255, 0.30] },
];

const RAIN_STOPS: Array<{ at: number; color: RGBA }> = [
  { at: 0,   color: [240, 240, 255, 0.20] },
  { at: 20,  color: [100, 160, 255, 0.55] },
  { at: 60,  color: [0, 80, 220, 0.75] },
  { at: 100, color: [0, 0, 140, 0.85] },
];

const WIND_STOPS: Array<{ at: number; color: RGBA }> = [
  { at: 0,   color: [50, 200, 50, 0.50] },
  { at: 15,  color: [220, 220, 0, 0.65] },
  { at: 30,  color: [255, 140, 0, 0.75] },
  { at: 50,  color: [210, 0, 0, 0.80] },
  { at: 80,  color: [160, 0, 200, 0.85] },
];

function hexToRgba(hex: string, alpha: number): RGBA {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, alpha];
}

function scoreRgba(score: number): RGBA {
  return hexToRgba(scoreToColor(score), 0.72);
}

// ---------------------------------------------------------------------------
// Public color helpers
// ---------------------------------------------------------------------------

/**
 * Returns an rgba() string for the given layer value.
 * In 'score' mode, ignores `value` and uses the scoreHour result for `weather`.
 */
export function getLayerColor(
  layer: MapLayer,
  value: number,
  displayMode: MapDisplayMode,
  weather?: HourlyWeather,
  drone?: DroneProfile
): string {
  if (displayMode === 'score' && weather && drone) {
    const hs = scoreHour(weather, drone);
    const c = scoreRgba(hs.score);
    return rgba(c[0], c[1], c[2], c[3]);
  }

  let c: RGBA;
  switch (layer) {
    case 'temperature':
      c = interpolateRgba(TEMPERATURE_STOPS, value);
      break;
    case 'humidity':
      c = interpolateRgba(HUMIDITY_STOPS, value);
      break;
    case 'cloud_cover':
      c = interpolateRgba(CLOUD_STOPS, value);
      break;
    case 'visibility':
      c = interpolateRgba(VISIBILITY_STOPS, value);
      break;
    case 'rain_probability':
      c = interpolateRgba(RAIN_STOPS, value);
      break;
    case 'wind_10m':
    case 'wind_80m':
    case 'wind_120m':
      c = interpolateRgba(WIND_STOPS, value);
      break;
    case 'flight_score':
      c = scoreRgba(value);
      break;
    default:
      c = [128, 128, 128, 0.5];
  }
  return rgba(c[0], c[1], c[2], c[3]);
}

/**
 * Extracts the numeric value for a given layer from an HourlyWeather record.
 */
export function getLayerValue(layer: MapLayer, weather: HourlyWeather, drone?: DroneProfile): number {
  switch (layer) {
    case 'temperature':      return weather.temperature;
    case 'humidity':         return weather.humidity;
    case 'cloud_cover':      return weather.cloudCover;
    case 'visibility':       return weather.visibility;
    case 'rain_probability': return weather.precipitationProbability;
    case 'wind_10m':         return weather.windSpeed10m;
    case 'wind_80m':         return weather.windSpeed80m;
    case 'wind_120m':        return weather.windSpeed120m;
    case 'flight_score':
      if (drone) return scoreHour(weather, drone).score;
      return 0;
    default:                 return 0;
  }
}

/**
 * Extracts the wind direction for the given wind layer.
 */
export function getWindDirection(layer: MapLayer, weather: HourlyWeather): number {
  if (layer === 'wind_10m') return weather.windDirection10m;
  if (layer === 'wind_120m') return weather.windDirection120m;
  return weather.windDirection80m;
}

/**
 * Returns a formatted value string with unit for map labels.
 */
export function getLayerLabel(
  layer: MapLayer,
  value: number,
  units: UnitsSettings,
  weather?: HourlyWeather
): string {
  switch (layer) {
    case 'temperature':
      return `${convertTemperature(value, units.temperature).toFixed(0)}°`;
    case 'humidity':
      return `${Math.round(value)}%`;
    case 'cloud_cover':
      return `${Math.round(value)}%`;
    case 'visibility':
      return formatVisibility(value, units.distance);
    case 'rain_probability':
      return `${Math.round(value)}%`;
    case 'wind_10m':
    case 'wind_80m':
    case 'wind_120m':
      return `${convertWind(value, units.wind).toFixed(0)}`;
    case 'flight_score':
      return `${Math.round(value)}`;
    default:
      return '';
  }
}

/**
 * Returns the display name and icon name for each layer.
 */
export const LAYER_META: Record<
  MapLayer,
  { label: string; icon: string; unit?: string }
> = {
  temperature:     { label: 'Temp',    icon: 'thermometer' },
  humidity:        { label: 'Humidity', icon: 'water-percent' },
  cloud_cover:     { label: 'Clouds',  icon: 'weather-cloudy' },
  visibility:      { label: 'Visibility', icon: 'eye' },
  rain_probability:{ label: 'Rain',    icon: 'weather-rainy' },
  wind_10m:        { label: 'Wind 10m', icon: 'weather-windy' },
  wind_80m:        { label: 'Wind 80m', icon: 'weather-windy' },
  wind_120m:       { label: 'Wind 120m', icon: 'weather-windy' },
  flight_score:    { label: 'Score',   icon: 'quadcopter' },
};

export const ALL_LAYERS: MapLayer[] = [
  'temperature',
  'humidity',
  'cloud_cover',
  'visibility',
  'rain_probability',
  'wind_10m',
  'wind_80m',
  'wind_120m',
  'flight_score',
];
