import type { FeatureCollection } from 'geojson';

/**
 * Generates a grid of lat/lon points covering the given bounding box
 * at the specified resolution in degrees.
 */
export function generateGrid(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  stepDeg: number,
): { lat: number; lon: number }[] {
  const points: { lat: number; lon: number }[] = [];
  // Snap the start to a clean multiple of stepDeg so grids align across requests
  const startLat = Math.ceil(minLat / stepDeg) * stepDeg;
  const startLon = Math.ceil(minLon / stepDeg) * stepDeg;
  for (let lat = startLat; lat <= maxLat; lat += stepDeg) {
    for (let lon = startLon; lon <= maxLon; lon += stepDeg) {
      points.push({
        lat: Math.round(lat / stepDeg) * stepDeg,
        lon: Math.round(lon / stepDeg) * stepDeg,
      });
    }
  }
  return points;
}

/**
 * Returns an appropriate grid step (in degrees) based on zoom level.
 * Higher zoom = finer grid = more data points.
 */
export function gridStepForZoom(zoom: number): number {
  if (zoom >= 11) return 0.1;
  if (zoom >= 9) return 0.2;
  if (zoom >= 7) return 0.5;
  if (zoom >= 5) return 1.0;
  return 2.0;
}

/**
 * Returns the bounding box expanded by a padding factor,
 * clamped to valid lat/lon ranges.
 */
export function expandBBox(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  factor: number = 0.5,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latPad = (maxLat - minLat) * factor;
  const lonPad = (maxLon - minLon) * factor;
  return {
    minLat: Math.max(-85, minLat - latPad),
    maxLat: Math.min(85, maxLat + latPad),
    minLon: Math.max(-180, minLon - lonPad),
    maxLon: Math.min(180, maxLon + lonPad),
  };
}

/**
 * Builds a GeoJSON FeatureCollection of colored squares for each grid point.
 * Each feature covers ±halfStep degrees around the point.
 */
export function buildGeoJSONGrid(
  points: {
    lat: number;
    lon: number;
    color: string;
    value: number;
    label: string;
  }[],
  halfStep: number,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [p.lon - halfStep, p.lat - halfStep],
          [p.lon + halfStep, p.lat - halfStep],
          [p.lon + halfStep, p.lat + halfStep],
          [p.lon - halfStep, p.lat + halfStep],
          [p.lon - halfStep, p.lat - halfStep],
        ]],
      },
      properties: {
        color: p.color,
        value: p.value,
        label: p.label,
      },
    })),
  };
}
