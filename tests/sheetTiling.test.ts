// tests/sheetTiling.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateSheetLayout, drawCutGuides, renderSheet } from '../src/utils/sheetTiling';
import { SheetConfig } from '../src/types';

describe('sheetTiling engine', () => {
  const baseConfig: SheetConfig = {
    enabled: true,
    preset: '10x15',
    width: 15,
    height: 10,
    unit: 'cm',
    dpi: 300,
    orientation: 'auto',
    cutGuides: true,
    spacingMm: 2,
    marginMm: 3
  };

  it('calculates optimal grid layout for 35x45mm passport photos on 10x15cm sheet', () => {
    // 35x45 mm at 300 DPI = 413 x 531 px
    const photoW = 413;
    const photoH = 531;

    const layout = calculateSheetLayout(photoW, photoH, baseConfig);

    expect(layout.sheetWidthPx).toBeGreaterThan(layout.sheetHeightPx); // landscape
    expect(layout.cols).toBeGreaterThanOrEqual(3);
    expect(layout.rows).toBeGreaterThanOrEqual(2);
    expect(layout.totalPhotos).toBe(layout.cols * layout.rows);
    expect(layout.positions.length).toBe(layout.totalPhotos);

    // Grid must be centered on the sheet
    expect(layout.startX).toBeGreaterThanOrEqual(0);
    expect(layout.startY).toBeGreaterThanOrEqual(0);
  });

  it('calculates optimal grid layout for 480x640 Nusuk photos on 10x15cm sheet', () => {
    // 10x15 cm at 300 DPI = 1772 x 1181 px
    // 480 x 640 px photos:
    // in landscape: availW = 1772 - 2*35 = 1702; (1702 + 24) / (480 + 24) = 3 cols
    // availH = 1181 - 2*35 = 1111; (1111 + 24) / (640 + 24) = 1 row (or 2 if margin tight)
    const layout = calculateSheetLayout(480, 640, baseConfig);

    expect(layout.totalPhotos).toBeGreaterThanOrEqual(2);
    expect(layout.positions.length).toBe(layout.totalPhotos);
  });

  it('respects forced landscape and forced portrait orientations', () => {
    const photoW = 400;
    const photoH = 500;

    const landscapeLayout = calculateSheetLayout(photoW, photoH, {
      ...baseConfig,
      orientation: 'landscape'
    });
    expect(landscapeLayout.sheetWidthPx).toBeGreaterThanOrEqual(landscapeLayout.sheetHeightPx);

    const portraitLayout = calculateSheetLayout(photoW, photoH, {
      ...baseConfig,
      orientation: 'portrait'
    });
    expect(portraitLayout.sheetHeightPx).toBeGreaterThanOrEqual(portraitLayout.sheetWidthPx);
  });

  it('auto-orientation picks the orientation that maximizes total photo count', () => {
    // A photo shape that fits significantly better in landscape than portrait
    const photoW = 500;
    const photoH = 300;

    const autoLayout = calculateSheetLayout(photoW, photoH, {
      ...baseConfig,
      orientation: 'auto'
    });

    const forcedPort = calculateSheetLayout(photoW, photoH, {
      ...baseConfig,
      orientation: 'portrait'
    });

    expect(autoLayout.totalPhotos).toBeGreaterThanOrEqual(forcedPort.totalPhotos);
  });

  it('handles edge case of zero or negative dimensions safely', () => {
    const layout = calculateSheetLayout(0, 0, baseConfig);
    expect(layout.totalPhotos).toBe(0);
    expect(layout.positions).toEqual([]);
  });

  it('drawCutGuides draws lines without errors', () => {
    const mockCtx: any = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      strokeStyle: '',
      lineWidth: 1
    };

    const layout = calculateSheetLayout(400, 500, baseConfig);
    drawCutGuides(mockCtx, layout);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.setLineDash).toHaveBeenCalledWith([4, 4]);
  });

  it('renderSheet produces an OffscreenCanvas with all photos drawn', () => {
    const layout = calculateSheetLayout(400, 500, baseConfig);

    // Mock OffscreenCanvas
    const mockCtx: any = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn()
    };

    const origOffscreen = globalThis.OffscreenCanvas;
    (globalThis as any).OffscreenCanvas = vi.fn().mockImplementation((w, h) => ({
      width: w,
      height: h,
      getContext: vi.fn().mockReturnValue(mockCtx)
    }));

    try {
      const mockPhoto = {} as any;
      const sheetCanvas = renderSheet(mockPhoto, layout, true);

      expect(sheetCanvas.width).toBe(layout.sheetWidthPx);
      expect(sheetCanvas.height).toBe(layout.sheetHeightPx);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, layout.sheetWidthPx, layout.sheetHeightPx);
      expect(mockCtx.drawImage).toHaveBeenCalledTimes(layout.totalPhotos);
    } finally {
      globalThis.OffscreenCanvas = origOffscreen;
    }
  });
});
