// Drone Profile
export interface DroneProfile {
  id: string;
  name: string;
  isPreset: boolean;
  maxWindSpeed10m: number;   // km/h
  maxWindSpeed80m: number;   // km/h
  maxWindSpeed120m: number;  // km/h
  maxGustSpeed: number;      // km/h
  minTemperature: number;    // °C
  maxTemperature: number;    // °C
  maxHumidity: number;       // % RH
  optimalTempMin: number;    // °C
  optimalTempMax: number;    // °C
}

// Weather
export interface HourlyWeather {
  time: string;                     // ISO8601
  temperature: number;              // °C
  humidity: number;                 // %
  precipitationProbability: number; // %
  precipitation: number;            // mm
  weatherCode: number;              // WMO code
  cloudCover: number;               // %
  visibility: number;               // metres
  windSpeed10m: number;             // km/h
  windSpeed80m: number;             // km/h
  windSpeed120m: number;            // km/h
  windGust10m: number;              // km/h
  windGust80m: number;              // km/h
  windDirection80m: number;         // degrees
}

export interface WeatherData {
  location: { lat: number; lon: number; name: string };
  fetchedAt: number; // unix ms
  hourly: HourlyWeather[]; // up to 16 days × 24 hours
}

// Scoring
export interface BlockerReason {
  factor: string;
  rawValue: number;
  threshold: number;
  unit: string;
}

export interface FactorScore {
  factor: string;
  rawValue: number;
  subScore: number;
  weight: number;
  contribution: number;
}

export interface HourScore {
  hour: number;           // 0–23
  score: number;          // 0–100
  blocked: boolean;
  blockerReasons: BlockerReason[];
  factorBreakdown: FactorScore[];
  warn120m: boolean;
}

// Computed per-day summary
export interface DaySummary {
  date: string; // YYYY-MM-DD
  hourScores: HourScore[];
  bestWindowStart: number | null; // hour 0–23
  bestWindowEnd: number | null;
  bestWindowScore: number | null;
  sunrise: Date;
  sunset: Date;
  dawn: Date;
  dusk: Date;
  goldenHourMorningEnd: Date;
  goldenHourEveningStart: Date;
}

// Locations
export interface SavedLocation {
  id: string;
  customName: string | null;
  placeName: string;
  countryCode: string;
  lat: number;
  lon: number;
  isGPS: boolean;
}

// Units
export type TemperatureUnit = 'C' | 'F';
export type WindUnit = 'kmh' | 'ms' | 'mph';
export type DistanceUnit = 'km' | 'mi';
export type ThemeOverride = 'system' | 'light' | 'dark';

export interface UnitsSettings {
  temperature: TemperatureUnit;
  wind: WindUnit;
  distance: DistanceUnit;
}
