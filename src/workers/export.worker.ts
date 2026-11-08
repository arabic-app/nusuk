import { TransformState, ExportConfig, SheetConfig } from '../types';
import { calculateSheetLayout, renderSheet } from '../utils/sheetTiling';

export interface RenderRequest {
  id: number;
  bitmap: ImageBitmap;
  cropWidth: number;
  cropHeight: number;
  transform: TransformState;
  config: ExportConfig;
  sheetConfig?: SheetConfig;
  type?: 'render';
}

export interface CancelRequest {
  id: number;
  type: 'cancel';
}

export type WorkerMessage = RenderRequest | CancelRequest;

export interface RenderResponse {
  id: number;
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  adjustedQuality?: number;
}

// Progressive step-down halving to prevent aliasing
export function drawSmooth(
  ctx: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  cropW: number,
  cropH: number,
  transform: TransformState
): void {
  let source: CanvasImageSource = bitmap;
  let currentW = bitmap.width;
  let currentH = bitmap.height;
  let effectiveScale = transform.scale;

  // Progressive step-down halving when effectiveScale < 0.5 to prevent aliasing
  while (effectiveScale < 0.5 && currentW > 16 && currentH > 16) {
    const nextW = Math.max(1, Math.floor(currentW / 2));
    const nextH = Math.max(1, Math.floor(currentH / 2));
    const stepCanvas = new OffscreenCanvas(nextW, nextH);
    const stepCtx = stepCanvas.getContext('2d')!;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(source, 0, 0, nextW, nextH);
    source = stepCanvas;
    currentW = nextW;
    currentH = nextH;
    effectiveScale *= 2;
  }

  // Step 1: Render transformed image on buffer with pure white background
  const tempCanvas = new OffscreenCanvas(cropW, cropH);
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = 'high';

  // Background pure white
  tempCtx.fillStyle = '#FFFFFF';
  tempCtx.fillRect(0, 0, cropW, cropH);

  tempCtx.save();
  tempCtx.translate(cropW / 2 + transform.tx, cropH / 2 + transform.ty);
  tempCtx.rotate((transform.rotation * Math.PI) / 180);
  tempCtx.scale(transform.flipX ? -effectiveScale : effectiveScale, effectiveScale);
  tempCtx.drawImage(source, -currentW / 2, -currentH / 2);
  tempCtx.restore();

  // Final draw to target
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, cropW, cropH);
  ctx.drawImage(tempCanvas, 0, 0);
}

export async function processRenderRequest(
  request: RenderRequest,
  isCancelled?: (id: number) => boolean
): Promise<RenderResponse | null> {
  const { id, bitmap, cropWidth, cropHeight, transform, config } = request;
  if (isCancelled && isCancelled(id)) return null;

  const canvas = new OffscreenCanvas(cropWidth, cropHeight);
  const ctx = canvas.getContext('2d')!;

  try {
    drawSmooth(ctx, bitmap, cropWidth, cropHeight, transform);
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }

  if (isCancelled && isCancelled(id)) return null;

  let targetCanvas: OffscreenCanvas = canvas;
  let finalWidth = cropWidth;
  let finalHeight = cropHeight;

  if (request.sheetConfig && request.sheetConfig.enabled) {
    const layout = calculateSheetLayout(cropWidth, cropHeight, request.sheetConfig);
    if (layout.totalPhotos > 0) {
      targetCanvas = renderSheet(canvas, layout, request.sheetConfig.cutGuides);
      finalWidth = layout.sheetWidthPx;
      finalHeight = layout.sheetHeightPx;
    }
  }

  if (config.format === 'image/png') {
    const blob = await targetCanvas.convertToBlob({ type: 'image/png' });
    if (isCancelled && isCancelled(id)) return null;

    return {
      id,
      blob,
      bytes: blob.size,
      width: finalWidth,
      height: finalHeight
    };
  }

  // JPEG encoding with dichotomous search for <= config.maxBytes
  const maxBytes = config.maxBytes ?? 1_000_000;
  const initialQuality = config.quality ?? 0.95;
  const quality = initialQuality;
  const blob = await targetCanvas.convertToBlob({ type: 'image/jpeg', quality });

  if (blob.size > maxBytes) {
    let low = Math.min(0.70, quality);
    let high = quality;
    let bestBlob = blob;
    let bestQuality = quality;

    for (let i = 0; i < 5; i++) {
      if (isCancelled && isCancelled(id)) return null;

      const mid = Number(((low + high) / 2).toFixed(2));
      const testBlob = await targetCanvas.convertToBlob({ type: 'image/jpeg', quality: mid });

      if (testBlob.size <= maxBytes) {
        bestBlob = testBlob;
        bestQuality = mid;
        low = mid; // try to get higher quality
      } else {
        high = mid; // reduce quality
        if (bestQuality === initialQuality || (bestBlob.size > maxBytes && testBlob.size < bestBlob.size)) {
          // If no compliant blob found yet, keep smallest size tested
          bestBlob = testBlob;
          bestQuality = mid;
        }
      }
    }

    if (isCancelled && isCancelled(id)) return null;

    return {
      id,
      blob: bestBlob,
      bytes: bestBlob.size,
      width: finalWidth,
      height: finalHeight,
      adjustedQuality: bestQuality !== initialQuality ? bestQuality : undefined
    };
  }

  return {
    id,
    blob,
    bytes: blob.size,
    width: finalWidth,
    height: finalHeight
  };
}

const cancelledIds = new Set<number>();

if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const data = e.data;
    if (!data) return;

    if ('type' in data && data.type === 'cancel') {
      cancelledIds.add(data.id);
      return;
    }

    const response = await processRenderRequest(data as RenderRequest, (id) => cancelledIds.has(id));
    cancelledIds.delete(data.id);

    if (response) {
      self.postMessage(response);
    }
  };
}
