import { EncodedResult, ExportConfig, TransformState, SheetConfig } from '../types';
import { Brand, getBrand } from './brand';
import WorkerConstructor from '../workers/export.worker.ts?worker';

// ============================================================================
// CONFIGURATION DES LIMITES D'EXPORTATION (POIDS EN OCTETS)
// ============================================================================
// Modifiez facilement ces variables selon vos besoins ou via les variables d'environnement VITE_ :
// - MAX_NUSUK_BYTES : Le portail officiel Nusuk exige strictement des fichiers <= 1 Mo (1 000 000 octets).
// - MAX_PORTRAIT_BYTES : Limite générique pour photos d'identité et documents (10 Mo par défaut).
// - MIN_NUSUK_JPG_BYTES : En mode Nusuk, si un export JPG passe en dessous de 100 Ko (100 000 octets), basculer en PNG.
export let MAX_NUSUK_BYTES: number =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAX_NUSUK_BYTES
    ? Number(import.meta.env.VITE_MAX_NUSUK_BYTES)
    : 1_000_000;

export let MAX_PORTRAIT_BYTES: number =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAX_PORTRAIT_BYTES
    ? Number(import.meta.env.VITE_MAX_PORTRAIT_BYTES)
    : 10_000_000;

export let MIN_NUSUK_JPG_BYTES: number =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIN_NUSUK_JPG_BYTES
    ? Number(import.meta.env.VITE_MIN_NUSUK_JPG_BYTES)
    : 100_000;

/**
 * Retourne le seuil minimal en octets sous lequel un JPG en mode Nusuk doit basculer en PNG (100 Ko par défaut).
 */
export function getMinNusukJpgBytes(): number {
  return MIN_NUSUK_JPG_BYTES;
}

/**
 * Modifie dynamiquement le seuil minimal JPG pour le mode Nusuk.
 */
export function setMinNusukJpgBytes(bytes: number): void {
  MIN_NUSUK_JPG_BYTES = bytes;
}

/**
 * Retourne la limite de poids maximale en octets selon la marque (nusuk vs portrait).
 */
export function getMaxExportBytes(brand: Brand = getBrand()): number {
  return brand === 'nusuk' ? MAX_NUSUK_BYTES : MAX_PORTRAIT_BYTES;
}

/**
 * Modifie dynamiquement la limite de poids d'exportation pour une marque.
 */
export function setMaxExportBytes(brand: Brand, bytes: number): void {
  if (brand === 'nusuk') {
    MAX_NUSUK_BYTES = bytes;
  } else {
    MAX_PORTRAIT_BYTES = bytes;
  }
}

/**
 * Formate la limite maximale en Mo pour l'affichage (ex: "1", "10", "2.5").
 */
export function formatMaxMb(bytes: number): string {
  const mb = bytes / 1_000_000;
  return Number.isInteger(mb) ? mb.toString() : mb.toFixed(1);
}

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
