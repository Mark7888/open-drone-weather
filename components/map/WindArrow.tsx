import React from 'react';
import Svg, { Line, Polygon } from 'react-native-svg';

interface WindArrowProps {
  /** Wind speed in km/h — controls arrow size / opacity */
  speed: number;
  /** Wind direction in degrees (meteorological: 0=from N, 90=from E) */
  direction: number;
  /** Arrow color string */
  color: string;
  /** Size of the SVG canvas in logical pixels */
  size?: number;
}

/**
 * Renders a wind direction arrow inside a square SVG canvas.
 * The arrow points in the direction the wind is GOING TO (i.e. direction + 180°).
 */
export default function WindArrow({ speed, direction, color, size = 32 }: WindArrowProps) {
  // Meteorological: direction FROM which wind blows; arrow points TO
  const angleDeg = (direction + 180) % 360;
  const angleRad = (angleDeg * Math.PI) / 180;

  const cx = size / 2;
  const cy = size / 2;

  // Scale shaft length by speed (clamped)
  const maxSpeed = 80;
  const minLen = size * 0.18;
  const maxLen = size * 0.42;
  const len = minLen + ((Math.min(speed, maxSpeed) / maxSpeed) * (maxLen - minLen));

  const tipX = cx + Math.sin(angleRad) * len;
  const tipY = cy - Math.cos(angleRad) * len;
  const tailX = cx - Math.sin(angleRad) * len;
  const tailY = cy + Math.cos(angleRad) * len;

  // Arrowhead perpendicular points
  const headLen = len * 0.45;
  const perpRad = angleRad + Math.PI / 2;
  const arrowWidth = size * 0.12;

  const ax1 = tipX - Math.sin(angleRad) * headLen + Math.sin(perpRad) * arrowWidth;
  const ay1 = tipY + Math.cos(angleRad) * headLen - Math.cos(perpRad) * arrowWidth;
  const ax2 = tipX - Math.sin(angleRad) * headLen - Math.sin(perpRad) * arrowWidth;
  const ay2 = tipY + Math.cos(angleRad) * headLen + Math.cos(perpRad) * arrowWidth;

  const strokeWidth = Math.max(1.5, size * 0.07);
  const opacity = speed < 1 ? 0.25 : 0.9;

  return (
    <Svg width={size} height={size}>
      {/* Shaft */}
      <Line
        x1={tailX}
        y1={tailY}
        x2={tipX}
        y2={tipY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
      />
      {/* Arrowhead */}
      <Polygon
        points={`${tipX},${tipY} ${ax1},${ay1} ${ax2},${ay2}`}
        fill={color}
        opacity={opacity}
      />
    </Svg>
  );
}
