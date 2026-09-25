const DEFAULT_CPU_MILLICORES = 250;
const DEFAULT_MEMORY_MI = 256;
const MILLICORES_PER_CORE = 1000;
const MI_PER_GI = 1024;
const MISSING_VALUE = '--';

type Quantity = string | number | null | undefined;

export function parseCpuMillicores(value: Quantity) {
  if (value === null || value === undefined || value === '') return DEFAULT_CPU_MILLICORES;
  const text = String(value).trim();
  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return DEFAULT_CPU_MILLICORES;
  const millicores = text.endsWith('m') ? number : number * MILLICORES_PER_CORE;
  return Math.max(1, Math.round(millicores));
}

export function formatCpu(millicores: number) {
  const value = Math.round(Number(millicores));
  if (!Number.isFinite(value) || value < 1) return `${DEFAULT_CPU_MILLICORES}m`;
  return value % MILLICORES_PER_CORE === 0 ? String(value / MILLICORES_PER_CORE) : `${value}m`;
}

export function parseMemoryMi(value: Quantity) {
  if (value === null || value === undefined || value === '') return DEFAULT_MEMORY_MI;
  const match = String(value).trim().match(/^([\d.]+)\s*(Gi|Mi|M)$/i);
  if (!match) return DEFAULT_MEMORY_MI;
  const number = Number.parseFloat(match[1]);
  const mi = match[2].toLowerCase() === 'gi' ? number * MI_PER_GI : number;
  return Math.max(1, Math.round(mi));
}

export function formatMemory(mi: number) {
  const value = Math.round(Number(mi));
  if (!Number.isFinite(value) || value < 1) return `${DEFAULT_MEMORY_MI}Mi`;
  return value % MI_PER_GI === 0 ? `${value / MI_PER_GI}Gi` : `${value}Mi`;
}

export function formatPair(first: Quantity, second: Quantity) {
  const show = (value: Quantity) => (value === null || value === undefined || value === '' ? MISSING_VALUE : String(value));
  return `${show(first)} / ${show(second)}`;
}
