import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWeatherStore } from '../../store/weatherStore';
import { useDroneStore } from '../../store/droneStore';
import { useLocationStore, GPS_LOCATION } from '../../store/locationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getColors } from '../../theme/colors';
import { scoreDay, getBestDay, getGoodDays } from '../../lib/calc/flightScore';
import { getMondayOfWeek, toDateString, addDays, isPastDay, isSameDay, formatDateLong, formatCacheTime } from '../../lib/utils/time';
import { scoreToColor } from '../../lib/utils/scoreColors';
import { DaySummary } from '../../types';
import * as Location from 'expo-location';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 8;
const DAY_GAP_H = 2;
const DAY_GAP_V = 3;
const DAYS_PER_ROW = 7;
const HEADER_ROW_HEIGHT = 20;
const DAY_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - DAY_GAP_H * (DAYS_PER_ROW - 1)) / DAYS_PER_ROW;

export default function CalendarScreen() {
  const { t } = useTranslation();
  const WEEKDAYS = [
    t('forecast.weekdays.mon'),
    t('forecast.weekdays.tue'),
    t('forecast.weekdays.wed'),
    t('forecast.weekdays.thu'),
    t('forecast.weekdays.fri'),
    t('forecast.weekdays.sat'),
    t('forecast.weekdays.sun'),
  ];
  const router = useRouter();
  const systemScheme = useColorScheme();
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  const nightFlyingEnabled = useSettingsStore((s) => s.nightFlyingEnabled);
  const hideDronePresets = useSettingsStore((s) => s.hideDronePresets);
  const colors = getColors(themeOverride, systemScheme);

  const weatherData = useWeatherStore((s) => s.data);
  const isLoading = useWeatherStore((s) => s.isLoading);
  const weatherError = useWeatherStore((s) => s.error);
  const lastFetched = useWeatherStore((s) => s.lastFetched);
  const fetchWeather = useWeatherStore((s) => s.fetch);
  const forceRefresh = useWeatherStore((s) => s.forceRefresh);

  const profiles = useDroneStore((s) => s.profiles);
  const activeDroneId = useDroneStore((s) => s.activeDroneId);
  const activeDrone = profiles.find((p) => p.id === activeDroneId) ?? profiles[0];
  const visibleProfiles = hideDronePresets ? profiles.filter((p) => !p.isPreset) : profiles;

  const activeLocation = useLocationStore((s) => s.active);
  const setActive = useLocationStore((s) => s.setActive);
  const updateGPSCoords = useLocationStore((s) => s.updateGPSCoords);

  const [dronePickerOpen, setDronePickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // On mount: if no active location, use GPS placeholder
  useEffect(() => {
    if (!activeLocation) {
      setActive(GPS_LOCATION);
    }
  }, []);

  // Resolve GPS location when it's active
  useEffect(() => {
    if (activeLocation?.isGPS) {
      resolveGPSLocation();
    }
  }, [activeLocation?.id]);

  async function resolveGPSLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      updateGPSCoords(latitude, longitude, 'My Location');
    } catch {
      // GPS unavailable — keep last known
    }
  }

  // Fetch weather when active location has valid coords
  useEffect(() => {
    if (activeLocation && (activeLocation.lat !== 0 || activeLocation.lon !== 0)) {
      fetchWeather(activeLocation).catch(() => setIsOffline(true));
    }
  }, [activeLocation?.lat, activeLocation?.lon]);

  const onRefresh = useCallback(async () => {
    if (!activeLocation) return;
    setRefreshing(true);
    try {
      await forceRefresh(activeLocation);
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    } finally {
      setRefreshing(false);
    }
  }, [activeLocation, forceRefresh]);

  // Build the 21-day grid starting from this week's Monday
  const today = new Date();
  const gridStartMonday = getMondayOfWeek(today);
  const gridDates: Date[] = Array.from({ length: 21 }, (_, i) => addDays(gridStartMonday, i));

  // Compute day summaries from weather data
  const daySummaries = useMemo(() => {
    if (!weatherData || !activeDrone) return new Map<string, DaySummary>();
    const map = new Map<string, DaySummary>();
    for (const date of gridDates) {
      const dateStr = toDateString(date);
      const summary = scoreDay(dateStr, weatherData.hourly, activeDrone, weatherData.location.lat, weatherData.location.lon, nightFlyingEnabled);
      map.set(dateStr, summary);
    }
    return map;
  }, [weatherData, activeDrone, nightFlyingEnabled]);

  // Best day
  const bestDay = useMemo(() => {
    const summaries = Array.from(daySummaries.values()).filter(
      (s) => !isPastDay(new Date(s.date + 'T00:00:00'))
    );
    return getBestDay(summaries);
  }, [daySummaries]);

  // Other good days (score avg >= 65, excluding best day)
  const goodDays = useMemo(() => {
    const summaries = Array.from(daySummaries.values()).filter(
      (s) => !isPastDay(new Date(s.date + 'T00:00:00'))
    );
    return getGoodDays(summaries, bestDay);
  }, [daySummaries, bestDay]);

  const hasData = weatherData !== null;
  const noDataAndNoConnection = !hasData && isOffline && !isLoading;

  if (noDataAndNoConnection) {
    return <NoDataScreen onRetry={() => activeLocation && fetchWeather(activeLocation)} colors={colors} />;
  }

  function renderDayRect(date: Date, index: number) {
    const dateStr = toDateString(date);
    const summary = daySummaries.get(dateStr);
    const past = isPastDay(date);
    const isToday = isSameDay(date, today);
    const hasWeather = !!summary && summary.hourScores.length > 0;
    const beyond16Days = !hasWeather && !past;

    // Compute gradient stops from hourly scores.
    // When night flying is disabled, only render the daytime hours (dawn–dusk)
    // and let them stretch (flex: 1 each) to fill the full rectangle height.
    const gradientColors = summary
      ? nightFlyingEnabled
        ? summary.hourScores.map((h) => scoreToColor(h.score))
        : (() => {
            const dawnHour = summary.dawn.getHours();
            const duskHour = summary.dusk.getHours();
            const daytime = summary.hourScores.filter(
              (h) => h.hour >= dawnHour && h.hour <= duskHour
            );
            return daytime.length > 0
              ? daytime.map((h) => scoreToColor(h.score))
              : summary.hourScores.map((h) => scoreToColor(h.score));
          })()
      : null;

    const interactive = !past && hasWeather;

    return (
      <TouchableOpacity
        key={dateStr}
        activeOpacity={interactive ? 0.7 : 1}
        onPress={() => interactive && router.push(`/day/${dateStr}`)}
        style={[
          styles.dayRect,
          {
            width: DAY_WIDTH,
            borderColor: isToday ? colors.todayBorder : 'transparent',
            borderWidth: isToday ? 2 : 0,
          },
        ]}
      >
        {/* Background gradient simulation using segments */}
        {gradientColors && !past ? (
          <View style={styles.gradientContainer}>
            {gradientColors.map((color, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor: color,
                }}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.gradientContainer,
              {
                backgroundColor: past
                  ? colors.noDataFill
                  : colors.noDataFill,
              },
            ]}
          />
        )}

        {/* Past overlay */}
        {past && (
          <View style={[styles.overlay, { backgroundColor: colors.pastOverlay }]} />
        )}

        {/* Day number badge */}
        <Text
          style={[
            styles.dayNumber,
            { color: past ? colors.textSecondary : '#FFFFFF' },
          ]}
        >
          {date.getDate()}
        </Text>
      </TouchableOpacity>
    );
  }

  const locationDisplayName =
    activeLocation?.customName ?? activeLocation?.placeName ?? t('forecast.selectLocation');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Location Selector */}
        <TouchableOpacity
          style={styles.locationRow}
          onPress={() => router.push('/location-search')}
        >
          <MaterialCommunityIcons name="map-marker" size={18} color={colors.tabBarActive} />
          <View style={styles.locationTextContainer}>
            <Text style={[styles.locationPrimary, { color: colors.textPrimary }]} numberOfLines={1}>
              {locationDisplayName}
            </Text>
            {activeLocation?.customName && (
              <Text style={[styles.locationSecondary, { color: colors.textSecondary }]} numberOfLines={1}>
                {activeLocation.placeName}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Drone Selector */}
        <TouchableOpacity
          style={[styles.droneRow, { borderTopColor: colors.border }]}
          onPress={() => setDronePickerOpen((v) => !v)}
        >
          <MaterialCommunityIcons name="quadcopter" size={18} color={colors.tabBarActive} />
          <Text style={[styles.droneName, { color: colors.textPrimary }]} numberOfLines={1}>
            {activeDrone?.name ?? t('forecast.selectDrone')}
          </Text>
          <MaterialCommunityIcons
            name={dronePickerOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Drone Picker Dropdown */}
        {dronePickerOpen && (
          <View style={[styles.dronePicker, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {visibleProfiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.dronePickerItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  useDroneStore.getState().setActiveDrone(p.id);
                  // Keep the dropdown open so the user sees their selection
                }}
              >
                <Text style={[styles.dronePickerText, { color: p.id === activeDroneId ? colors.tabBarActive : colors.textPrimary }]}>
                  {p.name}
                </Text>
                {p.id === activeDroneId && (
                  <MaterialCommunityIcons name="check" size={16} color={colors.tabBarActive} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loading indicator */}
        {isLoading && !refreshing && (
          <ActivityIndicator style={styles.loader} size="small" color={colors.tabBarActive} />
        )}

        {/* Offline banner */}
        {isOffline && hasData && (
          <View style={[styles.offlineBanner, { backgroundColor: colors.surfaceElevated }]}>
            <MaterialCommunityIcons name="wifi-off" size={14} color={colors.textSecondary} />
            <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
              {lastFetched
                ? t('forecast.offlineBanner', { time: formatCacheTime(lastFetched) })
                : t('forecast.offlineBannerNoTime')}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tabBarActive}
          />
        }
      >
        {/* Weekday headers */}
        <View style={[styles.weekdayRow, { paddingHorizontal: GRID_PADDING }]}>
          {WEEKDAYS.map((day) => (
            <Text
              key={day}
              style={[
                styles.weekdayLabel,
                { width: DAY_WIDTH, color: colors.textSecondary },
              ]}
            >
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={[styles.grid, { paddingHorizontal: GRID_PADDING }]}>
          {[0, 1, 2].map((weekIndex) => (
            <View key={weekIndex} style={[styles.weekRow, { marginBottom: weekIndex < 2 ? DAY_GAP_V : 0 }]}>
              {gridDates.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={{ width: DAY_GAP_H }} />}
                  {renderDayRect(date, weekIndex * 7 + i)}
                </React.Fragment>
              ))}
            </View>
          ))}
        </View>

        {/* Best day banner + good days list */}
        <View style={[styles.bestDayBanner, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {bestDay ? (
            <View style={styles.bestDayContent}>
              <MaterialCommunityIcons name="star" size={16} color="#FFC107" />
              <Text style={[styles.bestDayText, { color: colors.textPrimary }]}>
                {t('forecast.bestDayToFly')}{' '}
                <Text style={{ fontWeight: '600' }}>
                  {formatDateLong(new Date(bestDay.date + 'T12:00:00'))}
                </Text>
              </Text>
            </View>
          ) : (
            <View style={styles.bestDayContent}>
              <MaterialCommunityIcons name="weather-cloudy" size={16} color={colors.textSecondary} />
              <Text style={[styles.bestDayText, { color: colors.textSecondary }]}>
                {t('forecast.noneGoodToFly')}
              </Text>
            </View>
          )}

          {goodDays.length > 0 && (
            <View style={styles.goodDaysList}>
              <Text style={[styles.goodDaysHeader, { color: colors.textSecondary }]}>
                {t('forecast.alsoGoodToFly')}
              </Text>
              {goodDays.map((day) => (
                <View key={day.date} style={styles.goodDayRow}>
                  <MaterialCommunityIcons name="check-circle-outline" size={13} color="#4CAF50" />
                  <Text style={[styles.goodDayText, { color: colors.textPrimary }]}>
                    {formatDateLong(new Date(day.date + 'T12:00:00'))}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function NoDataScreen({ onRetry, colors }: { onRetry: () => void; colors: any }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.noDataContainer, { backgroundColor: colors.background }]}>
      <MaterialCommunityIcons name="cloud-off-outline" size={72} color={colors.textSecondary} />
      <Text style={[styles.noDataTitle, { color: colors.textPrimary }]}>{t('forecast.noForecastTitle')}</Text>
      <Text style={[styles.noDataBody, { color: colors.textSecondary }]}>
        {t('forecast.noForecastBody')}
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: colors.tabBarActive }]}
        onPress={onRetry}
      >
        <Text style={styles.retryButtonText}>{t('forecast.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const DAY_HEIGHT = 70;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 48,
    paddingBottom: 4,
    borderBottomWidth: 1,
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  locationTextContainer: { flex: 1 },
  locationPrimary: { fontSize: 15, fontWeight: '600' },
  locationSecondary: { fontSize: 12, marginTop: 1 },
  droneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  droneName: { flex: 1, fontSize: 14 },
  dronePicker: {
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 100,
  },
  dronePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dronePickerText: { fontSize: 14 },
  loader: { position: 'absolute', right: 16, top: 56 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  offlineText: { fontSize: 12 },
  scrollView: { flex: 1 },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  grid: { gap: 0 },
  weekRow: {
    flexDirection: 'row',
  },
  dayRect: {
    height: DAY_HEIGHT,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dayNumber: {
    position: 'absolute',
    top: 3,
    right: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  bestDayBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
  bestDayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bestDayText: { fontSize: 13 },
  goodDaysList: {
    marginTop: 10,
    gap: 4,
  },
  goodDaysHeader: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  goodDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goodDayText: { fontSize: 13 },
  noDataContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  noDataTitle: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  noDataBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
