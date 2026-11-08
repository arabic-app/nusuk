import { describe, it, expect } from 'vitest';
import {
  convertToPixels,
  convertFromPixels,
  clampDimension,
  PRESETS,
  MIN_PX,
  MAX_PX
} from '../src/utils/dimensions';

describe('Dimensions engine', () => {
  it('converts px directly', () => {
    expect(convertToPixels(640, 'px', 300)).toBe(640);
  });

  it('converts mm to px at 300 DPI accurately', () => {
    // 35 mm / 25.4 * 300 = 413.385 -> 413 px
    expect(convertToPixels(35, 'mm', 300)).toBe(413);
    // 45 mm / 25.4 * 300 = 531.496 -> 531 px
    expect(convertToPixels(45, 'mm', 300)).toBe(531);
  });

  it('converts cm to px at 300 DPI accurately', () => {
    // 3.5 cm / 2.54 * 300 = 413.385 -> 413 px
    expect(convertToPixels(3.5, 'cm', 300)).toBe(413);
    // 4.5 cm / 2.54 * 300 = 531.496 -> 531 px
    expect(convertToPixels(4.5, 'cm', 300)).toBe(531);
  });

  it('converts inches to px accurately', () => {
    // 2 in * 300 = 600 px
    expect(convertToPixels(2, 'in', 300)).toBe(600);
  });

  it('converts pixels back to original units accurately', () => {
    // px to px
    expect(convertFromPixels(640, 'px', 300)).toBe(640);
    // 600 px at 300 DPI -> 2 in
    expect(convertFromPixels(600, 'in', 300)).toBe(2);
    // 413 px at 300 DPI -> 413 / 300 * 25.4 = 34.969 -> 35.0 mm
    expect(convertFromPixels(413, 'mm', 300)).toBe(35);
    // 413 px at 300 DPI -> 413 / 300 * 2.54 = 3.4969 -> 3.50 cm
    expect(convertFromPixels(413, 'cm', 300)).toBe(3.5);
  });

  it('clamps dimensions between 50 and 4000 px', () => {
    expect(clampDimension(20)).toBe(50);
    expect(clampDimension(5000)).toBe(4000);
    expect(clampDimension(640)).toBe(640);
    expect(clampDimension(MIN_PX)).toBe(MIN_PX);
    expect(clampDimension(MAX_PX)).toBe(MAX_PX);
    expect(clampDimension(640.4)).toBe(640);
    expect(clampDimension(640.6)).toBe(641);
  });

  it('contains Nusuk preset 640x480 px', () => {
    expect(PRESETS.nusuk).toBeDefined();
    expect(PRESETS.nusuk.width).toBe(640);
    expect(PRESETS.nusuk.height).toBe(480);
    expect(PRESETS.nusuk.unit).toBe('px');
    expect(PRESETS.nusuk.dpi).toBe(300);
    expect(PRESETS.nusuk.lockRatio).toBe(true);
  });

  it('contains Passport (35x45 mm) and Intl (2x2 in) presets', () => {
    expect(PRESETS.passport).toEqual({
      width: 35,
      height: 45,
      unit: 'mm',
      dpi: 300,
      lockRatio: true
    });
    expect(PRESETS.intl).toEqual({
      width: 2,
      height: 2,
      unit: 'in',
      dpi: 300,
      lockRatio: true
    });
  });
});
