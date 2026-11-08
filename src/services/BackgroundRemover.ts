import AiWorker from '../workers/ai.worker.ts?worker';

export interface BackgroundRemover {
  isLoaded: boolean;
  init(onProgress?: (progress: number) => void): Promise<void>;
  removeBackground(
    bitmap: ImageBitmap,
    featherRadius?: number,
    useCachedMask?: boolean
  ): Promise<ImageBitmap>;
  terminate(): void;
}

interface PendingRequest {
  resolve: (bitmap: ImageBitmap) => void;
  reject: (err: Error) => void;
}

export class WorkerBackgroundRemover implements BackgroundRemover {
  public isLoaded = false;
  private worker: Worker | null = null;
  private currentRequestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private progressCallbacks = new Set<(progress: number) => void>();
  private pendingInitResolvers: Array<() => void> = [];
  private pendingInitRejecters: Array<(err: Error) => void> = [];

  constructor(worker?: Worker | null) {
    if (worker) {
      this.worker = worker;
      this.attachWorkerHandlers();
    }
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      if (typeof Worker === 'undefined') {
        throw new Error('Web Workers are not supported in this environment');
      }
      this.worker = new AiWorker();
      this.attachWorkerHandlers();
    }
    return this.worker;
  }

  private attachWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;

      if (data.type === 'progress') {
        for (const cb of this.progressCallbacks) {
          cb(data.progress);
        }
      } else if (data.type === 'ready') {
        this.isLoaded = true;
        const resolvers = [...this.pendingInitResolvers];
        this.pendingInitResolvers = [];
        this.pendingInitRejecters = [];
        resolvers.forEach((r) => r());
      } else if (data.type === 'result') {
        const req = this.pendingRequests.get(data.id);
        if (req) {
          this.pendingRequests.delete(data.id);
          req.resolve(data.bitmap);
        }
      } else if (data.type === 'error') {
        const err = new Error(data.error || 'AI Background Removal failed');
        if (data.id && this.pendingRequests.has(data.id)) {
          const req = this.pendingRequests.get(data.id);
          this.pendingRequests.delete(data.id);
          req?.reject(err);
        } else {
          const rejecters = [...this.pendingInitRejecters];
          this.pendingInitResolvers = [];
          this.pendingInitRejecters = [];
          rejecters.forEach((rej) => rej(err));
        }
      }
    };

    this.worker.onerror = (e: ErrorEvent) => {
      const err = new Error(e.message || 'Worker encountered an unexpected error');
      const rejecters = [...this.pendingInitRejecters];
      this.pendingInitResolvers = [];
      this.pendingInitRejecters = [];
      rejecters.forEach((rej) => rej(err));

      for (const req of this.pendingRequests.values()) {
        req.reject(err);
      }
      this.pendingRequests.clear();
    };
  }

  async init(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isLoaded) {
      onProgress?.(100);
      return;
    }

    if (onProgress) {
      this.progressCallbacks.add(onProgress);
    }

    const worker = this.ensureWorker();

    return new Promise<void>((resolve, reject) => {
      this.pendingInitResolvers.push(() => {
        if (onProgress) this.progressCallbacks.delete(onProgress);
        resolve();
      });
      this.pendingInitRejecters.push((err) => {
        if (onProgress) this.progressCallbacks.delete(onProgress);
        reject(err);
      });

      worker.postMessage({ type: 'init' });
    });
  }

  async removeBackground(
    bitmap: ImageBitmap,
    featherRadius: number = 0,
    useCachedMask: boolean = false
  ): Promise<ImageBitmap> {
    if (!this.isLoaded) {
      await this.init();
    }

    const worker = this.ensureWorker();
    const id = ++this.currentRequestId;

    // Clone bitmap so original remains intact and accessible on main thread
    const cloned = await createImageBitmap(bitmap);

    return new Promise<ImageBitmap>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      worker.postMessage(
        {
          id,
          type: 'process',
          bitmap: cloned,
          featherRadius,
          useCachedMask
        },
        [cloned]
      );
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isLoaded = false;
    this.progressCallbacks.clear();
    this.pendingInitResolvers = [];
    this.pendingInitRejecters = [];
    for (const req of this.pendingRequests.values()) {
      req.reject(new Error('BackgroundRemover terminated'));
    }
    this.pendingRequests.clear();
  }
}

let instance: BackgroundRemover | null = null;

export function getBackgroundRemover(): BackgroundRemover {
  if (!instance) {
    instance = new WorkerBackgroundRemover();
  }
  return instance;
}

export function setBackgroundRemover(remover: BackgroundRemover | null): void {
  if (instance && instance !== remover) {
    instance.terminate();
  }
  instance = remover;
}
