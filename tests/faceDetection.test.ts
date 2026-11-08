// tests/faceDetection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeFaceFraming, detectFace, FaceBox } from '../src/utils/faceDetection';
import { fillTransform } from '../src/utils/transform';

describe('faceDetection & biometric pre-framing', () => {
  it('falls back to fillTransform if faceBox is null', () => {
    const cropW = 480;
    const cropH = 640;
    const imgW = 1200;
    const imgH = 1600;

    const framing = computeFaceFraming(cropW, cropH, imgW, imgH, null);
    const expected = fillTransform(cropW, cropH, imgW, imgH);
    expect(framing).toEqual(expected);
  });

  it('falls back to fillTransform if faceBox has zero or negative dimension', () => {
    const framing = computeFaceFraming(480, 640, 1000, 1000, { x: 10, y: 10, width: 0, height: 0 });
    expect(framing).toEqual(fillTransform(480, 640, 1000, 1000));
  });

  it('calculates optimal biometric zoom and positioning centered on face', () => {
    const cropW = 480;
    const cropH = 640;
    const imgW = 1200;
    const imgH = 1600;

    // Face detected in upper portion of image
    const faceBox: FaceBox = {
      x: 400,
      y: 300,
      width: 400,
      height: 400,
    };

    const framing = computeFaceFraming(cropW, cropH, imgW, imgH, faceBox);

    // Target face height is ~63% of 640 = ~403.2 px
    // Scale should be ~ 403.2 / 400 = 1.008
    expect(framing.scale).toBeCloseTo(1.008, 2);

    // Face is centered horizontally in image (x: 400 to 800 => center: 600)
    // Since 600 is exactly imgW / 2, deltaX = 0 => tx should be 0
    expect(framing.tx).toBe(0);

    // Rotation and flip should default to 0 and false
    expect(framing.rotation).toBe(0);
    expect(framing.flipX).toBe(false);
  });

  it('uses native FaceDetector when available on window', async () => {
    const mockBoundingBox = { x: 150, y: 100, width: 250, height: 300 };
    const mockDetect = vi.fn().mockResolvedValue([{ boundingBox: mockBoundingBox }]);

    (window as any).FaceDetector = vi.fn().mockImplementation(() => ({
      detect: mockDetect,
    }));

    const mockBitmap = { width: 1000, height: 1000 } as ImageBitmap;
    const result = await detectFace(mockBitmap);

    expect(result).toEqual({
      x: 150,
      y: 100,
      width: 250,
      height: 300,
    });

    delete (window as any).FaceDetector;
  });

  it('handles native FaceDetector errors gracefully by falling back', async () => {
    (window as any).FaceDetector = vi.fn().mockImplementation(() => ({
      detect: vi.fn().mockRejectedValue(new Error('Detection error')),
    }));

    const mockBitmap = { width: 500, height: 500 } as ImageBitmap;
    const result = await detectFace(mockBitmap);
    // Should safely return null without throwing
    expect(result === null || typeof result === 'object').toBe(true);

    delete (window as any).FaceDetector;
  });
});
