import { EncodedResult, ExportConfig, TransformState, SheetConfig } from '../types';
import { Brand, getBrand } from './brand';
import WorkerConstructor from '../workers/export.worker.ts?worker';

export const MAX_NUSUK_BYTES = 1_000_000;

export function formatFileSize(bytes: number): string {
  return (bytes / 1000).toFixed(0);
}

export function getExportFilename(
  w: number,
  h: number,
  format: string,
  sheetConfig?: SheetConfig,
  brand: Brand = getBrand()
): string {
  const ext = format === 'image/png' ? 'png' : 'jpg';
  const prefix = brand === 'nusuk' ? 'photo-nusuk' : 'photo-portrait';
  if (sheetConfig && sheetConfig.enabled) {
    const sheetPrefix = brand === 'nusuk' ? 'planche-photo-nusuk' : 'planche-photo-portrait';
    const presetLabel =
      sheetConfig.preset === 'custom'
        ? `${sheetConfig.width}x${sheetConfig.height}${sheetConfig.unit}`
        : sheetConfig.preset;
    return `${sheetPrefix}-${presetLabel}.${ext}`;
  }
  return `${prefix}-${w}x${h}.${ext}`;
}

let activeWorker: Worker | null = null;
let currentRequestId = 0;

export function getExportWorker(): Worker {
  if (!activeWorker) {
    activeWorker = new WorkerConstructor();
  }
  return activeWorker;
}

export function terminateExportWorker(): void {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
}

export function setExportWorker(worker: Worker | null): void {
  if (activeWorker && activeWorker !== worker) {
    activeWorker.terminate();
  }
  activeWorker = worker;
}

export function renderAndEncode(
  bitmap: ImageBitmap,
  cropWidth: number,
  cropHeight: number,
  transform: TransformState,
  config: ExportConfig,
  sheetConfigOrSignal?: SheetConfig | AbortSignal,
  maybeSignal?: AbortSignal
): Promise<EncodedResult> {
  let sheetConfig: SheetConfig | undefined;
  let signal: AbortSignal | undefined;

  if (sheetConfigOrSignal && 'aborted' in sheetConfigOrSignal) {
    signal = sheetConfigOrSignal as AbortSignal;
    sheetConfig = undefined;
  } else {
    sheetConfig = sheetConfigOrSignal as SheetConfig | undefined;
    signal = maybeSignal;
  }

  if (signal?.aborted) {
    return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
  }

  return new Promise<EncodedResult>((resolve, reject) => {
    const worker = getExportWorker();
    const id = ++currentRequestId;

    const cleanup = () => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', onError);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const onError = (e: ErrorEvent) => {
      cleanup();
      reject(new Error(e.message || 'Worker encoding error'));
    };

    const onAbort = () => {
      cleanup();
      try {
        worker.postMessage({ id, type: 'cancel' });
      } catch {
        // Worker might already be terminated
      }
      reject(new DOMException('The operation was aborted', 'AbortError'));
    };

    const handler = (e: MessageEvent) => {
      if (e.data && e.data.id === id) {
        cleanup();
        resolve({
          blob: e.data.blob,
          width: e.data.width,
          height: e.data.height,
          bytes: e.data.bytes,
          adjustedQuality: e.data.adjustedQuality
        });
      }
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    worker.addEventListener('message', handler);
    worker.addEventListener('error', onError);
    worker.postMessage({
      id,
      bitmap,
      cropWidth,
      cropHeight,
      transform,
      config,
      sheetConfig
    });
  });
}
