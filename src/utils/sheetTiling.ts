// src/utils/sheetTiling.ts
// Mathematical tiling engine for multi-photo print sheets (palettes) with cut guides

import { SheetConfig, SheetLayout, PhotoPosition } from '../types';
import { convertToPixels } from './dimensions';

/**
 * Calculates optimal photo grid layout (columns, rows, centering, photo positions)
 * on a print sheet according to dimensions, orientation, and margins.
 */
export function calculateSheetLayout(
  photoWidthPx: number,
  photoHeightPx: number,
  config: SheetConfig
): SheetLayout {
  if (photoWidthPx <= 0 || photoHeightPx <= 0) {
    return {
      sheetWidthPx: 100,
      sheetHeightPx: 100,
      cols: 0,
      rows: 0,
      totalPhotos: 0,
      photoWidthPx: Math.max(1, photoWidthPx),
      photoHeightPx: Math.max(1, photoHeightPx),
      startX: 0,
      startY: 0,
      spacingPx: 0,
      positions: []
    };
  }

  const rawW = convertToPixels(config.width, config.unit, config.dpi);
  const rawH = convertToPixels(config.height, config.unit, config.dpi);

  const marginPx = Math.max(0, convertToPixels(config.marginMm, 'mm', config.dpi));
  const spacingPx = Math.max(0, convertToPixels(config.spacingMm, 'mm', config.dpi));

  const evalFit = (sW: number, sH: number) => {
    const availW = sW - 2 * marginPx;
    const availH = sH - 2 * marginPx;
    if (availW < photoWidthPx || availH < photoHeightPx) {
      return { cols: 0, rows: 0, total: 0 };
    }
    const cols = Math.floor((availW + spacingPx) / (photoWidthPx + spacingPx));
    const rows = Math.floor((availH + spacingPx) / (photoHeightPx + spacingPx));
    return { cols, rows, total: cols * rows };
  };

  let chosenW = rawW;
  let chosenH = rawH;
  let bestFit = evalFit(chosenW, chosenH);

  if (config.orientation === 'landscape') {
    chosenW = Math.max(rawW, rawH);
    chosenH = Math.min(rawW, rawH);
    bestFit = evalFit(chosenW, chosenH);
  } else if (config.orientation === 'portrait') {
    chosenW = Math.min(rawW, rawH);
    chosenH = Math.max(rawW, rawH);
    bestFit = evalFit(chosenW, chosenH);
  } else {
    // Auto: choose orientation that yields more photos
    const landW = Math.max(rawW, rawH);
    const landH = Math.min(rawW, rawH);
    const portW = Math.min(rawW, rawH);
    const portH = Math.max(rawW, rawH);

    const fitLand = evalFit(landW, landH);
    const fitPort = evalFit(portW, portH);

    if (fitLand.total > fitPort.total) {
      chosenW = landW;
      chosenH = landH;
      bestFit = fitLand;
    } else if (fitPort.total > fitLand.total) {
      chosenW = portW;
      chosenH = portH;
      bestFit = fitPort;
    } else {
      // Tie breaker: prefer orientation matching the original raw orientation
      if (rawW >= rawH) {
        chosenW = landW;
        chosenH = landH;
        bestFit = fitLand;
      } else {
        chosenW = portW;
        chosenH = portH;
        bestFit = fitPort;
      }
    }
  }

  const { cols, rows, total } = bestFit;
  const gridW = cols > 0 ? cols * photoWidthPx + (cols - 1) * spacingPx : 0;
  const gridH = rows > 0 ? rows * photoHeightPx + (rows - 1) * spacingPx : 0;

  const startX = Math.max(0, Math.round((chosenW - gridW) / 2));
  const startY = Math.max(0, Math.round((chosenH - gridH) / 2));

  const positions: PhotoPosition[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        x: startX + c * (photoWidthPx + spacingPx),
        y: startY + r * (photoHeightPx + spacingPx)
      });
    }
  }

  return {
    sheetWidthPx: chosenW,
    sheetHeightPx: chosenH,
    cols,
    rows,
    totalPhotos: total,
    photoWidthPx,
    photoHeightPx,
    startX,
    startY,
    spacingPx,
    positions
  };
}

/**
 * Draws discrete cutting guide lines (light gray dashed lines) across cutting axes.
 */
export function drawCutGuides(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  layout: SheetLayout
): void {
  if (layout.cols === 0 || layout.rows === 0) return;
  if (typeof ctx.beginPath !== 'function') return;

  ctx.save();
  ctx.strokeStyle = '#CBD5E1'; // Light Slate Gray (visible on white, subtle)
  ctx.lineWidth = 1;
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([4, 4]);
  }

  const pW = layout.photoWidthPx;
  const pH = layout.photoHeightPx;
  const sp = layout.spacingPx;

  // Vertical cut lines for each column left & right boundaries
  for (let c = 0; c < layout.cols; c++) {
    const leftX = layout.startX + c * (pW + sp);
    const rightX = leftX + pW;

    // Draw full vertical guideline across the grid
    ctx.beginPath();
    ctx.moveTo(leftX, 0);
    ctx.lineTo(leftX, layout.sheetHeightPx);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightX, 0);
    ctx.lineTo(rightX, layout.sheetHeightPx);
    ctx.stroke();
  }

  // Horizontal cut lines for each row top & bottom boundaries
  for (let r = 0; r < layout.rows; r++) {
    const topY = layout.startY + r * (pH + sp);
    const bottomY = topY + pH;

    // Draw full horizontal guideline across the grid
    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(layout.sheetWidthPx, topY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, bottomY);
    ctx.lineTo(layout.sheetWidthPx, bottomY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders a full multi-photo print sheet canvas from a single cropped photo source.
 */
export function renderSheet(
  sourceImage: CanvasImageSource,
  layout: SheetLayout,
  cutGuides: boolean
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(layout.sheetWidthPx, layout.sheetHeightPx);
  const ctx = canvas.getContext('2d')!;

  // Fill sheet background with pure white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, layout.sheetWidthPx, layout.sheetHeightPx);

  // Draw cutting guides in background if enabled
  if (cutGuides) {
    drawCutGuides(ctx, layout);
  }

  // Draw tiled photos
  for (const pos of layout.positions) {
    ctx.drawImage(
      sourceImage,
      pos.x,
      pos.y,
      layout.photoWidthPx,
      layout.photoHeightPx
    );
  }

  return canvas;
}
