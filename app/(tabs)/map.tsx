import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
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
import { toDateString } from '../../lib/utils/time';

const DEFAULT_LAT = 47.5;
const DEFAULT_LON = 19.0;
const DEFAULT_ZOOM = 9;
const LOAD_DEBOUNCE_MS = 600;

function zoomLevelFromDelta(latitudeDelta: number): number {
  // Approximate zoom level from latitudeDelta
  return Math.round(Math.log2(360 / latitudeDelta));
}

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

  // Initial region centred on selected location (or default)
  const initialRegion: Region = {
    latitude: activeLocation?.lat && activeLocation.lat !== 0 ? activeLocation.lat : DEFAULT_LAT,
    longitude: activeLocation?.lon && activeLocation.lon !== 0 ? activeLocation.lon : DEFAULT_LON,
    latitudeDelta: 0.6,
    longitudeDelta: 0.6,
  };

  // Load data for initial region on mount
  useEffect(() => {
    const r = initialRegion;
    loadVisibleTiles(
      r.latitude - r.latitudeDelta / 2,
      r.latitude + r.latitudeDelta / 2,
      r.longitude - r.longitudeDelta / 2,
      r.longitude + r.longitudeDelta / 2,
      DEFAULT_ZOOM
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadVisibleTiles(
    latMin: number,
    latMax: number,
    lonMin: number,
    lonMax: number,
    zoom: number
  ) {
    loadRegion(latMin, latMax, lonMin, lonMax, zoom);
  }

  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      const zoom = zoomLevelFromDelta(region.latitudeDelta);
      setCurrentZoom(zoom);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const latMin = region.latitude - region.latitudeDelta / 2;
        const latMax = region.latitude + region.latitudeDelta / 2;
        const lonMin = region.longitude - region.longitudeDelta / 2;
        const lonMax = region.longitude + region.longitudeDelta / 2;
        loadVisibleTiles(latMin, latMax, lonMin, lonMax, zoom);
      }, LOAD_DEBOUNCE_MS);
    },
    [loadRegion]
  );

  // Collect all grid points currently loaded
  const allPoints: GridPoint[] = Object.values(tiles).flat();
  const isLoading = loadingKeys.size > 0;

  const stepDeg = stepDegForZoom(currentZoom);
  const cellHalfDeg = stepDeg / 2;

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        mapType={systemScheme === 'dark' ? 'mutedStandard' : 'standard'}
        showsUserLocation
        showsCompass={false}
        showsScale={false}
      >
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
      </MapView>

      {/* Top bar — loading indicator */}
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

      {/* Bottom controls panel */}
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
        {/* Collapse toggle */}
        <TouchableOpacity
          onPress={() => setControlsExpanded((v) => !v)}
          style={styles.collapseBtn}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
        >
          <View style={[styles.collapseHandle, { backgroundColor: colors.border }]} />
        </TouchableOpacity>

        {controlsExpanded && (
          <>
            {/* Display mode + drone */}
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

            {/* Layer selector */}
            <LayerSelector
              selected={selectedLayer}
              onSelect={(layer: MapLayer) => {
                setLayer(layer);
                setDronePicker(false);
              }}
              colors={colors}
            />

            {/* Date + hour */}
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
