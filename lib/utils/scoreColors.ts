import { ScoreColors } from '../../theme/colors';

export function scoreToColor(score: number): string {
  if (score >= 85) return ScoreColors.excellent;
  if (score >= 65) return ScoreColors.good;
  if (score >= 40) return ScoreColors.marginal;
  if (score >= 1) return ScoreColors.poor;
  return ScoreColors.blocked;
}

export function scoreToLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Marginal';
  if (score >= 1) return 'Poor';
  return 'Blocked';
}

/**
 * Interpolates between two hex colors by factor t in [0,1].
 */
export function interpolateColor(colorA: string, colorB: string, t: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Returns an array of {color, score} gradient stops for 24 hours.
 * Each stop is the color for that hour (0-23).
 */
export function buildHourGradientColors(hourScores: { score: number }[]): string[] {
  return hourScores.map((h) => scoreToColor(h.score));
}
