import wmoDescriptions from '../../constants/wmoDescriptions.json';

type WmoEntry = {
  day: { description: string; image: string };
  night: { description: string; image: string };
};

const WMO_DATA = wmoDescriptions as Record<string, WmoEntry>;

/**
 * Maps an OWM image URL (e.g. "http://...01d@2x.png") to a MaterialCommunityIcons name.
 * The day/night variant is derived from the URL's 'd'/'n' suffix.
 */
function owmImageToIcon(imageUrl: string): string {
  const isNight = imageUrl.includes('n@');
  if (imageUrl.includes('01')) return isNight ? 'weather-night' : 'weather-sunny';
  if (imageUrl.includes('02')) return isNight ? 'weather-night-partly-cloudy' : 'weather-partly-cloudy';
  if (imageUrl.includes('03') || imageUrl.includes('04')) return 'weather-cloudy';
  if (imageUrl.includes('09')) return 'weather-rainy';
  if (imageUrl.includes('10')) return 'weather-pouring';
  if (imageUrl.includes('11')) return 'weather-lightning';
  if (imageUrl.includes('13')) return 'weather-snowy';
  if (imageUrl.includes('50')) return 'weather-fog';
  return 'weather-cloudy';
}

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
  const entry = WMO_DATA[String(code)];
  if (!entry) {
    return { description: `WMO code ${code}`, icon: 'weather-cloudy' };
  }
  const variant = isNight ? entry.night : entry.day;
  return {
    description: variant.description,
    icon: owmImageToIcon(variant.image),
  };
}
