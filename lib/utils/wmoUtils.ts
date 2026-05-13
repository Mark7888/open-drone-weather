type WmoVariant = { descriptionKey: string; icon: string };
type WmoEntry = { day: WmoVariant; night: WmoVariant };

/** Creates an entry where the day and night variants differ. */
const e = (dayKey: string, nightKey: string, dayIcon: string, nightIcon: string): WmoEntry => ({
  day: { descriptionKey: dayKey, icon: dayIcon },
  night: { descriptionKey: nightKey, icon: nightIcon },
});

/** Creates an entry where the day and night variants are the same. */
const es = (key: string, icon: string): WmoEntry =>
  e(key, key, icon, icon);

/** WMO weather code → day/night description key and MaterialCommunityIcons icon name. */
const WMO_DATA: Record<number, WmoEntry> = {
  0:  e('wmo.sunny',        'wmo.clear',        'weather-sunny',         'weather-night'),
  1:  e('wmo.mainlySunny',  'wmo.mainlyClear',  'weather-sunny',         'weather-night'),
  2:  e('wmo.partlyCloudy', 'wmo.partlyCloudy', 'weather-partly-cloudy', 'weather-night-partly-cloudy'),
  3:  es('wmo.cloudy',                           'weather-cloudy'),
  45: es('wmo.foggy',                            'weather-fog'),
  48: es('wmo.rimeFog',                          'weather-fog'),
  51: es('wmo.lightDrizzle',                     'weather-rainy'),
  53: es('wmo.drizzle',                          'weather-rainy'),
  55: es('wmo.heavyDrizzle',                     'weather-rainy'),
  56: es('wmo.lightFreezingDrizzle',             'weather-rainy'),
  57: es('wmo.freezingDrizzle',                  'weather-rainy'),
  61: es('wmo.lightRain',                        'weather-pouring'),
  63: es('wmo.rain',                             'weather-pouring'),
  65: es('wmo.heavyRain',                        'weather-pouring'),
  66: es('wmo.lightFreezingRain',                'weather-pouring'),
  67: es('wmo.freezingRain',                     'weather-pouring'),
  71: es('wmo.lightSnow',                        'weather-snowy'),
  73: es('wmo.snow',                             'weather-snowy'),
  75: es('wmo.heavySnow',                        'weather-snowy'),
  77: es('wmo.snowGrains',                       'weather-snowy'),
  80: es('wmo.lightShowers',                     'weather-rainy'),
  81: es('wmo.showers',                          'weather-rainy'),
  82: es('wmo.heavyShowers',                     'weather-rainy'),
  85: es('wmo.lightSnowShowers',                 'weather-snowy'),
  86: es('wmo.snowShowers',                      'weather-snowy'),
  95: es('wmo.thunderstorm',                     'weather-lightning'),
  96: es('wmo.lightThunderstormWithHail',        'weather-lightning'),
  99: es('wmo.thunderstormWithHail',             'weather-lightning'),
};

/**
 * Returns the i18n description key and MaterialCommunityIcons icon name
 * for a given WMO weather code.
 *
 * @param code    WMO weather code
 * @param isNight Whether to use the night-time variant (default: false)
 */
export function getWmoInfo(
  code: number,
  isNight: boolean = false
): { descriptionKey: string; icon: string } {
  const entry = WMO_DATA[code];
  if (!entry) {
    return { descriptionKey: `WMO ${code}`, icon: 'weather-cloudy' };
  }
  return isNight ? entry.night : entry.day;
}
