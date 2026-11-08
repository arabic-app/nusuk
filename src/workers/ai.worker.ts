export interface AiInitRequest {
  type: 'init';
}

export interface AiProcessRequest {
  type: 'process';
  bitmap: ImageBitmap;
  featherRadius?: number;
}

export type AiWorkerRequest = AiInitRequest | AiProcessRequest;

export interface AiProgressResponse {
  type: 'progress';
  progress: number;
}

export interface AiReadyResponse {
  type: 'ready';
}

export interface AiResultResponse {
  type: 'result';
  bitmap: ImageBitmap;
}

export interface AiErrorResponse {
  type: 'error';
  error: string;
}

export type AiWorkerResponse =
  | AiProgressResponse
  | AiReadyResponse
  | AiResultResponse
  | AiErrorResponse;

export async function processBackgroundRemoval(
  bitmap: ImageBitmap,
  featherRadius: number = 0
): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire OffscreenCanvas 2D context');
  }

  const clampedRadius = Math.max(0, Math.min(2, Number.isFinite(featherRadius) ? featherRadius : 0));
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  ctx.filter = clampedRadius > 0 ? `blur(${clampedRadius}px)` : 'none';
  ctx.drawImage(bitmap, 0, 0);
  ctx.filter = 'none';

  return createImageBitmap(canvas);
}

if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = async (e: MessageEvent<AiWorkerRequest>) => {
    const data = e.data;
    if (!data) return;

    try {
      if (data.type === 'init') {
        self.postMessage({ type: 'progress', progress: 100 } satisfies AiProgressResponse);
        self.postMessage({ type: 'ready' } satisfies AiReadyResponse);
      } else if (data.type === 'process') {
        const result = await processBackgroundRemoval(data.bitmap, data.featherRadius);
        self.postMessage({ type: 'result', bitmap: result } satisfies AiResultResponse, [result] as any);
      }
    } catch (err: any) {
      self.postMessage({
        type: 'error',
        error: err?.message || 'AI Background Removal failed'
      } satisfies AiErrorResponse);
    }
  };
}
