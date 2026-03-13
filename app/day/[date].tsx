import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useWeatherStore } from '../../store/weatherStore';
import { useDroneStore } from '../../store/droneStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getColors } from '../../theme/colors';
import { scoreDay } from '../../lib/calc/flightScore';
import { scoreToColor, scoreToLabel } from '../../lib/utils/scoreColors';
import { fromDateString, formatDateLong, formatTime, hourFraction } from '../../lib/utils/time';
import { convertTemperature, temperatureLabel, convertWind, windLabel, formatVisibility } from '../../lib/utils/units';
import { FactorScore, BlockerReason } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STRIP_HEIGHT = SCREEN_HEIGHT * 0.45;
const STRIP_WIDTH = SCREEN_WIDTH;
const POINTER_CONTAINER_HEIGHT = 28;
const POINTER_LINE_HEIGHT = 2;
const POINTER_LINE_OFFSET = (POINTER_CONTAINER_HEIGHT - POINTER_LINE_HEIGHT) / 2;

export default function DayDetailScreen() {
  const { date: dateStr } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const systemScheme = useColorScheme();
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  const goldenHourEnabled = useSettingsStore((s) => s.goldenHourEnabled);
  const nightFlyingEnabled = useSettingsStore((s) => s.nightFlyingEnabled);
  const units = useSettingsStore((s) => s.units);
  const colors = getColors(themeOverride, systemScheme);
  const insets = useSafeAreaInsets();

  const weatherData = useWeatherStore((s) => s.data);
  const profiles = useDroneStore((s) => s.profiles);
  const activeDroneId = useDroneStore((s) => s.activeDroneId);
  const activeDrone = profiles.find((p) => p.id === activeDroneId) ?? profiles[0];

  const [pointerHour, setPointerHour] = useState<number>(() => {
    const now = new Date();
    const dateObj = fromDateString(dateStr ?? '');
    if (
      dateObj.toDateString() === now.toDateString()
    ) {
      return now.getHours();
    }
    return 12;
  });
  const [pointerMinute, setPointerMinute] = useState(0);
  const [showCalcExplainer, setShowCalcExplainer] = useState(false);
  const [warn120mTooltipVisible, setWarn120mTooltipVisible] = useState(false);

  const summary = useMemo(() => {
    if (!weatherData || !activeDrone || !dateStr) return null;
    return scoreDay(dateStr, weatherData.hourly, activeDrone, weatherData.location.lat, weatherData.location.lon, nightFlyingEnabled);
  }, [weatherData, activeDrone, dateStr, nightFlyingEnabled]);

  const pointerY = useSharedValue(
    summary ? (pointerHour / 24) * STRIP_HEIGHT : STRIP_HEIGHT * 0.5
  );

  const updatePointerFromY = useCallback(
    (y: number) => {
      const clamped = Math.max(0, Math.min(STRIP_HEIGHT, y));
      const fraction = clamped / STRIP_HEIGHT;
      const totalMinutes = Math.round(fraction * 1440);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      setPointerHour(h);
      setPointerMinute(m);
    },
    [STRIP_HEIGHT]
  );

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const newY = Math.max(0, Math.min(STRIP_HEIGHT, e.y));
      pointerY.value = newY;
      scheduleOnRN(updatePointerFromY, newY);
    })
    .onUpdate((e) => {
      const newY = Math.max(0, Math.min(STRIP_HEIGHT, e.y));
      pointerY.value = newY;
      scheduleOnRN(updatePointerFromY, newY);
    });

  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pointerY.value - POINTER_LINE_OFFSET }],
  }));

  if (!summary || !activeDrone) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.noDataText, { color: colors.textSecondary }]}>No data for this day.</Text>
      </View>
    );
  }

  // Interpolate score/data at current pointer time
  const exactFraction = (pointerHour * 60 + pointerMinute) / 1440;
  const hourIndex = Math.min(Math.floor(pointerHour), 23);
  const currentHourScore = summary.hourScores[hourIndex] ?? summary.hourScores[0];

  // Get hourly weather for the pointer hour
  const hourlyForDay = weatherData!.hourly.filter((h) => h.time.startsWith(dateStr!));
  const hourlyEntry = hourlyForDay[hourIndex] ?? hourlyForDay[0];

  const bestWindowLabel =
    summary.bestWindowStart !== null && summary.bestWindowEnd !== null
      ? `${String(summary.bestWindowStart).padStart(2, '0')}:00 – ${String(summary.bestWindowEnd).padStart(2, '0')}:00`
      : null;

  const sunriseY = hourFraction(summary.sunrise) * STRIP_HEIGHT;
  const sunsetY = hourFraction(summary.sunset) * STRIP_HEIGHT;
  const dawnY = hourFraction(summary.dawn) * STRIP_HEIGHT;
  const duskY = hourFraction(summary.dusk) * STRIP_HEIGHT;
  const goldenMorningY = hourFraction(summary.goldenHourMorningEnd) * STRIP_HEIGHT;
  const goldenEveningY = hourFraction(summary.goldenHourEveningStart) * STRIP_HEIGHT;

  function displayWind(kmh: number) {
    return `${convertWind(kmh, units.wind).toFixed(1)} ${windLabel(units.wind)}`;
  }
  function displayTemp(c: number) {
    return `${convertTemperature(c, units.temperature)} ${temperatureLabel(units.temperature)}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerDate, { color: colors.textPrimary }]}>
            {formatDateLong(fromDateString(dateStr ?? ''))}
          </Text>
          {bestWindowLabel && (
            <View style={[styles.bestWindowChip, { backgroundColor: scoreToColor(summary.bestWindowScore ?? 0) + '33', borderColor: scoreToColor(summary.bestWindowScore ?? 0) }]}>
              <Text style={[styles.bestWindowText, { color: scoreToColor(summary.bestWindowScore ?? 0) }]}>
                Best: {bestWindowLabel}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: Math.max(20, insets.bottom + 12) }}
      >
        {/* Timeline Strip */}
        <GestureDetector gesture={panGesture}>
        <View style={[styles.stripContainer, { height: STRIP_HEIGHT }]}>
          {/* Gradient segments */}
          <View style={styles.stripGradient}>
            {summary.hourScores.map((hs, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: (i / 24) * STRIP_HEIGHT,
                  height: STRIP_HEIGHT / 24,
                  left: 0,
                  right: 0,
                  backgroundColor: scoreToColor(hs.score),
                }}
              />
            ))}
          </View>

          {/* Night overlays — solid blocks from midnight-to-dawn and dusk-to-midnight */}
          <View style={[styles.nightOverlay, { top: 0, height: dawnY, opacity: nightFlyingEnabled ? 0.4 : 0.85 }]} />
          <View style={[styles.nightOverlay, { top: duskY, height: Math.max(0, STRIP_HEIGHT - duskY), opacity: nightFlyingEnabled ? 0.4 : 0.85 }]} />

          {/* Sun event markers */}
          <SunMarker y={sunriseY} label={`Sunrise ${formatTime(summary.sunrise)}`} icon="weather-sunset-up" color="#FFD54F" />
          <SunMarker y={sunsetY} label={`Sunset ${formatTime(summary.sunset)}`} icon="weather-sunset-down" color="#FF8A65" />
          <SunMarker y={dawnY} label={`Dawn ${formatTime(summary.dawn)}`} icon="weather-night" color="rgba(180,180,255,0.7)" dashed />
          <SunMarker y={duskY} label={`Dusk ${formatTime(summary.dusk)}`} icon="weather-night" color="rgba(180,180,255,0.7)" dashed />

          {goldenHourEnabled && (
            <>
              <SunMarker y={goldenMorningY} label={`Golden hour ends ${formatTime(summary.goldenHourMorningEnd)}`} icon="white-balance-sunny" color="#FFB300" />
              <SunMarker y={goldenEveningY} label={`Golden hour starts ${formatTime(summary.goldenHourEveningStart)}`} icon="white-balance-sunny" color="#FFB300" />
            </>
          )}

          {/* Pointer */}
          <Animated.View style={[styles.pointerContainer, pointerStyle]}>
            <Text style={styles.pointerTimeLabel}>
              {String(pointerHour).padStart(2, '0')}:{String(pointerMinute).padStart(2, '0')}
            </Text>
            <View style={[styles.pointerLine, { backgroundColor: '#FFFFFF' }]} />
          </Animated.View>
        </View>
        </GestureDetector>

        {/* Data Panel */}
        <View style={[styles.dataPanel, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {/* Overall score */}
          <View style={styles.overallScoreRow}>
            <Text style={[styles.overallScoreValue, { color: colors.textPrimary }]}>
              {currentHourScore.score} / 100
            </Text>
            <View style={[styles.scoreChip, { backgroundColor: scoreToColor(currentHourScore.score) }]}>
              <Text style={styles.scoreChipText}>{scoreToLabel(currentHourScore.score)}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Factor rows */}
          {currentHourScore.factorBreakdown.map((f) => (
            <FactorRow key={f.factor} factor={f} colors={colors} units={units} warn120m={f.factor === 'Wind at 120m' && currentHourScore.warn120m} onWarnTap={() => setWarn120mTooltipVisible(true)} />
          ))}

          {currentHourScore.blocked && currentHourScore.factorBreakdown.length === 0 && (
            <View style={styles.noFactorsNote}>
              <Text style={[styles.noFactorsText, { color: colors.textSecondary }]}>
                Score calculation stopped due to blockers below.
              </Text>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Blockers */}
          {currentHourScore.blocked ? (
            currentHourScore.blockerReasons.map((b, i) => (
              <BlockerRow key={i} blocker={b} colors={colors} />
            ))
          ) : (
            <View style={styles.noBlockerRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#4CAF50" />
              <Text style={[styles.noBlockerText, { color: colors.textSecondary }]}>No blockers active</Text>
            </View>
          )}

          {/* How calculated? */}
          {!currentHourScore.blocked && currentHourScore.factorBreakdown.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.explainerHeader}
                onPress={() => setShowCalcExplainer((v) => !v)}
              >
                <Text style={[styles.explainerTitle, { color: colors.textSecondary }]}>
                  How was this calculated?
                </Text>
                <MaterialCommunityIcons
                  name={showCalcExplainer ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              {showCalcExplainer && (
                <View style={styles.explainerContent}>
                  {currentHourScore.factorBreakdown.map((f) => (
                    <View key={f.factor} style={styles.explainerRow}>
                      <Text style={[styles.explainerFactor, { color: colors.textPrimary }]}>{f.factor}</Text>
                      <Text style={[styles.explainerDetail, { color: colors.textSecondary }]}>
                        sub-score {Math.round(f.subScore)} × {(f.weight * 100).toFixed(0)}% = {f.contribution.toFixed(1)}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={[styles.explainerRow, { marginTop: 4 }]}>
                    <Text style={[styles.explainerFactor, { color: colors.textPrimary, fontWeight: '700' }]}>
                      Total Score
                    </Text>
                    <Text style={[styles.explainerFactor, { color: scoreToColor(currentHourScore.score), fontWeight: '700' }]}>
                      {currentHourScore.score}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* 120m warning tooltip */}
      <Modal transparent visible={warn120mTooltipVisible} animationType="fade" onRequestClose={() => setWarn120mTooltipVisible(false)}>
        <TouchableOpacity style={styles.tooltipOverlay} onPress={() => setWarn120mTooltipVisible(false)}>
          <View style={[styles.tooltipBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="alert" size={20} color="#FFC107" />
            <Text style={[styles.tooltipText, { color: colors.textPrimary }]}>
              Conditions at 120m are near the limit for this drone. Avoid flying at maximum altitude.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function SunMarker({ y, label, icon, color, dashed }: { y: number; label: string; icon: string; color: string; dashed?: boolean }) {
  return (
    <View style={[styles.sunMarker, { top: y }]} pointerEvents="none">
      <View style={[
        styles.sunMarkerLine,
        { backgroundColor: color, borderStyle: dashed ? 'dashed' : 'solid' },
      ]} />
      <MaterialCommunityIcons name={icon as any} size={12} color={color} style={styles.sunIcon} />
      <Text style={[styles.sunLabel, { color }]}>{label}</Text>
    </View>
  );
}

function FactorRow({ factor, colors, units, warn120m, onWarnTap }: {
  factor: FactorScore;
  colors: any;
  units: any;
  warn120m: boolean;
  onWarnTap: () => void;
}) {
  const barFill = Math.round(factor.subScore);

  function displayValue() {
    if (factor.factor.includes('Wind') || factor.factor.includes('Gust')) {
      return `${convertWind(factor.rawValue, units.wind).toFixed(1)} ${windLabel(units.wind)}`;
    }
    if (factor.factor === 'Temperature') {
      return `${convertTemperature(factor.rawValue, units.temperature)} ${temperatureLabel(units.temperature)}`;
    }
    if (factor.factor === 'Humidity') return `${Math.round(factor.rawValue)} %`;
    if (factor.factor === 'Cloud cover') return `${Math.round(factor.rawValue)} %`;
    if (factor.factor === 'Visibility') return formatVisibility(factor.rawValue, units.distance);
    return String(factor.rawValue);
  }

  return (
    <View style={styles.factorRow}>
      <Text style={[styles.factorName, { color: colors.textSecondary }]} numberOfLines={1}>
        {factor.factor}
      </Text>
      <Text style={[styles.factorValue, { color: colors.textPrimary }]} numberOfLines={1}>
        {displayValue()}
      </Text>
      <View style={[styles.factorBarBg, { backgroundColor: colors.border }]}>
        <View style={[styles.factorBarFill, { width: `${barFill}%`, backgroundColor: scoreToColor(barFill) }]} />
      </View>
      <Text style={[styles.factorScore, { color: colors.textPrimary }]}>{Math.round(factor.subScore)}</Text>
      {warn120m ? (
        <TouchableOpacity onPress={onWarnTap} style={styles.warnBtn}>
          <MaterialCommunityIcons name="alert" size={14} color="#FFC107" />
        </TouchableOpacity>
      ) : (
        <View style={styles.warnBtn} />
      )}
    </View>
  );
}

function BlockerRow({ blocker, colors }: { blocker: BlockerReason; colors: any }) {
  return (
    <View style={styles.blockerRow}>
      <MaterialCommunityIcons name="cancel" size={14} color="#F44336" />
      <Text style={[styles.blockerText, { color: '#F44336' }]}>
        BLOCKED: {blocker.factor} {blocker.rawValue.toFixed(1)}{blocker.unit} {blocker.threshold > 0 ? `(≥ ${blocker.threshold}${blocker.unit})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, gap: 6 },
  headerDate: { fontSize: 17, fontWeight: '600' },
  bestWindowChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  bestWindowText: { fontSize: 12, fontWeight: '600' },
  scrollView: { flex: 1 },
  stripContainer: {
    width: STRIP_WIDTH,
    overflow: 'hidden',
    position: 'relative',
  },
  stripGradient: { ...StyleSheet.absoluteFillObject },
  nightOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#000000',
  },
  sunMarker: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  sunMarkerLine: {
    height: 1,
    flex: 1,
    opacity: 0.8,
  },
  sunIcon: { marginLeft: 4 },
  sunLabel: { fontSize: 9, marginLeft: 3, marginRight: 6 },
  pointerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: POINTER_CONTAINER_HEIGHT,
    justifyContent: 'center',
  },
  pointerTimeLabel: {
    position: 'absolute',
    left: 8,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pointerLine: {
    height: POINTER_LINE_HEIGHT,
    ...StyleSheet.absoluteFillObject,
    top: POINTER_LINE_OFFSET,
    opacity: 0.9,
  },
  dataPanel: {
    borderTopWidth: 1,
    paddingBottom: 16,
  },
  overallScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  overallScoreValue: { fontSize: 22, fontWeight: '700' },
  scoreChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  factorName: { width: 100, fontSize: 12 },
  factorValue: { width: 80, fontSize: 12, textAlign: 'right' },
  factorBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  factorBarFill: { height: 6, borderRadius: 3 },
  factorScore: { width: 28, fontSize: 12, textAlign: 'right', fontWeight: '600' },
  warnBtn: { width: 18, alignItems: 'center' },
  noFactorsNote: { padding: 16 },
  noFactorsText: { fontSize: 13 },
  noBlockerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noBlockerText: { fontSize: 13 },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  blockerText: { fontSize: 13, flex: 1 },
  explainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  explainerTitle: { fontSize: 13 },
  explainerContent: { paddingHorizontal: 16, paddingBottom: 8 },
  explainerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  explainerFactor: { fontSize: 12 },
  explainerDetail: { fontSize: 12 },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  tooltipBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    maxWidth: 320,
  },
  tooltipText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  noDataText: { textAlign: 'center', marginTop: 32, fontSize: 15 },
});
