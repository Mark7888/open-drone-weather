import { WeatherData, HourlyWeather } from '../../types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    country_code?: string;
  };
}

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
    ].join(','),
    timezone: 'auto',
    forecast_days: '16',
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
  });

  const url = `${BASE_URL}?${params.toString().replace(/%2C/gi, ',')}`;
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
    humidity: h.relative_humidity_2m[i] ?? 0,
    precipitationProbability: h.precipitation_probability[i] ?? 0,
    precipitation: h.precipitation[i] ?? 0,
    weatherCode: h.weather_code[i] ?? 0,
    cloudCover: h.cloud_cover[i] ?? 0,
    visibility: h.visibility[i] ?? 10000,
    windSpeed10m: h.wind_speed_10m[i] ?? 0,
    windSpeed80m: h.wind_speed_80m[i] ?? 0,
    windSpeed120m: h.wind_speed_120m[i] ?? 0,
    windGust10m: h.wind_gusts_10m[i] ?? 0,
    windGust80m: h.wind_gusts_10m[i] ?? 0,  // API no longer provides gusts at 80m; use surface gusts as proxy
    windDirection10m: h.wind_direction_10m[i] ?? 0,
    windDirection80m: h.wind_direction_80m[i] ?? 0,
    windDirection120m: h.wind_direction_120m[i] ?? 0,
  }));

  return {
    location: { lat, lon, name: locationName },
    fetchedAt: Date.now(),
    hourly,
  };
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ q: query.trim(), format: 'json', limit: '10', addressdetails: '1' });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'OpenDroneWeather' },
  });
  if (!response.ok) return [];
  const json: NominatimResult[] = await response.json();
  return json.map((item) => ({
    id: item.place_id,
    name: item.display_name.split(',')[0].trim(),
    country: item.address.country ?? '',
    country_code: item.address.country_code?.toUpperCase() ?? '',
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    admin1: item.address.city ?? item.address.town ?? item.address.village,
  }));
}
