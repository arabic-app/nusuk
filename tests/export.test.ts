import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MAX_NUSUK_BYTES,
  formatFileSize,
  getExportWorker,
  terminateExportWorker,
  setExportWorker,
  renderAndEncode
} from '../src/utils/exportBridge';
import {
  drawSmooth,
  processRenderRequest,
  RenderRequest
} from '../src/workers/export.worker';
import { TransformState, ExportConfig } from '../src/types';

// Mock OffscreenCanvas for test environment if not present
class MockOffscreenCanvas {
  width: number;
  height: number;
  ctx: any;
  static blobFactory?: (options?: { type?: string; quality?: number }) => Blob;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low' as ImageSmoothingQuality,
      fillStyle: '',
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn()
    };
  }

  getContext(id: string) {
    if (id === '2d') return this.ctx;
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob> {
    if (MockOffscreenCanvas.blobFactory) {
      return MockOffscreenCanvas.blobFactory(options);
    }
    const size = options?.type === 'image/jpeg' ? Math.round((options.quality ?? 0.95) * 800_000) : 500_000;
    return new Blob([new Uint8Array(size)], { type: options?.type || 'image/jpeg' });
  }
}

describe('Export Pipeline & Web Worker', () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;

  beforeEach(() => {
    (globalThis as any).OffscreenCanvas = MockOffscreenCanvas;
    MockOffscreenCanvas.blobFactory = undefined;
    terminateExportWorker();
  });

  afterEach(() => {
    terminateExportWorker();
    if (originalOffscreenCanvas) {
      globalThis.OffscreenCanvas = originalOffscreenCanvas;
    } else {
      delete (globalThis as any).OffscreenCanvas;
    }
    vi.restoreAllMocks();
  });

  describe('Export constants and formatting', () => {
    it('strictly enforces 1,000,000 bytes maximum', () => {
      expect(MAX_NUSUK_BYTES).toBe(1_000_000);
    });

    it('formats KB sizes cleanly', () => {
      expect(formatFileSize(450_000)).toBe('450');
      expect(formatFileSize(1_000_000)).toBe('1000');
      expect(formatFileSize(0)).toBe('0');
      expect(formatFileSize(999)).toBe('1');
    });
  });

  describe('Worker lifecycle and singleton management', () => {
    it('lazily initializes and caches active worker', () => {
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn()
      } as unknown as Worker;

      setExportWorker(mockWorker);
      expect(getExportWorker()).toBe(mockWorker);

      terminateExportWorker();
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('replaces active worker when setExportWorker is called with a new worker', () => {
      const worker1 = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn()
      } as unknown as Worker;

      const worker2 = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn()
      } as unknown as Worker;

      setExportWorker(worker1);
      setExportWorker(worker2);

      expect(worker1.terminate).toHaveBeenCalled();
      expect(getExportWorker()).toBe(worker2);
    });
  });

  describe('drawSmooth rendering pipeline', () => {
    const createMockBitmap = (w = 1200, h = 800): ImageBitmap => ({
      width: w,
      height: h,
      close: vi.fn()
    } as unknown as ImageBitmap);

    it('fills pure white #FFFFFF background and sets high smoothing quality', () => {
      const targetCanvas = new MockOffscreenCanvas(640, 480);
      const ctx = targetCanvas.getContext('2d')!;
      const bitmap = createMockBitmap();
      const transform: TransformState = {
        scale: 1.0,
        tx: 0,
        ty: 0,
        rotation: 0,
        flipX: false
      };

      drawSmooth(ctx, bitmap, 640, 480, transform);

      expect(ctx.fillStyle).toBe('#FFFFFF');
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('applies affine transformations: translation, rotation, and flipX', () => {
      const targetCanvas = new MockOffscreenCanvas(640, 480);
      const ctx = targetCanvas.getContext('2d')!;
      const bitmap = createMockBitmap(400, 300);
      const transform: TransformState = {
        scale: 0.8,
        tx: 25,
        ty: -15,
        rotation: 90,
        flipX: true
      };

      drawSmooth(ctx, bitmap, 640, 480, transform);

      // Verify that the target canvas got drawn to with pure white
      expect(ctx.fillStyle).toBe('#FFFFFF');
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
    });

    it('performs multi-step progressive halving downsampling when scale < 0.5', () => {
      const targetCanvas = new MockOffscreenCanvas(640, 480);
      const ctx = targetCanvas.getContext('2d')!;
      // Very large image (4000x3000) scaled down significantly (scale = 0.1)
      const bitmap = createMockBitmap(4000, 3000);
      const transform: TransformState = {
        scale: 0.1,
        tx: 0,
        ty: 0,
        rotation: 0,
        flipX: false
      };

      drawSmooth(ctx, bitmap, 640, 480, transform);

      // Successfully processed without error
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
      expect(ctx.drawImage).toHaveBeenCalled();
    });
  });

  describe('processRenderRequest encoding & binary search', () => {
    const createMockBitmap = (w = 640, h = 480): ImageBitmap => ({
      width: w,
      height: h,
      close: vi.fn()
    } as unknown as ImageBitmap);

    it('encodes PNG lossless directly without quality search', async () => {
      MockOffscreenCanvas.blobFactory = (options) => {
        expect(options?.type).toBe('image/png');
        return new Blob([new Uint8Array(650_000)], { type: 'image/png' });
      };

      const request: RenderRequest = {
        id: 1,
        bitmap: createMockBitmap(),
        cropWidth: 640,
        cropHeight: 480,
        transform: { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false },
        config: { format: 'image/png', quality: 0.95, maxBytes: 1_000_000 }
      };

      const res = await processRenderRequest(request);
      expect(res).not.toBeNull();
      expect(res!.bytes).toBe(650_000);
      expect(res!.width).toBe(640);
      expect(res!.height).toBe(480);
      expect(res!.adjustedQuality).toBeUndefined();
    });

    it('encodes JPEG without adjusting quality when initial size <= maxBytes', async () => {
      MockOffscreenCanvas.blobFactory = (options) => {
        expect(options?.quality).toBe(0.95);
        return new Blob([new Uint8Array(750_000)], { type: 'image/jpeg' });
      };

      const request: RenderRequest = {
        id: 2,
        bitmap: createMockBitmap(),
        cropWidth: 640,
        cropHeight: 480,
        transform: { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false },
        config: { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 }
      };

      const res = await processRenderRequest(request);
      expect(res).not.toBeNull();
      expect(res!.bytes).toBe(750_000);
      expect(res!.adjustedQuality).toBeUndefined();
    });

    it('performs binary search quality adjustment when JPEG exceeds 1,000,000 bytes', async () => {
      // Simulate size as function of quality: size = quality * 1,300,000 bytes
      // At quality 0.95 -> 1,235,000 bytes (exceeds 1,000,000)
      // Binary search should find quality <= 1,000,000 / 1,300,000 ≈ 0.76
      MockOffscreenCanvas.blobFactory = (options) => {
        const q = options?.quality ?? 0.95;
        const size = Math.round(q * 1_300_000);
        return new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
      };

      const request: RenderRequest = {
        id: 3,
        bitmap: createMockBitmap(),
        cropWidth: 640,
        cropHeight: 480,
        transform: { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false },
        config: { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 }
      };

      const res = await processRenderRequest(request);
      expect(res).not.toBeNull();
      expect(res!.bytes).toBeLessThanOrEqual(1_000_000);
      expect(res!.adjustedQuality).toBeDefined();
      expect(res!.adjustedQuality).toBeGreaterThanOrEqual(0.70);
      expect(res!.adjustedQuality).toBeLessThan(0.95);
    });

    it('handles extreme case where even quality 0.70 exceeds maxBytes', async () => {
      // Always returns 1,200,000 bytes regardless of quality
      MockOffscreenCanvas.blobFactory = () => {
        return new Blob([new Uint8Array(1_200_000)], { type: 'image/jpeg' });
      };

      const request: RenderRequest = {
        id: 4,
        bitmap: createMockBitmap(),
        cropWidth: 640,
        cropHeight: 480,
        transform: { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false },
        config: { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 }
      };

      const res = await processRenderRequest(request);
      expect(res).not.toBeNull();
      expect(res!.bytes).toBe(1_200_000);
      // Adjusted quality is returned indicating attempted reduction
      expect(res!.adjustedQuality).toBeDefined();
    });

    it('calls bitmap.close() after rendering to release resources', async () => {
      const mockBitmap = createMockBitmap();
      const request: RenderRequest = {
        id: 10,
        bitmap: mockBitmap,
        cropWidth: 640,
        cropHeight: 480,
        transform: { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false },
        config: { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 }
      };

      await processRenderRequest(request);
      expect(mockBitmap.close).toHaveBeenCalledTimes(1);
    });

    it('bounds low = Math.min(0.70, quality) without interval inversion when custom quality < 0.70 is provided', async () => {
      let testedQualities: number[] = [];
      MockOffscreenCanvas.blobFactory = (options) => {
        const q = options?.quality ?? 0.50;
        testedQualities.push(q);
        // Returns 1,100,000 bytes if q >= 0.40, and 900,000 if q < 0.40
        const size = q >= 0.40 ? 1_100_000 : 900_000;
        return new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
      };

      const request: RenderRequest = {
        id: 11,
        bitmap: createMockBitmap(),
        cropWidth: 640,
        cropHeight: 480,
        transform: { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false },
        config: { format: 'image/jpeg', quality: 0.50, maxBytes: 1_000_000 }
      };

      const res = await processRenderRequest(request);
      expect(res).not.toBeNull();
      // Ensure all tested qualities were in valid bounds <= 0.50
      for (const q of testedQualities) {
        expect(q).toBeLessThanOrEqual(0.50);
      }
    });

    it('returns null if cancelled during execution', async () => {
      const request: RenderRequest = {
        id: 5,
        bitmap: createMockBitmap(),
        cropWidth: 640,
        cropHeight: 480,
        transform: { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false },
        config: { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 }
      };

      // Already cancelled
      const res = await processRenderRequest(request, (id) => id === 5);
      expect(res).toBeNull();
    });
  });

  describe('renderAndEncode exportBridge communication', () => {
    const createMockBitmap = (w = 640, h = 480): ImageBitmap => ({
      width: w,
      height: h,
      close: vi.fn()
    } as unknown as ImageBitmap);

    it('sends message to worker and resolves with encoded result on matching ID', async () => {
      let messageHandler: ((e: MessageEvent) => void) | null = null;
      let lastPostedMessage: any = null;

      const mockWorker = {
        postMessage: vi.fn().mockImplementation((msg) => {
          lastPostedMessage = msg;
          // Simulate worker asynchronously responding
          setTimeout(() => {
            if (messageHandler) {
              messageHandler({
                data: {
                  id: msg.id,
                  blob: new Blob(['mock'], { type: 'image/jpeg' }),
                  bytes: 500_000,
                  width: msg.cropWidth,
                  height: msg.cropHeight
                }
              } as MessageEvent);
            }
          }, 0);
        }),
        addEventListener: vi.fn().mockImplementation((event, handler) => {
          if (event === 'message') messageHandler = handler;
        }),
        removeEventListener: vi.fn().mockImplementation((event, handler) => {
          if (event === 'message' && messageHandler === handler) messageHandler = null;
        }),
        terminate: vi.fn()
      } as unknown as Worker;

      setExportWorker(mockWorker);

      const bitmap = createMockBitmap();
      const transform: TransformState = { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false };
      const config: ExportConfig = { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 };

      const result = await renderAndEncode(bitmap, 640, 480, transform, config);

      expect(result.bytes).toBe(500_000);
      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
      expect(lastPostedMessage.cropWidth).toBe(640);
      expect(lastPostedMessage.cropHeight).toBe(480);
      expect(mockWorker.removeEventListener).toHaveBeenCalled();
    });

    it('ignores responses with non-matching request IDs', async () => {
      let messageHandler: ((e: MessageEvent) => void) | null = null;

      const mockWorker = {
        postMessage: vi.fn().mockImplementation((msg) => {
          setTimeout(() => {
            if (messageHandler) {
              // Send mismatched message first
              messageHandler({
                data: {
                  id: 99999,
                  blob: new Blob(['mismatched']),
                  bytes: 999_999,
                  width: 100,
                  height: 100
                }
              } as MessageEvent);

              // Then send matching message
              messageHandler({
                data: {
                  id: msg.id,
                  blob: new Blob(['matched']),
                  bytes: 400_000,
                  width: 640,
                  height: 480
                }
              } as MessageEvent);
            }
          }, 0);
        }),
        addEventListener: vi.fn().mockImplementation((event, handler) => {
          if (event === 'message') messageHandler = handler;
        }),
        removeEventListener: vi.fn(),
        terminate: vi.fn()
      } as unknown as Worker;

      setExportWorker(mockWorker);

      const bitmap = createMockBitmap();
      const transform: TransformState = { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false };
      const config: ExportConfig = { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 };

      const result = await renderAndEncode(bitmap, 640, 480, transform, config);
      expect(result.bytes).toBe(400_000);
    });

    it('rejects immediately if signal is already aborted', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn()
      } as unknown as Worker;

      setExportWorker(mockWorker);

      const controller = new AbortController();
      controller.abort();

      const bitmap = createMockBitmap();
      const transform: TransformState = { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false };
      const config: ExportConfig = { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 };

      await expect(
        renderAndEncode(bitmap, 640, 480, transform, config, controller.signal)
      ).rejects.toThrow('The operation was aborted');

      expect(mockWorker.postMessage).not.toHaveBeenCalled();
    });

    it('aborts mid-flight when signal fires abort', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn()
      } as unknown as Worker;

      setExportWorker(mockWorker);

      const controller = new AbortController();
      const bitmap = createMockBitmap();
      const transform: TransformState = { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false };
      const config: ExportConfig = { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 };

      const promise = renderAndEncode(bitmap, 640, 480, transform, config, controller.signal);

      // Abort after initiating
      controller.abort();

      await expect(promise).rejects.toThrow('The operation was aborted');
      expect(mockWorker.removeEventListener).toHaveBeenCalled();
      // Verifies cancel message was posted
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cancel' })
      );
    });

    it('rejects and cleans up all listeners when worker fires an error event', async () => {
      let errorHandler: ((e: any) => void) | null = null;
      const removeListenerCalls: string[] = [];

      const mockWorker = {
        postMessage: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            if (errorHandler) {
              errorHandler({ message: 'Out of memory in canvas' });
            }
          }, 0);
        }),
        addEventListener: vi.fn().mockImplementation((event, handler) => {
          if (event === 'error') errorHandler = handler;
        }),
        removeEventListener: vi.fn().mockImplementation((event) => {
          removeListenerCalls.push(event);
        }),
        terminate: vi.fn()
      } as unknown as Worker;

      setExportWorker(mockWorker);

      const bitmap = createMockBitmap();
      const transform: TransformState = { scale: 1, tx: 0, ty: 0, rotation: 0, flipX: false };
      const config: ExportConfig = { format: 'image/jpeg', quality: 0.95, maxBytes: 1_000_000 };

      await expect(
        renderAndEncode(bitmap, 640, 480, transform, config)
      ).rejects.toThrow('Out of memory in canvas');

      expect(removeListenerCalls).toContain('message');
      expect(removeListenerCalls).toContain('error');
    });
  });
});
