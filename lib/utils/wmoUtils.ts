type WmoVariant = { description: string; icon: string };
type WmoEntry = { day: WmoVariant; night: WmoVariant };

/** Creates an entry where the day and night variants differ. */
const e = (dayDesc: string, nightDesc: string, dayIcon: string, nightIcon: string): WmoEntry => ({
  day: { description: dayDesc, icon: dayIcon },
  night: { description: nightDesc, icon: nightIcon },
});

/** Creates an entry where the day and night variants are the same. */
const es = (description: string, icon: string): WmoEntry =>
  e(description, description, icon, icon);

/** WMO weather code → day/night description and MaterialCommunityIcons icon name. */
const WMO_DATA: Record<number, WmoEntry> = {
  0:  e('Sunny',        'Clear',        'weather-sunny',         'weather-night'),
  1:  e('Mainly Sunny', 'Mainly Clear', 'weather-sunny',         'weather-night'),
  2:  e('Partly Cloudy','Partly Cloudy','weather-partly-cloudy', 'weather-night-partly-cloudy'),
  3:  es('Cloudy',                      'weather-cloudy'),
  45: es('Foggy',                       'weather-fog'),
  48: es('Rime Fog',                    'weather-fog'),
  51: es('Light Drizzle',               'weather-rainy'),
  53: es('Drizzle',                     'weather-rainy'),
  55: es('Heavy Drizzle',               'weather-rainy'),
  56: es('Light Freezing Drizzle',      'weather-rainy'),
  57: es('Freezing Drizzle',            'weather-rainy'),
  61: es('Light Rain',                  'weather-pouring'),
  63: es('Rain',                        'weather-pouring'),
  65: es('Heavy Rain',                  'weather-pouring'),
  66: es('Light Freezing Rain',         'weather-pouring'),
  67: es('Freezing Rain',               'weather-pouring'),
  71: es('Light Snow',                  'weather-snowy'),
  73: es('Snow',                        'weather-snowy'),
  75: es('Heavy Snow',                  'weather-snowy'),
  77: es('Snow Grains',                 'weather-snowy'),
  80: es('Light Showers',               'weather-rainy'),
  81: es('Showers',                     'weather-rainy'),
  82: es('Heavy Showers',               'weather-rainy'),
  85: es('Light Snow Showers',          'weather-snowy'),
  86: es('Snow Showers',                'weather-snowy'),
  95: es('Thunderstorm',                'weather-lightning'),
  96: es('Light Thunderstorms With Hail','weather-lightning'),
  99: es('Thunderstorm With Hail',      'weather-lightning'),
};

/**
 * Returns the human-readable description and MaterialCommunityIcons icon name
 * for a given WMO weather code.
 *
 * @param code    WMO weather code
 * @param isNight Whether to use the night-time variant (default: false)
 */
export function getWmoInfo(
  code: number,
  isNight: boolean = false
): { description: string; icon: string } {
  const entry = WMO_DATA[code];
  if (!entry) {
    return { description: `WMO ${code}`, icon: 'weather-cloudy' };
  }
  return isNight ? entry.night : entry.day;
}
