import { WeatherData, HourlyWeather } from '../../types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export interface GeocodingResult {
  id: number;
  name: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  admin1?: string;
}

export async function fetchWeather(lat: number, lon: number, locationName: string): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(6),
    longitude: lon.toFixed(6),
    hourly: [
      'temperature_2m',
      'relativehumidity_2m',
      'precipitation_probability',
      'precipitation',
      'weathercode',
      'cloudcover',
      'visibility',
      'windspeed_10m',
      'windspeed_80m',
      'windspeed_120m',
      'windgusts_10m',
      'windgusts_80m',
      'winddirection_80m',
    ].join(','),
    timezone: 'auto',
    forecast_days: '16',
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
  });

  const url = `${BASE_URL}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const json = await response.json();
  return parseResponse(json, lat, lon, locationName);
}

function parseResponse(json: any, lat: number, lon: number, locationName: string): WeatherData {
  const h = json.hourly;
  const times: string[] = h.time;
  const hourly: HourlyWeather[] = times.map((time: string, i: number) => ({
    time,
    temperature: h.temperature_2m[i] ?? 0,
    humidity: h.relativehumidity_2m[i] ?? 0,
    precipitationProbability: h.precipitation_probability[i] ?? 0,
    precipitation: h.precipitation[i] ?? 0,
    weatherCode: h.weathercode[i] ?? 0,
    cloudCover: h.cloudcover[i] ?? 0,
    visibility: h.visibility[i] ?? 10000,
    windSpeed10m: h.windspeed_10m[i] ?? 0,
    windSpeed80m: h.windspeed_80m[i] ?? 0,
    windSpeed120m: h.windspeed_120m[i] ?? 0,
    windGust10m: h.windgusts_10m[i] ?? 0,
    windGust80m: h.windgusts_80m[i] ?? 0,
    windDirection80m: h.winddirection_80m[i] ?? 0,
  }));

  return {
    location: { lat, lon, name: locationName },
    fetchedAt: Date.now(),
    hourly,
  };
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ name: query.trim(), count: '10' });
  const response = await fetch(`${GEOCODING_URL}?${params.toString()}`);
  if (!response.ok) return [];
  const json = await response.json();
  return (json.results ?? []) as GeocodingResult[];
}
