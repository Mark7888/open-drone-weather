import React, { useMemo } from 'react';
import type { FeatureCollection } from 'geojson';
import {
  GeoJSONSource,
  Layer,
  ViewAnnotation,
  type Expression,
  type FillLayerProps,
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

interface WeatherGridOverlayProps {
  points: GridPoint[];
  layer: MapLayer;
  hour: number;
  dateStr: string;
  displayMode: MapDisplayMode;
  drone?: DroneProfile;
  units: UnitsSettings;
  /** Current map zoom level (float) */
  zoom: number;
  /** Half-cell size in degrees — determines polygon size */
  cellHalfDeg: number;
}

const isWindLayer = (layer: MapLayer) =>
  layer === 'wind_10m' || layer === 'wind_80m' || layer === 'wind_120m';

/** Color applied to all wind direction arrows */
const WIND_ARROW_COLOR = '#FFFFFF';

type GeoJsonFeature = {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'Point'; coordinates: any };
  properties: Record<string, any>;
};

export default function WeatherGridOverlay({
  points,
  layer,
  hour,
  dateStr,
  displayMode,
  drone,
  units,
  zoom,
  cellHalfDeg,
}: WeatherGridOverlayProps) {
  const targetPrefix = `${dateStr}T${String(hour).padStart(2, '0')}`;

  // Wind arrows only appear at zoom >= 9 (manageable marker count)
  const showArrows = isWindLayer(layer) && zoom >= 9;

  /**
   * Build GeoJSON FeatureCollections from weather grid points.
   *
   * - fillCollection  → polygon cell per grid point, colored by layer value
   * - labelCollection → point at cell centre with formatted label text
   * - windPoints      → raw array driving SVG wind direction markers
   *
   * All three are memoised; they only rebuild when weather data or display
   * settings change, not on every render.
   */
  const { fillCollection, labelCollection, windPoints } = useMemo(() => {
    const fillFeatures: GeoJsonFeature[] = [];
    const labelFeatures: GeoJsonFeature[] = [];
    const windPts: Array<{ lat: number; lon: number; speed: number; dir: number }> = [];

    for (const pt of points) {
      const weather = pt.hourly.find((h) => h.time.startsWith(targetPrefix));
      if (!weather) continue;

      const value = getLayerValue(layer, weather, drone);
      const fillColor = getLayerColor(layer, value, displayMode, weather, drone);
      const half = cellHalfDeg;

      // Polygon cell — coordinates in GeoJSON [lon, lat] order, ring closed
      fillFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [pt.lon - half, pt.lat - half],
              [pt.lon + half, pt.lat - half],
              [pt.lon + half, pt.lat + half],
              [pt.lon - half, pt.lat + half],
              [pt.lon - half, pt.lat - half],
            ],
          ],
        },
        properties: { fillColor },
      });

      // Point for text label
      labelFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
        properties: { label: getLayerLabel(layer, value, units, weather) },
      });

      if (showArrows) {
        windPts.push({ lat: pt.lat, lon: pt.lon, speed: value, dir: getWindDirection(layer, weather) });
      }
    }

    // Use imported FeatureCollection type from 'geojson' so no unsafe cast is needed
    const fillCollection: FeatureCollection = { type: 'FeatureCollection', features: fillFeatures as any };
    const labelCollection: FeatureCollection = { type: 'FeatureCollection', features: labelFeatures as any };
    return { fillCollection, labelCollection, windPoints: windPts };
  }, [points, layer, targetPrefix, displayMode, drone, units, cellHalfDeg, showArrows]);

  // Use MapLibre Expression type for data-driven style expressions
  const GET_FILL_COLOR: Expression = ['get', 'fillColor'];
  const GET_LABEL: Expression = ['get', 'label'];

  const fillStyle: FillLayerProps['style'] = {
    fillColor: GET_FILL_COLOR,
    fillOpacity: 1,
    // Transparent outline so cells blend edge-to-edge without hairlines
    fillOutlineColor: 'rgba(0,0,0,0)',
  };

  const labelStyle: SymbolLayerProps['style'] = {
    textField: GET_LABEL,
    textSize: 11,
    textColor: WIND_ARROW_COLOR,
    textHaloColor: 'rgba(0,0,0,0.75)',
    textHaloWidth: 1.5,
    textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'] as any,
    textAnchor: 'center',
    textAllowOverlap: false,
    textIgnorePlacement: false,
  };

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Colored fill cells — rendered natively by MapLibre GL engine.       */}
      {/* A single GeoJSONSource drives thousands of polygons without any      */}
      {/* per-cell React component overhead.                                   */}
      {/* ------------------------------------------------------------------ */}
      <GeoJSONSource id="weather-fill-src" data={fillCollection}>
        <Layer type="fill" id="weather-fill-layer" style={fillStyle} />
      </GeoJSONSource>

      {/* ------------------------------------------------------------------ */}
      {/* Value labels — native MapLibre SymbolLayer with collision detection. */}
      {/* Shown automatically at zoom >= 9 via minzoom on the layer.          */}
      {/* ------------------------------------------------------------------ */}
      <GeoJSONSource id="weather-label-src" data={labelCollection}>
        <Layer type="symbol" id="weather-label-layer" minzoom={9} style={labelStyle} />
      </GeoJSONSource>

      {/* ------------------------------------------------------------------ */}
      {/* Wind direction arrows — SVG WindArrow inside ViewAnnotation.        */}
      {/* Only shown at zoom >= 9 to keep marker count manageable.           */}
      {/* ------------------------------------------------------------------ */}
      {showArrows &&
        windPoints.map((pt, i) => (
          <ViewAnnotation
            key={`wind-${i}-${pt.lat.toFixed(4)}-${pt.lon.toFixed(4)}`}
            lngLat={[pt.lon, pt.lat]}
          >
            <WindArrow speed={pt.speed} direction={pt.dir} color={WIND_ARROW_COLOR} size={24} />
          </ViewAnnotation>
        ))}
    </>
  );
}
