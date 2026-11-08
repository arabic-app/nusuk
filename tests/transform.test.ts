import { describe, it, expect } from 'vitest';
import {
  createDefaultTransform,
  rotate90,
  toggleFlip,
  fitTransform,
  fillTransform,
  computeBoundingBox,
  hasEmptyAreas,
} from '../src/utils/transform';

describe('Transform coordinates engine', () => {
  describe('createDefaultTransform', () => {
    it('creates clean default transform', () => {
      const t = createDefaultTransform();
      expect(t.scale).toBe(1);
      expect(t.tx).toBe(0);
      expect(t.ty).toBe(0);
      expect(t.rotation).toBe(0);
      expect(t.flipX).toBe(false);
    });
  });

  describe('rotate90', () => {
    it('cycles rotation through 90, 180, 270, 0', () => {
      let t = createDefaultTransform();
      t = rotate90(t);
      expect(t.rotation).toBe(90);
      t = rotate90(t);
      expect(t.rotation).toBe(180);
      t = rotate90(t);
      expect(t.rotation).toBe(270);
      t = rotate90(t);
      expect(t.rotation).toBe(0);
    });

    it('preserves other transform properties while rotating', () => {
      const initial = { scale: 1.5, tx: 10, ty: -20, rotation: 0 as const, flipX: true };
      const rotated = rotate90(initial);
      expect(rotated).toEqual({
        scale: 1.5,
        tx: 10,
        ty: -20,
        rotation: 90,
        flipX: true,
      });
    });
  });

  describe('toggleFlip', () => {
    it('toggles flipX state and preserves other properties', () => {
      const t1 = createDefaultTransform();
      const t2 = toggleFlip(t1);
      expect(t2.flipX).toBe(true);
      expect(t2.scale).toBe(t1.scale);
      expect(t2.tx).toBe(t1.tx);
      expect(t2.ty).toBe(t1.ty);
      expect(t2.rotation).toBe(t1.rotation);

      const t3 = toggleFlip(t2);
      expect(t3.flipX).toBe(false);
    });
  });

  describe('fitTransform', () => {
    it('computes fit scale when width is the limiting dimension', () => {
      const t = fitTransform(640, 480, 1280, 480);
      expect(t.scale).toBe(0.5);
      expect(t.tx).toBe(0);
      expect(t.ty).toBe(0);
      expect(t.rotation).toBe(0);
      expect(t.flipX).toBe(false);
    });

    it('computes fit scale when height is the limiting dimension', () => {
      const t = fitTransform(640, 480, 640, 960);
      expect(t.scale).toBe(0.5);
    });
  });

  describe('fillTransform', () => {
    it('computes fill scale so the image covers the crop frame entirely', () => {
      const t = fillTransform(640, 480, 1000, 1000);
      // Math.max(640/1000, 480/1000) = 0.64
      expect(t.scale).toBe(0.64);
      expect(t.tx).toBe(0);
      expect(t.ty).toBe(0);
      expect(t.rotation).toBe(0);
      expect(t.flipX).toBe(false);
      expect(hasEmptyAreas(640, 480, 1000, 1000, t)).toBe(false);
    });

    it('computes fill scale for landscape aspect ratio', () => {
      const t = fillTransform(640, 480, 1280, 480);
      // Math.max(640/1280, 480/480) = 1.0
      expect(t.scale).toBe(1.0);
    });
  });

  describe('computeBoundingBox', () => {
    it('computes centered bounding box at scale 1 without rotation', () => {
      const state = createDefaultTransform();
      const bbox = computeBoundingBox(640, 480, 600, 400, state);
      expect(bbox).toEqual({
        left: 20,
        right: 620,
        top: 40,
        bottom: 440,
        width: 600,
        height: 400,
      });
    });

    it('takes rotation into account by swapping width and height at 90/270 degrees', () => {
      const state = { ...createDefaultTransform(), rotation: 90 as const };
      const bbox = computeBoundingBox(600, 600, 400, 200, state);
      // effectiveW = 200, effectiveH = 400
      expect(bbox).toEqual({
        left: 200,
        right: 400,
        top: 100,
        bottom: 500,
        width: 200,
        height: 400,
      });
    });

    it('offsets box position by tx and ty', () => {
      const state = { ...createDefaultTransform(), tx: 15, ty: -10 };
      const bbox = computeBoundingBox(640, 480, 640, 480, state);
      expect(bbox).toEqual({
        left: 15,
        right: 655,
        top: -10,
        bottom: 470,
        width: 640,
        height: 480,
      });
    });
  });

  describe('hasEmptyAreas', () => {
    it('detects when image does not cover the frame', () => {
      // Crop frame: 640x480. Image 300x300, scale 1 -> empty areas true
      expect(hasEmptyAreas(640, 480, 300, 300, createDefaultTransform())).toBe(true);
    });

    it('returns false when image exactly matches crop frame', () => {
      expect(hasEmptyAreas(640, 480, 640, 480, createDefaultTransform())).toBe(false);
    });

    it('returns false when image is larger than crop frame and centered', () => {
      const state = { ...createDefaultTransform(), scale: 1.5 };
      expect(hasEmptyAreas(640, 480, 640, 480, state)).toBe(false);
    });

    it('detects empty areas when shifted too far', () => {
      const state = { ...createDefaultTransform(), tx: 10 };
      // Crop: 640x480, Image: 640x480, tx: 10 => left: 10 > 0 => empty area on left
      expect(hasEmptyAreas(640, 480, 640, 480, state)).toBe(true);
    });

    it('handles 90-degree rotated images correctly', () => {
      // Crop frame: 600x400.
      // Image: 400x600. When rotated 90, effective dimensions become 600x400.
      const state = { ...createDefaultTransform(), rotation: 90 as const };
      expect(hasEmptyAreas(600, 400, 400, 600, state)).toBe(false);

      // Rotated 90 where dimensions do not cover
      const stateSmall = { ...createDefaultTransform(), rotation: 90 as const };
      expect(hasEmptyAreas(600, 400, 600, 400, stateSmall)).toBe(true);
    });
  });
});
