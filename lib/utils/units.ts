import { TemperatureUnit, WindUnit, DistanceUnit } from '../../types';

// Temperature
export function convertTemperature(celsius: number, unit: TemperatureUnit): number {
  if (unit === 'F') return Math.round((celsius * 9) / 5 + 32);
  return Math.round(celsius * 10) / 10;
}

export function temperatureLabel(unit: TemperatureUnit): string {
  return unit === 'F' ? '°F' : '°C';
}

// Wind speed
export function convertWind(kmh: number, unit: WindUnit): number {
  if (unit === 'ms') return Math.round((kmh / 3.6) * 10) / 10;
  if (unit === 'mph') return Math.round(kmh * 0.621371 * 10) / 10;
  return Math.round(kmh * 10) / 10;
}

export function windLabel(unit: WindUnit): string {
  if (unit === 'ms') return 'm/s';
  if (unit === 'mph') return 'mph';
  return 'km/h';
}

// Distance / visibility
export function convertDistance(metres: number, unit: DistanceUnit): number {
  if (unit === 'mi') return Math.round(metres * 0.000621371 * 100) / 100;
  return Math.round((metres / 1000) * 100) / 100; // km
}

export function distanceLabel(unit: DistanceUnit): string {
  return unit === 'mi' ? 'mi' : 'km';
}

export function formatVisibility(metres: number, unit: DistanceUnit): string {
  if (unit === 'mi') {
    const miles = metres * 0.000621371;
    return miles > 1 ? `${miles.toFixed(1)} mi` : `${Math.round(metres * 3.28084)} ft`;
  }
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}
