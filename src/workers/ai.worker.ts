import { env, AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';

// Configure transformers.js for 100% client-side local inference (zero network leakage)
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/';

if (env.backends?.onnx) {
  const onnxBackend = env.backends.onnx as any;
  onnxBackend.wasm = onnxBackend.wasm || {};
  onnxBackend.wasm.wasmPaths = '/vendor/ort/';
  onnxBackend.wasm.proxy = false;
}

export interface AiInitRequest {
  id?: number;
  type: 'init';
}

export interface AiProcessRequest {
  id: number;
  type: 'process';
  bitmap: ImageBitmap;
  featherRadius?: number;
  useCachedMask?: boolean;
}

export type AiWorkerRequest = AiInitRequest | AiProcessRequest;

export interface AiProgressResponse {
  id?: number;
  type: 'progress';
  progress: number;
}

export interface AiReadyResponse {
  id?: number;
  type: 'ready';
}

export interface AiResultResponse {
  id: number;
  type: 'result';
  bitmap: ImageBitmap;
}

export interface AiErrorResponse {
  id?: number;
  type: 'error';
  error: string;
}

export type AiWorkerResponse =
  | AiProgressResponse
  | AiReadyResponse
  | AiResultResponse
  | AiErrorResponse;

let model: any = null;
let processor: any = null;
let modelLoadPromise: Promise<void> | null = null;

// Cache 512x512 mask for active image so feather slider adjustments skip model inference
let cachedMask: any = null; // RawImage (512x512, 1-channel)
let cachedWidth = 0;
let cachedHeight = 0;

export async function initAi(onProgress?: (progress: number) => void): Promise<void> {
  if (model && processor) {
    onProgress?.(100);
    return;
  }

  if (!modelLoadPromise) {
    modelLoadPromise = (async () => {
      onProgress?.(10);
      model = await AutoModel.from_pretrained('modnet', {
        model_file_name: 'model_quantized',
        progress_callback: (info: any) => {
          if (info && typeof info.progress === 'number') {
            onProgress?.(Math.round(info.progress));
          }
        }
      });
      onProgress?.(80);
      processor = await AutoProcessor.from_pretrained('modnet');
      onProgress?.(100);
    })();
  }

  await modelLoadPromise;
}

export async function processBackgroundRemoval(
  bitmap: ImageBitmap,
  featherRadius: number = 0,
  useCachedMask: boolean = false
): Promise<ImageBitmap> {
  const width = bitmap.width;
  const height = bitmap.height;

  // 1. Acquire source pixel data from ImageBitmap
  const srcCanvas = new OffscreenCanvas(width, height);
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) {
    throw new Error('Failed to acquire OffscreenCanvas 2D context');
  }
  srcCtx.drawImage(bitmap, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, width, height);

  // 2. Obtain alpha mask from model or cache
  let mask512: any = null;
  const canUseCache =
    useCachedMask &&
    cachedMask &&
    cachedWidth === width &&
    cachedHeight === height;

  if (canUseCache) {
    mask512 = cachedMask;
  } else {
    if (!model || !processor) {
      await initAi();
    }

    const rawImg = new RawImage(srcImageData.data, width, height, 4);
    const { pixel_values } = await processor(rawImg);
    const { output } = await model({ input: pixel_values });

    const maskH = output.dims[2];
    const maskW = output.dims[3];
    const maskBytes = new Uint8ClampedArray(maskW * maskH);
    for (let i = 0; i < output.data.length; i++) {
      maskBytes[i] = Math.round(Math.min(1, Math.max(0, output.data[i])) * 255);
    }

    mask512 = new RawImage(maskBytes, maskW, maskH, 1);
    cachedMask = mask512;
    cachedWidth = width;
    cachedHeight = height;
  }

  // 3. Resize mask to original image dimensions
  const resizedMask = await mask512.resize(width, height);

  // 4. Feathering / Edge softening (0 to 2 px)
  const clampedFeather = Math.max(0, Math.min(2, Number.isFinite(featherRadius) ? featherRadius : 0));
  let finalAlpha: Uint8ClampedArray | Uint8Array = resizedMask.data;

  if (clampedFeather > 0) {
    const maskCanvas = new OffscreenCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (maskCtx) {
      const maskImgData = maskCtx.createImageData(width, height);
      for (let i = 0; i < width * height; i++) {
        const val = resizedMask.data[i];
        const idx = i * 4;
        maskImgData.data[idx] = val;
        maskImgData.data[idx + 1] = val;
        maskImgData.data[idx + 2] = val;
        maskImgData.data[idx + 3] = 255;
      }
      maskCtx.putImageData(maskImgData, 0, 0);

      const blurCanvas = new OffscreenCanvas(width, height);
      const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
      if (blurCtx) {
        blurCtx.filter = `blur(${clampedFeather}px)`;
        blurCtx.drawImage(maskCanvas, 0, 0);
        blurCtx.filter = 'none';
        const blurredImgData = blurCtx.getImageData(0, 0, width, height);
        const blurredAlpha = new Uint8ClampedArray(width * height);
        for (let i = 0; i < width * height; i++) {
          blurredAlpha[i] = blurredImgData.data[i * 4];
        }
        finalAlpha = blurredAlpha;
      }
    }
  }

  // 5. Composite onto pure white #FFFFFF: dest = src * alpha + 255 * (1 - alpha)
  const outCanvas = new OffscreenCanvas(width, height);
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) {
    throw new Error('Failed to acquire OffscreenCanvas 2D context for output');
  }

  const outImgData = outCtx.createImageData(width, height);
  const srcData = srcImageData.data;
  const outData = outImgData.data;

  for (let i = 0; i < width * height; i++) {
    const a = finalAlpha[i] / 255;
    const invA = 1 - a;
    const idx = i * 4;

    outData[idx] = Math.round(srcData[idx] * a + 255 * invA);
    outData[idx + 1] = Math.round(srcData[idx + 1] * a + 255 * invA);
    outData[idx + 2] = Math.round(srcData[idx + 2] * a + 255 * invA);
    outData[idx + 3] = 255;
  }

  outCtx.putImageData(outImgData, 0, 0);
  return createImageBitmap(outCanvas);
}

export function clearAiMaskCache(): void {
  cachedMask = null;
  cachedWidth = 0;
  cachedHeight = 0;
}

// For unit testing: allow injecting mocks for model and processor
export function setModelAndProcessorForTesting(mockModel: any, mockProcessor: any): void {
  model = mockModel;
  processor = mockProcessor;
  modelLoadPromise = Promise.resolve();
}

if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = async (e: MessageEvent<AiWorkerRequest>) => {
    const data = e.data;
    if (!data) return;

    try {
      if (data.type === 'init') {
        await initAi((progress) => {
          self.postMessage({ id: data.id, type: 'progress', progress } satisfies AiProgressResponse);
        });
        self.postMessage({ id: data.id, type: 'ready' } satisfies AiReadyResponse);
      } else if (data.type === 'process') {
        try {
          const result = await processBackgroundRemoval(
            data.bitmap,
            data.featherRadius,
            data.useCachedMask
          );
          self.postMessage(
            { id: data.id, type: 'result', bitmap: result } satisfies AiResultResponse,
            [result] as any
          );
        } finally {
          if (typeof data.bitmap?.close === 'function') {
            data.bitmap.close();
          }
        }
      }
    } catch (err: any) {
      self.postMessage({
        id: (data as any)?.id,
        type: 'error',
        error: err?.message || 'AI Background Removal failed'
      } satisfies AiErrorResponse);
    }
  };
}
