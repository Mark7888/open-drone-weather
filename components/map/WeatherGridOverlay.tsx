import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Polygon, Marker } from 'react-native-maps';
import { GridPoint, MapLayer, MapDisplayMode, DroneProfile, UnitsSettings } from '../../types';
import { getLayerColor, getLayerValue, getLayerLabel, getWindDirection } from '../../lib/utils/mapColors';
import WindArrow from './WindArrow';

interface WeatherGridOverlayProps {
  points: GridPoint[];
  layer: MapLayer;
  hour: number;
  dateStr: string;
  displayMode: MapDisplayMode;
  drone?: DroneProfile;
  units: UnitsSettings;
  /** Map zoom level — controls label density */
  zoom: number;
  /** Half-cell size in degrees — determines polygon size */
  cellHalfDeg: number;
}

const isWindLayer = (layer: MapLayer) =>
  layer === 'wind_10m' || layer === 'wind_80m' || layer === 'wind_120m';

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
  // Find the target datetime prefix
  const targetPrefix = `${dateStr}T${String(hour).padStart(2, '0')}`;

  const showLabels = zoom >= 9;
  const showArrows = isWindLayer(layer) && zoom >= 7;

  const rendered = useMemo(() => {
    const polygons: React.ReactNode[] = [];
    const labels: React.ReactNode[] = [];
    const arrows: React.ReactNode[] = [];

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const weather = pt.hourly.find((h) => h.time.startsWith(targetPrefix));
      if (!weather) continue;

      const value = getLayerValue(layer, weather, drone);
      const color = getLayerColor(layer, value, displayMode, weather, drone);
      const half = cellHalfDeg;

      const cellCoords = [
        { latitude: pt.lat - half, longitude: pt.lon - half },
        { latitude: pt.lat - half, longitude: pt.lon + half },
        { latitude: pt.lat + half, longitude: pt.lon + half },
        { latitude: pt.lat + half, longitude: pt.lon - half },
      ];

      polygons.push(
        <Polygon
          key={`poly-${i}`}
          coordinates={cellCoords}
          fillColor={color}
          strokeColor="transparent"
          strokeWidth={0}
          tappable={false}
        />
      );

      if (showLabels) {
        const label = getLayerLabel(layer, value, units, weather);
        labels.push(
          <Marker
            key={`lbl-${i}`}
            coordinate={{ latitude: pt.lat, longitude: pt.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.labelBubble}>
              <Text style={styles.labelText}>{label}</Text>
            </View>
          </Marker>
        );
      }

      if (showArrows) {
        const dir = getWindDirection(layer, weather);
        arrows.push(
          <Marker
            key={`arr-${i}`}
            coordinate={{ latitude: pt.lat, longitude: pt.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <WindArrow speed={value} direction={dir} color="#FFFFFF" size={28} />
          </Marker>
        );
      }
    }

    return { polygons, labels, arrows };
  }, [points, layer, targetPrefix, displayMode, drone, units, zoom, cellHalfDeg]);

  return (
    <>
      {rendered.polygons}
      {rendered.arrows}
      {rendered.labels}
    </>
  );
}

const styles = StyleSheet.create({
  labelBubble: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
