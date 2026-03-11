import { ThemeOverride } from '../types';

export const ScoreColors = {
  excellent: '#00E5FF',
  good: '#4CAF50',
  marginal: '#FFC107',
  poor: '#F44336',
  blocked: '#B71C1C',
};

const light = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFA',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  border: '#E0E0E0',
  todayBorder: '#2196F3',
  pastOverlay: 'rgba(0,0,0,0.35)',
  noDataFill: '#E0E0E0',
  tabBar: '#FFFFFF',
  tabBarActive: '#2196F3',
  tabBarInactive: '#999999',
};

const dark = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#2C2C2C',
  textPrimary: '#F0F0F0',
  textSecondary: '#AAAAAA',
  border: '#333333',
  todayBorder: '#64B5F6',
  pastOverlay: 'rgba(0,0,0,0.50)',
  noDataFill: '#2A2A2A',
  tabBar: '#1E1E1E',
  tabBarActive: '#64B5F6',
  tabBarInactive: '#666666',
};

export type ColorTheme = typeof light;

export function getColors(override: ThemeOverride, systemScheme: string | null | undefined): ColorTheme {
  if (override === 'light') return light;
  if (override === 'dark') return dark;
  return systemScheme === 'dark' ? dark : light;
}

export { light as lightColors, dark as darkColors };
