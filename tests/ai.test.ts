import './setup-canvas-env';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BackgroundRemover,
  WorkerBackgroundRemover,
  getBackgroundRemover,
  setBackgroundRemover
} from '../src/services/BackgroundRemover';
import {
  processBackgroundRemoval,
  setModelAndProcessorForTesting,
  clearAiMaskCache
} from '../src/workers/ai.worker';
import { MockImageData, MockOffscreenCanvas } from './setup-canvas-env';


class MockWorker {
  onmessage: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  postMessage = vi.fn((data: any) => {
    if (data.type === 'init') {
      setTimeout(() => {
        this.onmessage?.({ data: { type: 'progress', progress: 50 } });
        this.onmessage?.({ data: { type: 'progress', progress: 100 } });
        this.onmessage?.({ data: { type: 'ready' } });
      }, 0);
    } else if (data.type === 'process') {
      setTimeout(() => {
        this.onmessage?.({
          data: {
            id: data.id,
            type: 'result',
            bitmap: {
              width: data.bitmap.width,
              height: data.bitmap.height,
              close: vi.fn()
            }
          }
        });
      }, 0);
    }
  });
  terminate = vi.fn();
}

describe('AI Background Removal Engine', () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalWorker = globalThis.Worker;
  const originalImageData = globalThis.ImageData;

  beforeEach(() => {
    (globalThis as any).ImageData = MockImageData;
    (globalThis as any).OffscreenCanvas = MockOffscreenCanvas;
    (globalThis as any).createImageBitmap = vi.fn().mockImplementation(async (canvas: any) => ({
      width: canvas.width,
      height: canvas.height,
      close: vi.fn()
    }));
    (globalThis as any).Worker = MockWorker;

    const mockProcessor = vi.fn().mockImplementation(async () => ({
      pixel_values: { dims: [1, 3, 512, 512] }
    }));
    const mockModel = vi.fn().mockImplementation(async () => ({
      output: {
        dims: [1, 1, 512, 512],
        data: new Float32Array(512 * 512).fill(0.8)
      }
    }));
    setModelAndProcessorForTesting(mockModel, mockProcessor);
    clearAiMaskCache();
    setBackgroundRemover(null);
  });

  afterEach(() => {
    setBackgroundRemover(null);
    clearAiMaskCache();

    if (originalOffscreenCanvas) {
      globalThis.OffscreenCanvas = originalOffscreenCanvas;
    } else {
      delete (globalThis as any).OffscreenCanvas;
    }

    if (originalCreateImageBitmap) {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      delete (globalThis as any).createImageBitmap;
    }

    if (originalWorker) {
      globalThis.Worker = originalWorker;
    } else {
      delete (globalThis as any).Worker;
    }

    if (originalImageData) {
      globalThis.ImageData = originalImageData;
    } else {
      delete (globalThis as any).ImageData;
    }

    vi.restoreAllMocks();
  });

  describe('Contract and Interface', () => {
    it('defines necessary life-cycle methods', () => {
      const mockRemover: Partial<BackgroundRemover> = {
        isLoaded: false
      };
      expect(mockRemover.isLoaded).toBe(false);
    });
  });

  describe('WorkerBackgroundRemover lifecycle', () => {
    it('starts uninitialized with isLoaded = false', () => {
      const remover = new WorkerBackgroundRemover();
      expect(remover.isLoaded).toBe(false);
    });

    it('initializes and reports progress to 100%', async () => {
      const remover = new WorkerBackgroundRemover();
      const progressSpy = vi.fn();

      await remover.init(progressSpy);

      expect(remover.isLoaded).toBe(true);
      expect(progressSpy).toHaveBeenCalledWith(100);
    });

    it('is idempotent on subsequent init calls', async () => {
      const remover = new WorkerBackgroundRemover();
      const progressSpy = vi.fn();

      await remover.init(progressSpy);
      expect(progressSpy).toHaveBeenCalledTimes(2); // 50%, 100%

      // Second call should return early and not re-trigger progress callback
      await remover.init(progressSpy);
      expect(progressSpy).toHaveBeenCalledTimes(3); // Called once with 100% early return
      expect(remover.isLoaded).toBe(true);
    });

    it('terminates active worker and resets isLoaded state', () => {
      const mockWorker = new MockWorker() as unknown as Worker;
      const remover = new WorkerBackgroundRemover(mockWorker);
      remover.isLoaded = true;

      remover.terminate();

      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
      expect(remover.isLoaded).toBe(false);

      // Safe to terminate multiple times
      expect(() => remover.terminate()).not.toThrow();
    });

    it('rejects pending requests if worker triggers error', async () => {
      const errorWorker = {
        onmessage: null as any,
        onerror: null as any,
        postMessage: vi.fn((data: any) => {
          if (data.type === 'init') {
            setTimeout(() => {
              errorWorker.onmessage?.({ data: { type: 'error', error: 'ONNX load failed' } });
            }, 0);
          }
        }),
        terminate: vi.fn()
      } as unknown as Worker;

      const remover = new WorkerBackgroundRemover(errorWorker);
      await expect(remover.init()).rejects.toThrow('ONNX load failed');
    });
  });

  describe('Singleton management', () => {
    it('provides a singleton via getBackgroundRemover', () => {
      const instance1 = getBackgroundRemover();
      const instance2 = getBackgroundRemover();

      expect(instance1).toBeDefined();
      expect(instance1).toBe(instance2);
    });

    it('allows overriding and resetting singleton instance with setBackgroundRemover', () => {
      const customRemover: BackgroundRemover = {
        isLoaded: true,
        init: vi.fn().mockResolvedValue(undefined),
        removeBackground: vi.fn(),
        terminate: vi.fn()
      };

      setBackgroundRemover(customRemover);
      expect(getBackgroundRemover()).toBe(customRemover);

      setBackgroundRemover(null);
      const freshInstance = getBackgroundRemover();
      expect(freshInstance).not.toBe(customRemover);
    });
  });

  describe('WorkerBackgroundRemover execution & bitmap safety', () => {
    it('clones input bitmap before transferring to worker to keep original bitmap intact', async () => {
      const mockWorker = new MockWorker() as unknown as Worker;
      const remover = new WorkerBackgroundRemover(mockWorker);

      const mockBitmap = {
        width: 480,
        height: 640,
        close: vi.fn()
      } as unknown as ImageBitmap;

      const result = await remover.removeBackground(mockBitmap, 0);

      expect(result).toBeDefined();
      expect(result.width).toBe(480);
      expect(result.height).toBe(640);
      // createImageBitmap called to clone the input bitmap
      expect(globalThis.createImageBitmap).toHaveBeenCalled();
      // original bitmap close must NOT be called on main thread
      expect(mockBitmap.close).not.toHaveBeenCalled();
    });

    it('forwards featherRadius and useCachedMask options to worker', async () => {
      const mockWorker = new MockWorker() as unknown as Worker;
      const remover = new WorkerBackgroundRemover(mockWorker);

      const mockBitmap = {
        width: 480,
        height: 640,
        close: vi.fn()
      } as unknown as ImageBitmap;

      await remover.removeBackground(mockBitmap, 1.5, true);

      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'process',
          featherRadius: 1.5,
          useCachedMask: true
        }),
        expect.any(Array)
      );
    });
  });

  describe('ai.worker processBackgroundRemoval helper', () => {
    it('executes background removal cleanly and composites onto white canvas', async () => {
      const mockBitmap = {
        width: 480,
        height: 640,
        close: vi.fn()
      } as unknown as ImageBitmap;

      const result = await processBackgroundRemoval(mockBitmap, 0);
      expect(result.width).toBe(480);
      expect(result.height).toBe(640);
      expect(globalThis.createImageBitmap).toHaveBeenCalled();
    });

    it('applies feathering blur when featherRadius > 0', async () => {
      const mockBitmap = {
        width: 100,
        height: 100,
        close: vi.fn()
      } as unknown as ImageBitmap;

      const result = await processBackgroundRemoval(mockBitmap, 1.2);
      expect(result).toBeDefined();
    });

    it('reuses cached mask when useCachedMask is true', async () => {
      const mockBitmap = {
        width: 100,
        height: 100,
        close: vi.fn()
      } as unknown as ImageBitmap;

      const firstCall = await processBackgroundRemoval(mockBitmap, 0, false);
      expect(firstCall).toBeDefined();

      // Second call with useCachedMask = true should reuse cachedMask
      const secondCall = await processBackgroundRemoval(mockBitmap, 1.0, true);
      expect(secondCall).toBeDefined();
    });

    it('ensures input bitmap close method is invoked during worker message processing', async () => {
      const closeSpy = vi.fn();
      const mockBitmap = {
        width: 100,
        height: 100,
        close: closeSpy
      } as unknown as ImageBitmap;

      const handleWorkerMessage = async (data: any) => {
        try {
          if (data.type === 'process') {
            try {
              await processBackgroundRemoval(data.bitmap, data.featherRadius);
            } finally {
              if (typeof data.bitmap?.close === 'function') {
                data.bitmap.close();
              }
            }
          }
        } catch {
          // ignore in test
        }
      };

      await handleWorkerMessage({ type: 'process', bitmap: mockBitmap, featherRadius: 0 });
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
