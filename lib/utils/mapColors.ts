import { MapLayer } from '../../types';
import { ScoreColors } from '../../theme/colors';

/**
 * Interpolates between two hex colors by factor t in [0,1].
 */
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

function interpolate(colorA: string, colorB: string, t: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

function multiStop(stops: string[], t: number): string {
  if (stops.length === 1) return stops[0];
  const scaled = t * (stops.length - 1);
  const idx = Math.min(Math.floor(scaled), stops.length - 2);
  const localT = scaled - idx;
  return interpolate(stops[idx], stops[idx + 1], localT);
}

// Color scales for each layer (low → high value)
const TEMP_COLORS = ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'];
const HUMIDITY_COLORS = ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858'];
const CLOUD_COLORS = ['#1a1a2e', '#16213e', '#0f3460', '#457b9d', '#a8dadc', '#d8e8ed', '#e8f4f8', '#f0f8ff', '#ffffff'];
const VISIBILITY_COLORS = ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'];
const PRECIP_COLORS = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];
const WIND_COLORS = ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#8e44ad', '#2c3e50'];

export function temperatureToColor(celsius: number): string {
  const t = Math.max(0, Math.min(1, (celsius + 20) / 60)); // -20°C → 40°C range
  return multiStop(TEMP_COLORS, t);
}

export function humidityToColor(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  return multiStop(HUMIDITY_COLORS, t);
}

export function cloudCoverToColor(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  return multiStop(CLOUD_COLORS, t);
}

export function visibilityToColor(metres: number): string {
  const t = Math.max(0, Math.min(1, metres / 10000)); // 0m → 10km
  return multiStop(VISIBILITY_COLORS, t);
}

export function precipProbToColor(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  return multiStop(PRECIP_COLORS, t);
}

export function windSpeedToColor(kmh: number): string {
  const t = Math.max(0, Math.min(1, kmh / 80)); // 0 → 80 km/h
  return multiStop(WIND_COLORS, t);
}

export function scoreToMapColor(score: number): string {
  if (score >= 85) return ScoreColors.excellent;
  if (score >= 65) return ScoreColors.good;
  if (score >= 40) return ScoreColors.marginal;
  if (score >= 1) return ScoreColors.poor;
  return ScoreColors.blocked;
}

export function layerValueToColor(layer: MapLayer, value: number): string {
  switch (layer) {
    case 'temperature': return temperatureToColor(value);
    case 'humidity': return humidityToColor(value);
    case 'cloudCover': return cloudCoverToColor(value);
    case 'visibility': return visibilityToColor(value);
    case 'precipitationProbability': return precipProbToColor(value);
    case 'windSpeed10m':
    case 'windSpeed80m':
    case 'windSpeed120m': return windSpeedToColor(value);
    case 'score': return scoreToMapColor(value);
    default: return '#888888';
  }
}

export interface LayerMeta {
  label: string;
  unit: string;
  description: string;
  icon: string;
  formatValue: (v: number) => string;
  legendMin: string;
  legendMax: string;
  legendColors: string[];
}

export const LAYER_META: Record<MapLayer, LayerMeta> = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    description: 'Air temperature at 2m',
    icon: 'thermometer',
    formatValue: (v) => `${v.toFixed(0)}°C`,
    legendMin: '-20°C',
    legendMax: '40°C',
    legendColors: TEMP_COLORS,
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    description: 'Relative humidity at 2m',
    icon: 'water-percent',
    formatValue: (v) => `${v.toFixed(0)}%`,
    legendMin: '0%',
    legendMax: '100%',
    legendColors: HUMIDITY_COLORS,
  },
  cloudCover: {
    label: 'Cloud Cover',
    unit: '%',
    description: 'Total cloud cover',
    icon: 'cloud',
    formatValue: (v) => `${v.toFixed(0)}%`,
    legendMin: 'Clear',
    legendMax: 'Overcast',
    legendColors: CLOUD_COLORS,
  },
  visibility: {
    label: 'Visibility',
    unit: 'km',
    description: 'Horizontal visibility',
    icon: 'eye',
    formatValue: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}km` : `${v.toFixed(0)}m`,
    legendMin: '0km',
    legendMax: '10km',
    legendColors: VISIBILITY_COLORS,
  },
  precipitationProbability: {
    label: 'Rain Prob.',
    unit: '%',
    description: 'Precipitation probability',
    icon: 'weather-rainy',
    formatValue: (v) => `${v.toFixed(0)}%`,
    legendMin: '0%',
    legendMax: '100%',
    legendColors: PRECIP_COLORS,
  },
  windSpeed10m: {
    label: 'Wind 10m',
    unit: 'km/h',
    description: 'Wind speed at 10m altitude',
    icon: 'weather-windy',
    formatValue: (v) => `${v.toFixed(0)}`,
    legendMin: '0',
    legendMax: '80+',
    legendColors: WIND_COLORS,
  },
  windSpeed80m: {
    label: 'Wind 80m',
    unit: 'km/h',
    description: 'Wind speed at 80m altitude',
    icon: 'weather-windy',
    formatValue: (v) => `${v.toFixed(0)}`,
    legendMin: '0',
    legendMax: '80+',
    legendColors: WIND_COLORS,
  },
  windSpeed120m: {
    label: 'Wind 120m',
    unit: 'km/h',
    description: 'Wind speed at 120m altitude',
    icon: 'weather-windy',
    formatValue: (v) => `${v.toFixed(0)}`,
    legendMin: '0',
    legendMax: '80+',
    legendColors: WIND_COLORS,
  },
  score: {
    label: 'Flight Score',
    unit: '',
    description: 'Overall flight suitability score',
    icon: 'quadcopter',
    formatValue: (v) => `${v.toFixed(0)}`,
    legendMin: 'Blocked',
    legendMax: 'Excellent',
    legendColors: [ScoreColors.blocked, ScoreColors.poor, ScoreColors.marginal, ScoreColors.good, ScoreColors.excellent],
  },
};

export const WIND_LAYERS: MapLayer[] = ['windSpeed10m', 'windSpeed80m', 'windSpeed120m'];
