import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
} from 'react-native';
import {
  Map,
  Camera,
  UserLocation,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settingsStore';
import { useLocationStore } from '../../store/locationStore';
import { useMapStore } from '../../store/mapStore';
import { useDroneStore } from '../../store/droneStore';
import { getColors } from '../../theme/colors';
import { stepDegForZoom } from '../../lib/api/openMeteoGrid';
import WeatherGridOverlay from '../../components/map/WeatherGridOverlay';
import LayerSelector from '../../components/map/LayerSelector';
import DateHourControls from '../../components/map/DateHourControls';
import DisplayModeToggle from '../../components/map/DisplayModeToggle';
import { GridPoint, MapLayer } from '../../types';

const DEFAULT_LAT = 47.5;
const DEFAULT_LON = 19.0;
const DEFAULT_ZOOM = 9;
const LOAD_DEBOUNCE_MS = 600;
/** Zoom bounds used when snapping the fractional zoom to a tile-resolution step */
const MIN_TILE_ZOOM = 5;
const MAX_TILE_ZOOM = 11;

/**
 * Free vector tile styles from OpenFreeMap (openfreemap.org).
 * No API key required; attribution rendered automatically by MapLibre.
 */
const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/liberty';

export default function MapScreen() {
  const systemScheme = useColorScheme();
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  const units = useSettingsStore((s) => s.units);
  const colors = getColors(themeOverride, systemScheme);
  const insets = useSafeAreaInsets();

  const activeLocation = useLocationStore((s) => s.active);
  const profiles = useDroneStore((s) => s.profiles);
  const activeDroneId = useDroneStore((s) => s.activeDroneId);
  const hideDronePresets = useSettingsStore((s) => s.hideDronePresets);
  const visibleProfiles = hideDronePresets ? profiles.filter((p) => !p.isPreset) : profiles;
  const activeDrone = profiles.find((p) => p.id === activeDroneId) ?? profiles[0];

  const {
    selectedLayer,
    selectedDate,
    selectedHour,
    displayMode,
    tiles,
    loadingKeys,
    setLayer,
    setDate,
    setHour,
    setDisplayMode,
    loadRegion,
  } = useMapStore();

  const [controlsExpanded, setControlsExpanded] = useState(true);
  const [dronePicker, setDronePicker] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = (themeOverride ?? systemScheme) === 'dark';

  const initialLon =
    activeLocation?.lon && activeLocation.lon !== 0 ? activeLocation.lon : DEFAULT_LON;
  const initialLat =
    activeLocation?.lat && activeLocation.lat !== 0 ? activeLocation.lat : DEFAULT_LAT;

  /**
   * Fires when the map region finishes changing (pan/zoom/initial load).
   * event.nativeEvent.bounds = [west, south, east, north]
   * event.nativeEvent.zoom   = current zoom level
   */
  const onRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { zoom, bounds } = event.nativeEvent;
      const [lonMin, latMin, lonMax, latMax] = bounds;

      setCurrentZoom(zoom);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        loadRegion(latMin, latMax, lonMin, lonMax, Math.round(zoom));
      }, LOAD_DEBOUNCE_MS);
    },
    [loadRegion]
  );

  const allPoints: GridPoint[] = useMemo(
    () => Object.values(tiles).flat(),
    [tiles]
  );
  const isLoading = loadingKeys.size > 0;
  const cellHalfDeg = stepDegForZoom(Math.max(MIN_TILE_ZOOM, Math.min(MAX_TILE_ZOOM, Math.round(currentZoom)))) / 2;

  return (
    <View style={styles.container}>
      {/* Full-screen MapLibre Native map with free vector tiles */}
      <Map
        style={StyleSheet.absoluteFillObject}
        mapStyle={isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        onRegionDidChange={onRegionDidChange}
        compass={false}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <Camera
          initialViewState={{
            center: [initialLon, initialLat],
            zoom: DEFAULT_ZOOM,
          }}
        />
        <UserLocation />

        {/* Weather data overlay — GeoJSON ShapeSource + fill/symbol native layers */}
        {allPoints.length > 0 && (
          <WeatherGridOverlay
            points={allPoints}
            layer={selectedLayer}
            hour={selectedHour}
            dateStr={selectedDate}
            displayMode={displayMode}
            drone={displayMode === 'score' ? activeDrone : undefined}
            units={units}
            zoom={currentZoom}
            cellHalfDeg={cellHalfDeg}
          />
        )}
      </Map>

      {/* Top status badge */}
      <View
        style={[
          styles.topBar,
          { top: insets.top + 8, backgroundColor: colors.surface + 'DD' },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.tabBarActive} />
        ) : (
          <MaterialCommunityIcons name="map-check" size={18} color={colors.tabBarActive} />
        )}
        <Text style={[styles.topBarText, { color: colors.textPrimary }]}>
          {isLoading ? 'Loading…' : `${allPoints.length} pts`}
        </Text>
      </View>

      {/* Bottom collapsible controls panel */}
      <View
        style={[
          styles.controlsPanel,
          {
            backgroundColor: colors.surface + 'F5',
            borderColor: colors.border,
            paddingBottom: insets.bottom + 6,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setControlsExpanded((v) => !v)}
          style={styles.collapseBtn}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        >
          <View style={[styles.collapseHandle, { backgroundColor: colors.border }]} />
        </TouchableOpacity>

        {controlsExpanded && (
          <>
            <DisplayModeToggle
              mode={displayMode}
              onModeChange={setDisplayMode}
              profiles={visibleProfiles}
              activeDroneId={activeDroneId}
              onSelectDrone={(id) => {
                useDroneStore.getState().setActiveDrone(id);
                setDronePicker(false);
              }}
              dronePickerOpen={dronePicker}
              onToggleDronePicker={() => setDronePicker((v) => !v)}
              colors={colors}
            />
            <LayerSelector
              selected={selectedLayer}
              onSelect={(layer: MapLayer) => {
                setLayer(layer);
                setDronePicker(false);
              }}
              colors={colors}
            />
            <DateHourControls
              selectedDate={selectedDate}
              selectedHour={selectedHour}
              onDateChange={setDate}
              onHourChange={setHour}
              colors={colors}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    elevation: 4,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topBarText: {
    fontSize: 12,
    fontWeight: '500',
  },
  controlsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    elevation: 8,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  collapseBtn: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  collapseHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
