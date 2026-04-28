import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
} from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';
import type { NativeSyntheticEvent } from 'react-native';
import { useMapStore } from '../../store/mapStore';
import { useLocationStore } from '../../store/locationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useDroneStore } from '../../store/droneStore';
import { getColors } from '../../theme/colors';
import { MapLayer } from '../../types';
import { layerValueToColor, LAYER_META, scoreToMapColor } from '../../lib/utils/mapColors';
import { gridStepForZoom, buildGeoJSONGrid } from '../../lib/utils/mapGrid';
import { scoreHour } from '../../lib/calc/flightScore';
import { toDateString } from '../../lib/utils/time';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const ALL_LAYERS: MapLayer[] = [
  'temperature',
  'humidity',
  'cloudCover',
  'visibility',
  'precipitationProbability',
  'windSpeed10m',
  'windSpeed80m',
  'windSpeed120m',
  'score',
];

function getDateChoices(): { label: string; value: string }[] {
  const choices = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = toDateString(d);
    let label: string;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    choices.push({ label, value });
  }
  return choices;
}

export default function MapScreen() {
  const systemScheme = useColorScheme();
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  const colors = getColors(themeOverride, systemScheme);
  const insets = useSafeAreaInsets();

  const activeLocation = useLocationStore((s) => s.active);
  const profiles = useDroneStore((s) => s.profiles);
  const activeDroneId = useDroneStore((s) => s.activeDroneId);
  const activeDrone = profiles.find((p) => p.id === activeDroneId) ?? profiles[0];
  const hideDronePresets = useSettingsStore((s) => s.hideDronePresets);
  const visibleProfiles = hideDronePresets ? profiles.filter((p) => !p.isPreset) : profiles;

  const {
    activeLayer,
    displayMode,
    selectedDate,
    selectedHour,
    gridData,
    isLoading,
    error,
    setActiveLayer,
    setDisplayMode,
    setSelectedDate,
    setSelectedHour,
    loadGrid,
  } = useMapStore();

  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const [showDronePicker, setShowDronePicker] = useState(false);
  const [zoom, setZoom] = useState(9);

  const centerLat = activeLocation?.lat ?? 47.5;
  const centerLon = activeLocation?.lon ?? 19.0;

  const dateChoices = useMemo(() => getDateChoices(), []);
  const today = toDateString(new Date());
  const currentHour = new Date().getHours();

  // Build GeoJSON from grid data for current layer/date/hour
  const geoJSON = useMemo((): FeatureCollection => {
    const step = gridStepForZoom(zoom);
    const halfStep = step / 2;

    const features: { lat: number; lon: number; color: string; value: number; label: string }[] = [];

    for (const [, point] of gridData.entries()) {
      const hourWeather = point.weather.find(
        (h) =>
          h.time.startsWith(selectedDate) &&
          parseInt(h.time.slice(11, 13), 10) === selectedHour,
      );
      if (!hourWeather) continue;

      let value = 0;
      let color = '#888888';
      let label = '';

      if (displayMode === 'drone' && activeDrone) {
        const hs = scoreHour(hourWeather, activeDrone);
        value = hs.blocked ? 0 : hs.score;
        color = scoreToMapColor(value);
        label = LAYER_META['score'].formatValue(value);
      } else {
        switch (activeLayer) {
          case 'temperature': value = hourWeather.temperature; break;
          case 'humidity': value = hourWeather.humidity; break;
          case 'cloudCover': value = hourWeather.cloudCover; break;
          case 'visibility': value = hourWeather.visibility; break;
          case 'precipitationProbability': value = hourWeather.precipitationProbability; break;
          case 'windSpeed10m': value = hourWeather.windSpeed10m; break;
          case 'windSpeed80m': value = hourWeather.windSpeed80m; break;
          case 'windSpeed120m': value = hourWeather.windSpeed120m; break;
          case 'score':
            if (activeDrone) {
              const hs = scoreHour(hourWeather, activeDrone);
              value = hs.blocked ? 0 : hs.score;
            }
            break;
          default: break;
        }
        color = layerValueToColor(activeLayer, value);
        label = LAYER_META[activeLayer].formatValue(value);
      }

      features.push({ lat: point.lat, lon: point.lon, color, value, label });
    }

    return buildGeoJSONGrid(features, halfStep);
  }, [gridData, selectedDate, selectedHour, activeLayer, displayMode, activeDrone, zoom]);

  // Load grid when map region changes
  const onRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<any>) => {
      const { zoom: newZoom, bounds } = event.nativeEvent;
      if (typeof newZoom === 'number') setZoom(newZoom);
      if (bounds) {
        const [west, south, east, north] = bounds;
        loadGrid({ minLat: south, maxLat: north, minLon: west, maxLon: east }, newZoom ?? zoom);
      }
    },
    [loadGrid, zoom],
  );

  // Initial grid load
  useEffect(() => {
    const delta = 0.5;
    loadGrid(
      {
        minLat: centerLat - delta,
        maxLat: centerLat + delta,
        minLon: centerLon - delta,
        maxLon: centerLon + delta,
      },
      zoom,
    );
  // Only re-run when location changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLon]);

  const meta = LAYER_META[activeLayer];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map */}
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE}
        onRegionDidChange={onRegionDidChange}
        logoPosition={{ bottom: 8, left: 8 }}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <Camera
          initialViewState={{
            center: [centerLon, centerLat],
            zoom,
          }}
        />

        {geoJSON.features.length > 0 && (
          <GeoJSONSource id="weather-grid" data={geoJSON}>
            <Layer
              id="weather-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.5,
              }}
            />
            {zoom >= 9 && (
              <Layer
                id="weather-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'label'],
                  'text-size': zoom >= 11 ? 12 : 10,
                  'text-anchor': 'center',
                }}
                paint={{
                  'text-color': '#000000',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 1.5,
                }}
              />
            )}
          </GeoJSONSource>
        )}
      </Map>

      {/* Top: layer + mode controls */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.layerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            setShowLayerPicker((v) => !v);
            setShowDronePicker(false);
          }}
        >
          <MaterialCommunityIcons name={meta.icon as any} size={18} color={colors.tabBarActive} />
          <Text style={[styles.layerButtonText, { color: colors.textPrimary }]}>
            {displayMode === 'drone' ? `Drone Score` : meta.label}
          </Text>
          <MaterialCommunityIcons
            name={showLayerPicker ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            {
              backgroundColor: displayMode === 'drone' ? colors.tabBarActive : colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            setDisplayMode(displayMode === 'weather' ? 'drone' : 'weather');
            setShowLayerPicker(false);
            setShowDronePicker(false);
          }}
        >
          <MaterialCommunityIcons
            name="quadcopter"
            size={18}
            color={displayMode === 'drone' ? '#FFFFFF' : colors.textSecondary}
          />
        </TouchableOpacity>

        {isLoading && (
          <View style={[styles.loadingBadge, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="small" color={colors.tabBarActive} />
          </View>
        )}
      </View>

      {/* Layer picker */}
      {showLayerPicker && (
        <View style={[styles.layerPicker, { top: insets.top + 56, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {ALL_LAYERS.map((layer) => {
              const lm = LAYER_META[layer];
              const isSelected = displayMode === 'weather' && activeLayer === layer;
              return (
                <TouchableOpacity
                  key={layer}
                  style={[styles.layerPickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setActiveLayer(layer);
                    setDisplayMode('weather');
                    setShowLayerPicker(false);
                  }}
                >
                  <MaterialCommunityIcons
                    name={lm.icon as any}
                    size={18}
                    color={isSelected ? colors.tabBarActive : colors.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.layerPickerLabel, { color: isSelected ? colors.tabBarActive : colors.textPrimary }]}>
                      {lm.label}
                    </Text>
                    <Text style={[styles.layerPickerDesc, { color: colors.textSecondary }]}>
                      {lm.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={16} color={colors.tabBarActive} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Drone selector (only in drone mode) */}
      {displayMode === 'drone' && !showLayerPicker && (
        <View style={[styles.droneBar, { top: insets.top + 56, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.droneBarInner}
            onPress={() => setShowDronePicker((v) => !v)}
          >
            <MaterialCommunityIcons name="quadcopter" size={16} color={colors.tabBarActive} />
            <Text style={[styles.droneBarText, { color: colors.textPrimary }]} numberOfLines={1}>
              {activeDrone?.name ?? 'Select drone'}
            </Text>
            <MaterialCommunityIcons
              name={showDronePicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showDronePicker && (
            <View style={[styles.dronePicker, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {visibleProfiles.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.dronePickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    useDroneStore.getState().setActiveDrone(p.id);
                    setShowDronePicker(false);
                  }}
                >
                  <Text style={[
                    styles.dronePickerText,
                    { color: p.id === activeDroneId ? colors.tabBarActive : colors.textPrimary },
                  ]}>
                    {p.name}
                  </Text>
                  {p.id === activeDroneId && (
                    <MaterialCommunityIcons name="check" size={14} color={colors.tabBarActive} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Bottom: date selector + hour slider + legend */}
      <View style={[
        styles.bottomPanel,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + 8,
        },
      ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRow}
        >
          {dateChoices.map((d) => {
            const isSelected = selectedDate === d.value;
            return (
              <TouchableOpacity
                key={d.value}
                style={[
                  styles.dateChip,
                  {
                    backgroundColor: isSelected ? colors.tabBarActive : colors.surfaceElevated,
                    borderColor: isSelected ? colors.tabBarActive : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedDate(d.value);
                  if (d.value === today && selectedHour > currentHour) {
                    setSelectedHour(currentHour);
                  }
                }}
              >
                <Text style={[styles.dateChipText, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <HourSlider
          value={selectedHour}
          onChange={setSelectedHour}
          isToday={selectedDate === today}
          currentHour={currentHour}
          colors={colors}
        />

        <LayerLegend layer={displayMode === 'drone' ? 'score' : activeLayer} colors={colors} />
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="wifi-off" size={14} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Hour Slider ────────────────────────────────────────────────────────────

function HourSlider({
  value,
  onChange,
  isToday,
  currentHour,
  colors,
}: {
  value: number;
  onChange: (h: number) => void;
  isToday: boolean;
  currentHour: number;
  colors: any;
}) {
  const fillWidthPct = `${(value / 23) * 100}%` as `${number}%`;
  const pastWidthPct = `${(currentHour / 23) * 100}%` as `${number}%`;

  return (
    <View style={styles.sliderContainer}>
      <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
        {String(value).padStart(2, '0')}:00
      </Text>

      <View style={styles.sliderTrackWrapper}>
        <View style={[styles.sliderTrack, { backgroundColor: colors.border }]}>
          {isToday && currentHour < 23 && (
            <View
              style={[
                styles.sliderPast,
                { width: pastWidthPct, backgroundColor: colors.pastOverlay },
              ]}
            />
          )}
          <View
            style={[
              styles.sliderFill,
              { width: fillWidthPct, backgroundColor: colors.tabBarActive },
            ]}
          />
        </View>

        <View style={styles.sliderSegments}>
          {Array.from({ length: 24 }, (_, h) => {
            const disabled = isToday && h > currentHour;
            return (
              <TouchableOpacity
                key={h}
                style={styles.sliderSegment}
                onPress={() => !disabled && onChange(h)}
                activeOpacity={disabled ? 1 : 0.7}
              />
            );
          })}
        </View>
      </View>

      <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>23:00</Text>
    </View>
  );
}

// ─── Legend ─────────────────────────────────────────────────────────────────

function LayerLegend({ layer, colors }: { layer: MapLayer; colors: any }) {
  const meta = LAYER_META[layer];
  return (
    <View style={styles.legend}>
      <Text style={[styles.legendMin, { color: colors.textSecondary }]}>{meta.legendMin}</Text>
      <View style={styles.legendGradient}>
        {meta.legendColors.map((c, i) => (
          <View key={i} style={[styles.legendStop, { backgroundColor: c }]} />
        ))}
      </View>
      <Text style={[styles.legendMax, { color: colors.textSecondary }]}>{meta.legendMax}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  layerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    elevation: 2,
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  layerButtonText: { flex: 1, fontSize: 14, fontWeight: '600' },
  modeButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  loadingBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },

  layerPicker: {
    position: 'absolute',
    left: 12,
    right: 60,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    zIndex: 20,
  },
  layerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  layerPickerLabel: { fontSize: 13, fontWeight: '600' },
  layerPickerDesc: { fontSize: 11, marginTop: 1 },

  droneBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'visible',
    elevation: 6,
    zIndex: 15,
  },
  droneBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  droneBarText: { flex: 1, fontSize: 13, fontWeight: '600' },
  dronePicker: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
    marginHorizontal: -1,
    elevation: 8,
    zIndex: 30,
  },
  dronePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dronePickerText: { fontSize: 13 },

  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 12,
    elevation: 8,
    zIndex: 10,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  dateChipText: { fontSize: 12, fontWeight: '500' },

  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sliderLabel: { fontSize: 11, width: 38, textAlign: 'center', fontWeight: '500' },
  sliderTrackWrapper: { flex: 1, position: 'relative', height: 24, justifyContent: 'center' },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  sliderPast: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  sliderSegments: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  sliderSegment: { flex: 1, height: '100%' },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendMin: { fontSize: 10, width: 50, textAlign: 'right' },
  legendMax: { fontSize: 10, width: 50 },
  legendGradient: {
    flex: 1,
    height: 8,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  legendStop: { flex: 1 },

  errorBanner: {
    position: 'absolute',
    bottom: 120,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    elevation: 4,
    zIndex: 15,
  },
  errorText: { fontSize: 12, flex: 1 },
});
