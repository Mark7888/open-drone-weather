import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type MapRef,
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
import { MapLayer } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LAT = 47.5;
const DEFAULT_LON = 19.0;
const DEFAULT_ZOOM = 9;
/** Milliseconds to wait after the last region-change event before fetching.
 *  500 ms gives a comfortable balance: fast enough to feel responsive after
 *  the user lifts their finger, slow enough to avoid redundant API calls
 *  during a continuous pan/zoom gesture. */
const LOAD_DEBOUNCE_MS = 500;
/** Clamped tile-zoom range (must match stepDegForZoom breakpoints) */
const MIN_TILE_ZOOM = 5;
const MAX_TILE_ZOOM = 11;

/**
 * Free vector tile styles from OpenFreeMap (openfreemap.org).
 * No API key required; attribution is rendered automatically by MapLibre.
 */
const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/liberty';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

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
  const visibleProfiles = hideDronePresets
    ? profiles.filter((p) => !p.isPreset)
    : profiles;
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
  const mapRef = useRef<MapRef | null>(null);
  /** Ensures the on-load initial fetch only runs once */
  const initialLoadDone = useRef(false);

  const isDark = (themeOverride ?? systemScheme) === 'dark';

  const initialLon =
    activeLocation?.lon && activeLocation.lon !== 0 ? activeLocation.lon : DEFAULT_LON;
  const initialLat =
    activeLocation?.lat && activeLocation.lat !== 0 ? activeLocation.lat : DEFAULT_LAT;

  // ---------------------------------------------------------------------------
  // loadCurrentView — reads the live viewport from the map ref and requests
  // weather tiles for the visible area (+ one-step boundary padding).
  // Using the map ref instead of parsing the event payload decouples load
  // logic from the event stream, which is more reliable across all
  // interaction types (pan, zoom, rotate, initial render).
  // ---------------------------------------------------------------------------
  const loadCurrentView = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const vs = await mapRef.current.getViewState();
      const [lonMin, latMin, lonMax, latMax] = vs.bounds;
      const tileZoom = Math.max(
        MIN_TILE_ZOOM,
        Math.min(MAX_TILE_ZOOM, Math.round(vs.zoom))
      );
      // One-step padding so data extends slightly beyond the screen edges —
      // eliminates the hard rectangular cutoff at the viewport boundary.
      const pad = stepDegForZoom(tileZoom);

      setCurrentZoom(vs.zoom);
      loadRegion(
        latMin - pad,
        latMax + pad,
        lonMin - pad,
        lonMax + pad,
        tileZoom
      );
    } catch {
      // Map may not be ready yet (e.g. called before the style finishes
      // loading).  onRegionDidChange will take over once the map is live.
    }
  }, [loadRegion]);

  // ---------------------------------------------------------------------------
  // Initial load — triggered when the map style finishes loading.
  // A short delay lets the Camera apply its initialViewState first.
  // ---------------------------------------------------------------------------
  const onMapLoaded = useCallback(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    setTimeout(loadCurrentView, 150);
  }, [loadCurrentView]);

  // Fallback: if onDidFinishLoadingMap never fires (e.g. in some emulators),
  // attempt the initial load after 1 s via useEffect.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        loadCurrentView();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [loadCurrentView]);

  // ---------------------------------------------------------------------------
  // onRegionDidChange — fires whenever the user finishes panning or zooming.
  // Debounced so we don't fire while the user is still interacting.
  // ---------------------------------------------------------------------------
  const onRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      // Update zoom immediately (for UI — label/arrow visibility gates)
      setCurrentZoom(event.nativeEvent.zoom);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(loadCurrentView, LOAD_DEBOUNCE_MS);
    },
    [loadCurrentView]
  );

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  /** Tile zoom snapped to the resolution breakpoints */
  const currentTileZoom = Math.max(
    MIN_TILE_ZOOM,
    Math.min(MAX_TILE_ZOOM, Math.round(currentZoom))
  );

  /** Point count for the status badge (current-zoom tiles only) */
  const currentZoomPointCount = useMemo(() => {
    const prefix = `${currentTileZoom}_`;
    return Object.entries(tiles)
      .filter(([k]) => k.startsWith(prefix))
      .reduce((sum, [, pts]) => sum + pts.length, 0);
  }, [tiles, currentTileZoom]);

  const hasTiles = Object.keys(tiles).length > 0;
  const isLoading = loadingKeys.size > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Full-screen MapLibre map with free OpenFreeMap vector tiles */}
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        mapStyle={isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        onRegionDidChange={onRegionDidChange}
        onDidFinishLoadingMap={onMapLoaded}
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

        {/* Weather overlay — rendered only when at least one tile is loaded */}
        {hasTiles && (
          <WeatherGridOverlay
            tiles={tiles}
            currentTileZoom={currentTileZoom}
            layer={selectedLayer}
            hour={selectedHour}
            dateStr={selectedDate}
            displayMode={displayMode}
            drone={displayMode === 'score' ? activeDrone : undefined}
            units={units}
            zoom={currentZoom}
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
          <MaterialCommunityIcons
            name="map-check"
            size={18}
            color={colors.tabBarActive}
          />
        )}
        <Text style={[styles.topBarText, { color: colors.textPrimary }]}>
          {isLoading ? 'Loading…' : `${currentZoomPointCount} pts`}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
