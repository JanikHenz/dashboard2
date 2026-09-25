import type { SeriesPoint } from './types';

const LOCALE = 'de-CH';
const formatters = new Map<number, Intl.NumberFormat>();

function formatterFor(digits: number) {
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatters.set(digits, formatter);
  }
  return formatter;
}

export function latestValue(points: SeriesPoint[] | undefined | null): number | null {
  if (!Array.isArray(points) || points.length === 0) return null;
  const value = Number(points.at(-1)?.value);
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return formatterFor(digits).format(value);
}

export function formatMetric(value: number | null | undefined, { unit = '', digits = 0 } = {}) {
  const number = formatNumber(value, digits);
  if (number === '--') return number;
  return unit ? `${number} ${unit}` : number;
}

export type ChartPoint = [number, number];

export function toChartPoints(points: SeriesPoint[] | undefined | null): ChartPoint[] {
  if (!Array.isArray(points)) return [];
  return points
    .map((point): ChartPoint => [Number(point?.timestamp), Number(point?.value)])
    .filter(([timestamp, value]) => Number.isFinite(timestamp) && Number.isFinite(value));
}

export const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
export const clockFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
