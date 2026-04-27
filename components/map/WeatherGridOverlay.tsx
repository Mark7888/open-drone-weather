import React, { useMemo } from 'react';
import type { FeatureCollection, Feature, Point } from 'geojson';
import {
  GeoJSONSource,
  Layer,
  ViewAnnotation,
  type Expression,
  type CircleLayerProps,
  type SymbolLayerProps,
} from '@maplibre/maplibre-react-native';
import { GridPoint, MapLayer, MapDisplayMode, DroneProfile, UnitsSettings } from '../../types';
import {
  getLayerColor,
  getLayerValue,
  getLayerLabel,
  getWindDirection,
} from '../../lib/utils/mapColors';
import WindArrow from './WindArrow';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum map zoom at which text labels and wind arrows are drawn */
const LABEL_MIN_ZOOM = 9;

/** White overlay text / arrow colour */
const OVERLAY_TEXT_COLOR = '#FFFFFF';

/**
 * circleBlur = 0.7 means the outer 70 % of every circle fades from full
 * opacity to transparent.  Adjacent circles of similar colour blend smoothly;
 * the outer boundary of the data area fades out naturally instead of cutting
 * off with a hard rectangle.  Raise toward 1.0 for a softer look; lower
 * toward 0 for sharper cell boundaries.
 */
const CIRCLE_BLUR_FACTOR = 0.7;

const isWindLayer = (layer: MapLayer) =>
  layer === 'wind_10m' || layer === 'wind_80m' || layer === 'wind_120m';

// ---------------------------------------------------------------------------
// Circle radius interpolation
//
// Weather data is loaded at four resolution levels (tileZoom → stepDeg):
//   zoom 5 → 0.4°   zoom 7 → 0.2°   zoom 9 → 0.1°   zoom 11 → 0.05°
//
// Circle radius must cover (stepDeg/2) degrees at the current screen zoom.
// At screen zoom Z: pixels_per_degree = 256 × 2^Z / 360
// half-step in pixels = (stepDeg/2) × pixels_per_degree
// With a ×1.3 expansion to ensure overlap:
//   zoom 5  → half=0.20° → 0.20 × (256×32/360)  × 1.3 ≈  6 px
//   zoom 7  → half=0.10° → 0.10 × (256×128/360) × 1.3 ≈ 12 px
//   zoom 9  → half=0.05° → 0.05 × (256×512/360) × 1.3 ≈ 24 px
//   zoom 11 → half=0.025°→ 0.025×(256×2048/360) × 1.3 ≈ 47 px
//
// The exponential-2 interpolation matches the doubling of tile pixel density
// at each zoom level, so in-between zooms are handled correctly.
// ---------------------------------------------------------------------------
const CIRCLE_RADIUS_EXPR: Expression = [
  'interpolate', ['exponential', 2], ['zoom'],
  5, 6,
  7, 12,
  9, 24,
  11, 47,
];

// ---------------------------------------------------------------------------
// Static style objects (defined outside the component to avoid re-creation)
// ---------------------------------------------------------------------------

const circleStyle: CircleLayerProps['style'] = {
  // Data-driven fill colour stored in the feature's `fillColor` property
  circleColor: ['get', 'fillColor'] as unknown as string,
  circleRadius: CIRCLE_RADIUS_EXPR as unknown as number,
  circleBlur: CIRCLE_BLUR_FACTOR,
  circleOpacity: 0.85,
  // "map" keeps circles pinned to the geographic surface (not the screen)
  // when the user tilts the map, giving correct overlay behaviour.
  circlePitchAlignment: 'map',
  circleStrokeWidth: 0,
};

const labelStyle: SymbolLayerProps['style'] = {
  textField: ['get', 'label'] as unknown as string,
  textSize: 11,
  textColor: OVERLAY_TEXT_COLOR,
  textHaloColor: 'rgba(0,0,0,0.75)',
  textHaloWidth: 1.5,
  textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'] as unknown as string[],
  textAnchor: 'center',
  textAllowOverlap: false,
  textIgnorePlacement: false,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WeatherGridOverlayProps {
  /** All loaded weather tiles, keyed by "zoom_x_y" */
  tiles: Record<string, GridPoint[]>;
  /**
   * The tile zoom that matches the current map zoom (5 | 7 | 9 | 11).
   * Used to select which tiles to render so that cell sizes are always correct.
   */
  currentTileZoom: number;
  layer: MapLayer;
  hour: number;
  dateStr: string;
  displayMode: MapDisplayMode;
  drone?: DroneProfile;
  units: UnitsSettings;
  /** Current map zoom (float) — gates label/arrow visibility */
  zoom: number;
}

export default function WeatherGridOverlay({
  tiles,
  currentTileZoom,
  layer,
  hour,
  dateStr,
  displayMode,
  drone,
  units,
  zoom,
}: WeatherGridOverlayProps) {
  const targetPrefix = `${dateStr}T${String(hour).padStart(2, '0')}`;
  const showLabels = zoom >= LABEL_MIN_ZOOM;
  const showArrows = isWindLayer(layer) && zoom >= LABEL_MIN_ZOOM;

  const { circleCollection, labelCollection, windPoints } = useMemo(() => {
    const currentZoomPrefix = `${currentTileZoom}_`;

    // Prefer tiles that match the current zoom level so the circle radius
    // interpolation is correct.  Fall back to any loaded tiles while the
    // current-zoom tiles are still loading (shows placeholder data rather
    // than a blank map during zoom-level transitions).
    const hasCurrentZoomTiles = Object.keys(tiles).some((k) =>
      k.startsWith(currentZoomPrefix)
    );
    const entries = Object.entries(tiles).filter(([key]) =>
      hasCurrentZoomTiles ? key.startsWith(currentZoomPrefix) : true
    );

    const circleFeatures: Feature<Point>[] = [];
    const labelFeatures: Feature<Point>[] = [];
    const windPts: Array<{ lat: number; lon: number; speed: number; dir: number }> = [];

    // Deduplicate points that appear in both adjacent tiles (shared boundary)
    const seenKeys = new Set<string>();

    for (const [, points] of entries) {
      for (const pt of points) {
        const ptKey = `${pt.lat},${pt.lon}`;
        if (seenKeys.has(ptKey)) continue;
        seenKeys.add(ptKey);

        const weather = pt.hourly.find((h) => h.time.startsWith(targetPrefix));
        if (!weather) continue;

        const value = getLayerValue(layer, weather, drone);
        const fillColor = getLayerColor(layer, value, displayMode, weather, drone);

        circleFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
          properties: { fillColor },
        });

        if (showLabels) {
          labelFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
            properties: { label: getLayerLabel(layer, value, units, weather) },
          });
        }

        if (showArrows) {
          windPts.push({
            lat: pt.lat,
            lon: pt.lon,
            speed: value,
            dir: getWindDirection(layer, weather),
          });
        }
      }
    }

    const circleCollection: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: circleFeatures,
    };
    const labelCollection: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: labelFeatures,
    };
    return { circleCollection, labelCollection, windPoints: windPts };
  }, [tiles, currentTileZoom, layer, targetPrefix, displayMode, drone, units, showLabels, showArrows]);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Smooth weather colour fill                                          */}
      {/*                                                                     */}
      {/* Each grid point becomes a blurry circle whose radius is derived     */}
      {/* from the tile zoom via an exponential interpolation (CIRCLE_RADIUS  */}
      {/* _EXPR).  Adjacent circles overlap and their semi-transparent edges  */}
      {/* blend together — mimicking the smooth gradient look of weather       */}
      {/* radar maps without any server-side rendering.                       */}
      {/* ------------------------------------------------------------------ */}
      <GeoJSONSource id="weather-circle-src" data={circleCollection}>
        <Layer type="circle" id="weather-circle-layer" style={circleStyle} />
      </GeoJSONSource>

      {/* ------------------------------------------------------------------ */}
      {/* Value labels — native SymbolLayer with built-in collision avoidance */}
      {/* Only visible at zoom ≥ 9 (set via minzoom prop on the layer).      */}
      {/* ------------------------------------------------------------------ */}
      <GeoJSONSource id="weather-label-src" data={labelCollection}>
        <Layer
          type="symbol"
          id="weather-label-layer"
          minzoom={LABEL_MIN_ZOOM}
          style={labelStyle}
        />
      </GeoJSONSource>

      {/* ------------------------------------------------------------------ */}
      {/* Wind direction arrows                                               */}
      {/* SVG WindArrow inside ViewAnnotation; only shown at zoom ≥ 9.       */}
      {/* ------------------------------------------------------------------ */}
      {showArrows &&
        windPoints.map((pt, i) => (
          <ViewAnnotation
            key={`wind-${i}-${pt.lat.toFixed(4)}-${pt.lon.toFixed(4)}`}
            lngLat={[pt.lon, pt.lat]}
          >
            <WindArrow
              speed={pt.speed}
              direction={pt.dir}
              color={OVERLAY_TEXT_COLOR}
              size={24}
            />
          </ViewAnnotation>
        ))}
    </>
  );
}
