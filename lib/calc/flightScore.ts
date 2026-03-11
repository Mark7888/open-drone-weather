import { HourlyWeather, DroneProfile, HourScore, FactorScore, BlockerReason, DaySummary } from '../../types';
import {
  SCORING_WEIGHTS,
  WMO_RAIN_CODES,
  WMO_SNOW_CODES,
  WMO_STORM_CODES,
  RAIN_PROBABILITY_THRESHOLD,
  VISIBILITY_GOOD,
  VISIBILITY_MINIMUM,
  WIND_120M_WARNING_FACTOR,
} from '../../constants/scoring';
import { getSunTimes } from './sunCalc';
import { toDateString } from '../utils/time';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function linearDecay(value: number, perfectMax: number, zeroAt: number): number {
  if (value <= perfectMax) return 100;
  if (value >= zeroAt) return 0;
  return 100 * (1 - (value - perfectMax) / (zeroAt - perfectMax));
}

function calcWindSubScore(speed: number, maxSpeed: number): number {
  return clamp(linearDecay(speed, 0, maxSpeed), 0, 100);
}

function calcTemperatureSubScore(temp: number, drone: DroneProfile): number {
  const optimalCenter = (drone.optimalTempMin + drone.optimalTempMax) / 2;
  const optimalRange = (drone.optimalTempMax - drone.optimalTempMin) * 0.4;
  if (Math.abs(temp - optimalCenter) <= optimalRange) return 100;
  // Linear decay toward min/max
  if (temp < optimalCenter) {
    return clamp(linearDecay(optimalCenter - temp, optimalRange, optimalCenter - drone.minTemperature), 0, 100);
  } else {
    return clamp(linearDecay(temp - optimalCenter, optimalRange, drone.maxTemperature - optimalCenter), 0, 100);
  }
}

function calcHumiditySubScore(humidity: number, maxHumidity: number): number {
  if (humidity <= 60) return 100;
  if (humidity >= maxHumidity) return 0;
  return clamp(100 * (1 - (humidity - 60) / (maxHumidity - 60)), 0, 100);
}

function calcCloudSubScore(cloudCover: number): number {
  // 0% → 100, 100% → 60
  return 100 - (cloudCover / 100) * 40;
}

function calcVisibilitySubScore(visibility: number): number {
  if (visibility >= VISIBILITY_GOOD) return 100;
  if (visibility <= VISIBILITY_MINIMUM) return 0;
  return clamp(100 * (visibility - VISIBILITY_MINIMUM) / (VISIBILITY_GOOD - VISIBILITY_MINIMUM), 0, 100);
}

export function scoreHour(weather: HourlyWeather, drone: DroneProfile): HourScore {
  const hour = new Date(weather.time).getHours();
  const blockerReasons: BlockerReason[] = [];

  // Step 1: Hard blockers
  const isRainCode =
    WMO_RAIN_CODES.has(weather.weatherCode) ||
    WMO_SNOW_CODES.has(weather.weatherCode) ||
    WMO_STORM_CODES.has(weather.weatherCode);

  if (weather.precipitationProbability >= RAIN_PROBABILITY_THRESHOLD || isRainCode) {
    if (weather.precipitationProbability >= RAIN_PROBABILITY_THRESHOLD) {
      blockerReasons.push({
        factor: 'Rain probability',
        rawValue: weather.precipitationProbability,
        threshold: RAIN_PROBABILITY_THRESHOLD,
        unit: '%',
      });
    }
    if (isRainCode) {
      blockerReasons.push({
        factor: 'Weather condition',
        rawValue: weather.weatherCode,
        threshold: 0,
        unit: 'WMO code',
      });
    }
  }

  if (weather.windSpeed80m > drone.maxWindSpeed80m) {
    blockerReasons.push({
      factor: 'Wind at 80m',
      rawValue: weather.windSpeed80m,
      threshold: drone.maxWindSpeed80m,
      unit: 'km/h',
    });
  }

  if (weather.windGust80m > drone.maxGustSpeed) {
    blockerReasons.push({
      factor: 'Wind gust at 80m',
      rawValue: weather.windGust80m,
      threshold: drone.maxGustSpeed,
      unit: 'km/h',
    });
  }

  if (weather.temperature < drone.minTemperature) {
    blockerReasons.push({
      factor: 'Temperature too cold',
      rawValue: weather.temperature,
      threshold: drone.minTemperature,
      unit: '°C',
    });
  }

  if (weather.temperature > drone.maxTemperature) {
    blockerReasons.push({
      factor: 'Temperature too hot',
      rawValue: weather.temperature,
      threshold: drone.maxTemperature,
      unit: '°C',
    });
  }

  if (blockerReasons.length > 0) {
    return { hour, score: 0, blocked: true, blockerReasons, factorBreakdown: [], warn120m: false };
  }

  // Step 2: Soft scoring
  const factors: FactorScore[] = [
    {
      factor: 'Wind at 80m',
      rawValue: weather.windSpeed80m,
      subScore: calcWindSubScore(weather.windSpeed80m, drone.maxWindSpeed80m),
      weight: SCORING_WEIGHTS.wind80m,
      contribution: 0,
    },
    {
      factor: 'Gusts at 80m',
      rawValue: weather.windGust80m,
      subScore: calcWindSubScore(weather.windGust80m, drone.maxGustSpeed),
      weight: SCORING_WEIGHTS.gust80m,
      contribution: 0,
    },
    {
      factor: 'Wind at 120m',
      rawValue: weather.windSpeed120m,
      subScore: calcWindSubScore(weather.windSpeed120m, drone.maxWindSpeed120m),
      weight: SCORING_WEIGHTS.wind120m,
      contribution: 0,
    },
    {
      factor: 'Wind at surface',
      rawValue: weather.windSpeed10m,
      subScore: calcWindSubScore(weather.windSpeed10m, drone.maxWindSpeed10m),
      weight: SCORING_WEIGHTS.wind10m,
      contribution: 0,
    },
    {
      factor: 'Temperature',
      rawValue: weather.temperature,
      subScore: calcTemperatureSubScore(weather.temperature, drone),
      weight: SCORING_WEIGHTS.temperature,
      contribution: 0,
    },
    {
      factor: 'Humidity',
      rawValue: weather.humidity,
      subScore: calcHumiditySubScore(weather.humidity, drone.maxHumidity),
      weight: SCORING_WEIGHTS.humidity,
      contribution: 0,
    },
    {
      factor: 'Cloud cover',
      rawValue: weather.cloudCover,
      subScore: calcCloudSubScore(weather.cloudCover),
      weight: SCORING_WEIGHTS.cloudCover,
      contribution: 0,
    },
    {
      factor: 'Visibility',
      rawValue: weather.visibility,
      subScore: calcVisibilitySubScore(weather.visibility),
      weight: SCORING_WEIGHTS.visibility,
      contribution: 0,
    },
  ];

  let total = 0;
  for (const f of factors) {
    f.contribution = f.subScore * f.weight;
    total += f.contribution;
  }
  const score = Math.round(total);

  // Step 3: 120m warning
  const warn120m =
    score > 0 && weather.windSpeed120m > drone.maxWindSpeed80m * WIND_120M_WARNING_FACTOR;

  return { hour, score, blocked: false, blockerReasons: [], factorBreakdown: factors, warn120m };
}

export function scoreDay(
  dateStr: string,
  hourlyWeather: HourlyWeather[],
  drone: DroneProfile,
  lat: number,
  lon: number
): DaySummary {
  const date = new Date(dateStr + 'T12:00:00');
  const sunTimes = getSunTimes(date, lat, lon);

  const dayHourly = hourlyWeather.filter((h) => h.time.startsWith(dateStr));
  const hourScores = dayHourly.map((h) => scoreHour(h, drone));

  const sunriseHour = sunTimes.sunrise.getHours();
  const sunsetHour = sunTimes.sunset.getHours();

  // Best window: longest contiguous run with score >= 65 between sunrise and sunset
  const daytimeScores = hourScores.filter((h) => h.hour >= sunriseHour && h.hour <= sunsetHour);

  let bestWindowStart: number | null = null;
  let bestWindowEnd: number | null = null;
  let bestWindowScore: number | null = null;

  let runStart = -1;
  let runLen = 0;
  let bestRunStart = -1;
  let bestRunLen = 0;

  for (const hs of daytimeScores) {
    if (hs.score >= 65) {
      if (runStart === -1) runStart = hs.hour;
      runLen++;
      if (runLen > bestRunLen) {
        bestRunLen = runLen;
        bestRunStart = runStart;
      }
    } else {
      runStart = -1;
      runLen = 0;
    }
  }

  if (bestRunLen > 0) {
    bestWindowStart = bestRunStart;
    bestWindowEnd = bestRunStart + bestRunLen - 1;
    const windowScores = hourScores.filter(
      (h) => h.hour >= bestWindowStart! && h.hour <= bestWindowEnd!
    );
    bestWindowScore =
      windowScores.length > 0
        ? Math.round(windowScores.reduce((s, h) => s + h.score, 0) / windowScores.length)
        : null;
  } else {
    // Find highest single hour
    let best = daytimeScores.reduce<HourScore | null>((prev, cur) => {
      if (!prev || cur.score > prev.score) return cur;
      return prev;
    }, null);
    if (best) {
      bestWindowStart = best.hour;
      bestWindowEnd = best.hour;
      bestWindowScore = best.score;
    }
  }

  return {
    date: dateStr,
    hourScores,
    bestWindowStart,
    bestWindowEnd,
    bestWindowScore,
    ...sunTimes,
  };
}

/**
 * Returns the "best day" across an array of DaySummary values —
 * the day with the highest average score between sunrise and sunset.
 */
export function getBestDay(summaries: DaySummary[]): DaySummary | null {
  let best: DaySummary | null = null;
  let bestAvg = -1;

  for (const summary of summaries) {
    const sunriseHour = summary.sunrise.getHours();
    const sunsetHour = summary.sunset.getHours();
    const daytime = summary.hourScores.filter(
      (h) => h.hour >= sunriseHour && h.hour <= sunsetHour
    );
    if (daytime.length === 0) continue;
    const avg = daytime.reduce((s, h) => s + h.score, 0) / daytime.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = summary;
    }
  }

  return best;
}
