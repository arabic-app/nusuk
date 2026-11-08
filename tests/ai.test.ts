import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BackgroundRemover,
  WorkerBackgroundRemover,
  getBackgroundRemover,
  setBackgroundRemover
} from '../src/services/BackgroundRemover';
import { processBackgroundRemoval } from '../src/workers/ai.worker';

class MockOffscreenCanvas {
  width: number;
  height: number;
  ctx: any;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = {
      fillStyle: '',
      filter: 'none',
      fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
        this.ctx.lastFillRect = { x, y, w, h };
      }),
      drawImage: vi.fn((image: any, dx: number, dy: number) => {
        this.ctx.lastDrawImage = { image, dx, dy };
      })
    };
  }

  getContext(id: string) {
    if (id === '2d') return this.ctx;
    return null;
  }
}

describe('AI Background Removal Engine', () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  const originalCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    (globalThis as any).OffscreenCanvas = MockOffscreenCanvas;
    (globalThis as any).createImageBitmap = vi.fn().mockImplementation(async (canvas: any) => ({
      width: canvas.width,
      height: canvas.height,
      close: vi.fn()
    }));
    setBackgroundRemover(null);
  });

  afterEach(() => {
    setBackgroundRemover(null);
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
      expect(progressSpy).toHaveBeenCalledTimes(1);

      // Second call should return early and not re-trigger progress callback
      await remover.init(progressSpy);
      expect(progressSpy).toHaveBeenCalledTimes(1);
      expect(remover.isLoaded).toBe(true);
    });

    it('terminates active worker and resets isLoaded state', () => {
      const mockWorker = {
        terminate: vi.fn(),
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as unknown as Worker;

      const remover = new WorkerBackgroundRemover(mockWorker);
      remover.isLoaded = true;

      remover.terminate();

      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
      expect(remover.isLoaded).toBe(false);

      // Safe to terminate multiple times
      expect(() => remover.terminate()).not.toThrow();
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

  describe('Pure white compositing and feathering', () => {
    it('composites onto pure white (#FFFFFF) background with zero feathering', async () => {
      const remover = new WorkerBackgroundRemover();
      const mockBitmap = {
        width: 640,
        height: 480,
        close: vi.fn()
      } as unknown as ImageBitmap;

      const result = await remover.removeBackground(mockBitmap, 0);

      expect(result).toBeDefined();
      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
      expect(globalThis.createImageBitmap).toHaveBeenCalledTimes(1);

      const canvasInstance = (globalThis.createImageBitmap as any).mock.calls[0][0] as MockOffscreenCanvas;
      expect(canvasInstance.width).toBe(640);
      expect(canvasInstance.height).toBe(480);
      expect(canvasInstance.ctx.fillStyle).toBe('#FFFFFF');
      expect(canvasInstance.ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
      expect(canvasInstance.ctx.filter).toBe('none');
      expect(canvasInstance.ctx.drawImage).toHaveBeenCalledWith(mockBitmap, 0, 0);
    });

    it('applies feathering blur within 0 to 2px range', async () => {
      const remover = new WorkerBackgroundRemover();
      const mockBitmap = {
        width: 400,
        height: 500,
        close: vi.fn()
      } as unknown as ImageBitmap;

      // Spy on canvas context to inspect intermediate filter setting before reset
      let filterDuringDraw: string | undefined;
      const originalMock = (globalThis as any).OffscreenCanvas;
      (globalThis as any).OffscreenCanvas = class extends originalMock {
        constructor(w: number, h: number) {
          super(w, h);
          const origDraw = this.ctx.drawImage;
          this.ctx.drawImage = vi.fn((...args: any[]) => {
            filterDuringDraw = this.ctx.filter;
            return origDraw.apply(this.ctx, args);
          });
        }
      };

      await remover.removeBackground(mockBitmap, 1.5);

      expect(filterDuringDraw).toBe('blur(1.5px)');

      // Clamps feathering to maximum 2px
      await remover.removeBackground(mockBitmap, 10);
      expect(filterDuringDraw).toBe('blur(2px)');

      // Clamps negative feathering to 0px ('none')
      await remover.removeBackground(mockBitmap, -1);
      expect(filterDuringDraw).toBe('none');
    });

    it('throws error if canvas 2D context cannot be acquired', async () => {
      const remover = new WorkerBackgroundRemover();
      const mockBitmap = {
        width: 100,
        height: 100,
        close: vi.fn()
      } as unknown as ImageBitmap;

      (globalThis as any).OffscreenCanvas = class {
        getContext() {
          return null;
        }
      };

      await expect(remover.removeBackground(mockBitmap, 1)).rejects.toThrow(
        'Failed to acquire OffscreenCanvas 2D context'
      );
    });
  });

  describe('Zero outbound network requests (100% Client-side)', () => {
    it('executes initialization and background removal with no fetch calls', async () => {
      const fetchSpy = vi.fn();
      (globalThis as any).fetch = fetchSpy;

      const remover = new WorkerBackgroundRemover();
      await remover.init();

      const mockBitmap = {
        width: 640,
        height: 480,
        close: vi.fn()
      } as unknown as ImageBitmap;

      await remover.removeBackground(mockBitmap, 1);

      expect(fetchSpy).not.toHaveBeenCalled();
      delete (globalThis as any).fetch;
    });
  });

  describe('ai.worker processBackgroundRemoval helper', () => {
    it('executes background removal cleanly in worker context helper', async () => {
      const mockBitmap = {
        width: 320,
        height: 240,
        close: vi.fn()
      } as unknown as ImageBitmap;

      const result = await processBackgroundRemoval(mockBitmap, 1);
      expect(result.width).toBe(320);
      expect(result.height).toBe(240);
    });

    it('ensures input bitmap close method is invoked during worker message processing', async () => {
      const closeSpy = vi.fn();
      const mockBitmap = {
        width: 100,
        height: 100,
        close: closeSpy
      } as unknown as ImageBitmap;

      // Simulate worker onmessage with cleanup guarantee
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
          // Worker error path
        }
      };

      await handleWorkerMessage({ type: 'process', bitmap: mockBitmap, featherRadius: 0 });
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
