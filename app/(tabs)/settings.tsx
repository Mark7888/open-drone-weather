import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settingsStore';
import { useWeatherStore } from '../../store/weatherStore';
import { getColors } from '../../theme/colors';
import { clearAllCache, getCacheInfo } from '../../lib/cache/weatherCache';
import { formatCacheTime } from '../../lib/utils/time';
import { ThemeOverride, TemperatureUnit, WindUnit, DistanceUnit } from '../../types';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const systemScheme = useColorScheme();
  const { themeOverride, goldenHourEnabled, nightFlyingEnabled, units, setThemeOverride, setGoldenHourEnabled, setNightFlyingEnabled, setTemperatureUnit, setWindUnit, setDistanceUnit } = useSettingsStore();
  const colors = getColors(themeOverride, systemScheme);
  const lastFetched = useWeatherStore((s) => s.lastFetched);

  const [cacheInfo, setCacheInfo] = useState<{ lastUpdated: number | null; fileCount: number }>({ lastUpdated: null, fileCount: 0 });

  useEffect(() => {
    const info = getCacheInfo();
    setCacheInfo(info);
  }, []);

  async function handleClearCache() {
    Alert.alert(
      'Clear weather cache',
      'This will delete all cached weather data. Forecasts will reload from the internet on next open.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearAllCache();
            useWeatherStore.setState({ data: null, lastFetched: null });
            const info = getCacheInfo();
            setCacheInfo(info);
            Alert.alert('Done', 'Weather cache cleared.');
          },
        },
      ]
    );
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.titleBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView>
        {/* DISPLAY */}
        <SectionHeader label="Display" colors={colors} />

        <SettingRow
          label="Theme"
          colors={colors}
        >
          <SegmentedControl
            options={[
              { label: 'System', value: 'system' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ]}
            selected={themeOverride}
            onChange={(v) => setThemeOverride(v as ThemeOverride)}
            colors={colors}
          />
        </SettingRow>

        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Show Golden Hour</Text>
          <Switch
            value={goldenHourEnabled}
            onValueChange={setGoldenHourEnabled}
            trackColor={{ true: colors.tabBarActive }}
          />
        </View>

        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Enable Night Flying</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              When off, night hours are blocked
            </Text>
          </View>
          <Switch
            value={nightFlyingEnabled}
            onValueChange={setNightFlyingEnabled}
            trackColor={{ true: colors.tabBarActive }}
          />
        </View>

        {/* UNITS */}
        <SectionHeader label="Units" colors={colors} />

        <SettingRow label="Temperature" colors={colors}>
          <SegmentedControl
            options={[
              { label: '°C', value: 'C' },
              { label: '°F', value: 'F' },
            ]}
            selected={units.temperature}
            onChange={(v) => setTemperatureUnit(v as TemperatureUnit)}
            colors={colors}
          />
        </SettingRow>

        <SettingRow label="Wind Speed" colors={colors}>
          <SegmentedControl
            options={[
              { label: 'km/h', value: 'kmh' },
              { label: 'm/s', value: 'ms' },
              { label: 'mph', value: 'mph' },
            ]}
            selected={units.wind}
            onChange={(v) => setWindUnit(v as WindUnit)}
            colors={colors}
          />
        </SettingRow>

        <SettingRow label="Distance" colors={colors}>
          <SegmentedControl
            options={[
              { label: 'km', value: 'km' },
              { label: 'mi', value: 'mi' },
            ]}
            selected={units.distance}
            onChange={(v) => setDistanceUnit(v as DistanceUnit)}
            colors={colors}
          />
        </SettingRow>

        {/* DATA & CACHE */}
        <SectionHeader label="Data & Cache" colors={colors} />

        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Cache status</Text>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>
            {cacheInfo.lastUpdated
              ? `Updated ${formatCacheTime(cacheInfo.lastUpdated)}`
              : 'No cache'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.actionRow, { borderBottomColor: colors.border }]}
          onPress={handleClearCache}
        >
          <MaterialCommunityIcons name="delete-sweep-outline" size={18} color="#F44336" />
          <Text style={[styles.actionLabel, { color: '#F44336' }]}>Clear weather cache</Text>
        </TouchableOpacity>

        {/* ABOUT */}
        <SectionHeader label="About" colors={colors} />

        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Version</Text>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{appVersion}</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionRow, { borderBottomColor: colors.border }]}
          onPress={() => Linking.openURL('https://open-meteo.com/')}
        >
          <MaterialCommunityIcons name="open-in-new" size={16} color={colors.tabBarActive} />
          <Text style={[styles.actionLabel, { color: colors.tabBarActive }]}>
            Weather data by Open-Meteo
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{label}</Text>
  );
}

function SettingRow({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
      {children}
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  selected,
  onChange,
  colors,
}: {
  options: { label: string; value: T }[];
  selected: T;
  onChange: (v: T) => void;
  colors: any;
}) {
  return (
    <View style={[styles.segmented, { borderColor: colors.border }]}>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.segmentItem,
            i < options.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border },
            selected === opt.value && { backgroundColor: colors.tabBarActive },
          ]}
          onPress={() => onChange(opt.value)}
        >
          <Text
            style={[
              styles.segmentText,
              { color: selected === opt.value ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleBar: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  screenTitle: { fontSize: 20, fontWeight: '700' },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLabel: { fontSize: 14, flex: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoValue: { fontSize: 13 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { fontSize: 14 },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 7,
    overflow: 'hidden',
  },
  segmentItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmentText: { fontSize: 12, fontWeight: '500' },
});
