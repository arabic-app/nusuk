import { OutputDimension, Unit } from '../types';

export const MIN_PX = 50;
export const MAX_PX = 4000;

export function convertToPixels(val: number, unit: Unit, dpi: number): number {
  if (unit === 'px') return Math.round(val);
  const inches = unit === 'in' ? val : unit === 'mm' ? val / 25.4 : val / 2.54;
  return Math.round(inches * dpi);
}

export function convertFromPixels(pixels: number, unit: Unit, dpi: number): number {
  if (unit === 'px') return pixels;
  const inches = pixels / dpi;
  if (unit === 'in') return Number(inches.toFixed(2));
  if (unit === 'mm') return Number((inches * 25.4).toFixed(1));
  return Number((inches * 2.54).toFixed(2));
}

export function clampDimension(px: number): number {
  return Math.max(MIN_PX, Math.min(MAX_PX, Math.round(px)));
}

export const PRESETS: Record<string, OutputDimension> = {
  nusuk: {
    width: 640,
    height: 480,
    unit: 'px',
    dpi: 300,
    lockRatio: true
  },
  passport: {
    width: 35,
    height: 45,
    unit: 'mm',
    dpi: 300,
    lockRatio: true
  },
  intl: {
    width: 2,
    height: 2,
    unit: 'in',
    dpi: 300,
    lockRatio: true
  }
};
