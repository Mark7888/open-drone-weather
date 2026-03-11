// Scoring factor weights — must sum to 1.0
export const SCORING_WEIGHTS = {
  wind80m: 0.35,
  gust80m: 0.20,
  wind120m: 0.15,
  wind10m: 0.10,
  temperature: 0.10,
  humidity: 0.05,
  cloudCover: 0.03,
  visibility: 0.02,
} as const;

// Score-to-color thresholds
export const SCORE_COLORS = {
  excellent: { min: 85, color: '#00E5FF' },
  good: { min: 65, color: '#4CAF50' },
  marginal: { min: 40, color: '#FFC107' },
  poor: { min: 1, color: '#F44336' },
  blocked: { min: 0, color: '#B71C1C' },
} as const;

// Rain/snow/storm WMO code groups
export const WMO_RAIN_CODES = new Set([
  51, 53, 55, 56, 57,               // drizzle
  61, 63, 65, 66, 67,               // rain
  80, 81, 82,                       // rain showers
]);

export const WMO_SNOW_CODES = new Set([
  71, 73, 75, 77,                   // snow
  85, 86,                           // snow showers
]);

export const WMO_STORM_CODES = new Set([
  95, 96, 99,                       // thunderstorm
]);

export const WMO_FOG_CODES = new Set([45, 48]);

// Hard blocker: rain probability threshold (%)
export const RAIN_PROBABILITY_THRESHOLD = 40;

// Visibility thresholds (metres)
export const VISIBILITY_GOOD = 5000;
export const VISIBILITY_MINIMUM = 1000;

// 120m warning: within this fraction of limit
export const WIND_120M_WARNING_FACTOR = 0.85;
