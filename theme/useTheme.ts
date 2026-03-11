import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { getColors, ColorTheme } from './colors';

export function useTheme(): ColorTheme {
  const systemScheme: string | null = useColorScheme() ?? null;
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  return getColors(themeOverride, systemScheme);
}
