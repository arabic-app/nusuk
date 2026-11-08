import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { CropViewport } from '../src/components/CropViewport';
import { TransformState } from '../src/types';
import { createDefaultTransform } from '../src/utils/transform';
import { t, setLocale } from '../src/utils/i18n';

describe('Viewport and Interactive Canvas', () => {
  describe('Viewport bounding and aspect ratio', () => {
    it('computes aspect ratio correctly for 640x480', () => {
      const ratio = 640 / 480;
      expect(Number(ratio.toFixed(2))).toBe(1.33);
    });

    it('computes aspect ratio correctly for 35x45 and 51x51 presets', () => {
      const passportRatio = 35 / 45;
      expect(Number(passportRatio.toFixed(2))).toBe(0.78);

      const squareRatio = 51 / 51;
      expect(Number(squareRatio.toFixed(2))).toBe(1.0);
    });
  });

  describe('CropViewport Component', () => {
    let container: HTMLDivElement;
    let mockCtx: any;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);

      mockCtx = {
        fillStyle: '',
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        clearRect: vi.fn()
      };

      HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
        if (contextId === '2d') {
          return mockCtx;
        }
        return null;
      });
    });

    afterEach(() => {
      render(null, container);
      container.remove();
      vi.restoreAllMocks();
    });

    const createMockBitmap = (width = 800, height = 600) => {
      return {
        width,
        height,
        close: vi.fn()
      } as unknown as ImageBitmap;
    };

    it('renders crop-viewport container with accessibility attributes and aspect ratio', () => {
      const onTransformChange = vi.fn();
      const transform = createDefaultTransform();

      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;
      expect(viewportEl).not.toBeNull();
      expect(viewportEl.getAttribute('role')).toBe('region');
      expect(viewportEl.getAttribute('aria-label')).toBe(t('app.title'));
      expect(viewportEl.getAttribute('tabindex')).toBe('0');

      const frameWrapper = container.querySelector('.crop-frame-wrapper') as HTMLElement;
      expect(frameWrapper).not.toBeNull();
      expect(frameWrapper.style.aspectRatio).toBe('640 / 480');

      const canvas = container.querySelector('canvas.crop-canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();
    });

    it('updates localized aria-label according to active locale', async () => {
      await setLocale('ar');
      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 640,
          cropHeight: 480,
          transform: createDefaultTransform(),
          showOvalGuide: false,
          onTransformChange: vi.fn()
        }),
        container
      );
      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;
      expect(viewportEl.getAttribute('aria-label')).toBe('نسك فوتو');
      await setLocale('fr');
    });

    it('renders biometric oval guide and eye line when showOvalGuide is true', () => {
      const onTransformChange = vi.fn();
      const transform = createDefaultTransform();

      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const oval = container.querySelector('.biometric-oval');
      expect(oval).not.toBeNull();
      expect(oval?.getAttribute('aria-hidden')).toBe('true');

      const eyeLine = container.querySelector('.eye-level-line');
      expect(eyeLine).not.toBeNull();

      const thirdsGrid = container.querySelector('.thirds-grid');
      expect(thirdsGrid).not.toBeNull();
      expect(thirdsGrid?.querySelectorAll('.grid-line').length).toBe(4);
    });

    it('hides biometric oval guide when showOvalGuide is false', () => {
      const onTransformChange = vi.fn();
      const transform = createDefaultTransform();

      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: false,
          onTransformChange
        }),
        container
      );

      const oval = container.querySelector('.biometric-oval');
      expect(oval).toBeNull();

      // Thirds grid remains visible
      const thirdsGrid = container.querySelector('.thirds-grid');
      expect(thirdsGrid).not.toBeNull();
    });

    it('renders vector SVG biometric guide with anatomical silhouette, symmetry axis, pupils, and tags', () => {
      const onTransformChange = vi.fn();
      const transform = createDefaultTransform();

      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 480,
          cropHeight: 640,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const svg = container.querySelector('.biometric-svg');
      expect(svg).not.toBeNull();
      expect(svg?.querySelector('.guide-head')).not.toBeNull();
      expect(svg?.querySelector('.guide-shoulders')).toBeNull();
      expect(svg?.querySelector('.guide-axis')).not.toBeNull();
      expect(svg?.querySelector('.guide-crown-line')).not.toBeNull();
      expect(svg?.querySelector('.guide-eye-line')).not.toBeNull();
      expect(svg?.querySelector('.guide-chin-line')).not.toBeNull();
      expect(svg?.querySelectorAll('.guide-pupil').length).toBe(2);

      // Verify micro-badges
      const tags = container.querySelectorAll('.guide-tag');
      expect(tags.length).toBe(3);
      expect(tags[0].textContent).toBe(t('guide.crown'));
      expect(tags[1].textContent).toBe(t('guide.eyes'));
      expect(tags[2].textContent).toBe(t('guide.chin'));
    });

    it('adapts biometric silhouette width proportionally for square aspect ratio', () => {
      const onTransformChange = vi.fn();
      const transform = createDefaultTransform();

      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 500,
          cropHeight: 500,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const svg = container.querySelector('.biometric-svg');
      expect(svg).not.toBeNull();
      const head = svg?.querySelector('.guide-head');
      expect(head).not.toBeNull();
      // On square (1:1), halfW is ~21, so temple is at 50 + 21 = 71
      expect(head?.getAttribute('d')).toContain('71.0');
    });

    it('renders canvas with white background fill and transforms image', async () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      const transform: TransformState = {
        scale: 1.2,
        tx: 25,
        ty: -15,
        rotation: 90,
        flipX: true
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      // Wait for useEffect to execute canvas redraw
      await new Promise((r) => setTimeout(r, 20));

      const canvas = container.querySelector('canvas.crop-canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(640);
      expect(canvas.height).toBe(480);

      expect(mockCtx.fillStyle).toBe('#FFFFFF');
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.translate).toHaveBeenCalledWith(640 / 2 + 25, 480 / 2 - 15);
      expect(mockCtx.rotate).toHaveBeenCalledWith((90 * Math.PI) / 180);
      expect(mockCtx.scale).toHaveBeenCalledWith(-1.2, 1.2);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockImage, -400, -300);
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('renders pure white canvas when imageBitmap is null', async () => {
      const onTransformChange = vi.fn();
      const transform = createDefaultTransform();

      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: false,
          onTransformChange
        }),
        container
      );

      await new Promise((r) => setTimeout(r, 20));

      const canvas = container.querySelector('canvas.crop-canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(640);
      expect(canvas.height).toBe(480);
      expect(mockCtx.fillStyle).toBe('#FFFFFF');
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });

    it('displays empty area warning badge when empty space is detected', () => {
      const onTransformChange = vi.fn();
      // An image with scale 0.5 inside 640x480 will leave empty margins
      const mockImage = createMockBitmap(640, 480);
      const transform: TransformState = {
        scale: 0.5,
        tx: 0,
        ty: 0,
        rotation: 0,
        flipX: false
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const warningBadge = container.querySelector('.empty-warning-badge');
      expect(warningBadge).not.toBeNull();
      expect(warningBadge?.getAttribute('role')).toBe('status');
      expect(warningBadge?.textContent).toContain(t('controls.empty_warning'));
    });

    it('does not display empty warning badge when image covers crop bounds or when no image', () => {
      const onTransformChange = vi.fn();
      // Large image covering entire 640x480 crop box
      const mockImage = createMockBitmap(1200, 1000);
      const transform: TransformState = {
        scale: 1.0,
        tx: 0,
        ty: 0,
        rotation: 0,
        flipX: false
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      expect(container.querySelector('.empty-warning-badge')).toBeNull();

      // No image loaded
      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      expect(container.querySelector('.empty-warning-badge')).toBeNull();
    });

    it('handles pointer dragging to pan the image', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      const transform: TransformState = {
        scale: 1.0,
        tx: 10,
        ty: 20,
        rotation: 0,
        flipX: false
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;
      viewportEl.setPointerCapture = vi.fn();
      viewportEl.releasePointerCapture = vi.fn();

      // Pointer down at (100, 100)
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        bubbles: true
      });
      viewportEl.dispatchEvent(downEvent);

      // Pointer move to (150, 130) -> delta (+50, +30)
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 130,
        pointerId: 1,
        bubbles: true
      });
      viewportEl.dispatchEvent(moveEvent);

      expect(onTransformChange).toHaveBeenCalledWith({
        scale: 1.0,
        tx: 10 + 50,
        ty: 20 + 30,
        rotation: 0,
        flipX: false
      });

      // Pointer up ends dragging
      const upEvent = new PointerEvent('pointerup', {
        clientX: 150,
        clientY: 130,
        pointerId: 1,
        bubbles: true
      });
      viewportEl.dispatchEvent(upEvent);

      onTransformChange.mockClear();

      // Subsequent moves without down do nothing
      viewportEl.dispatchEvent(moveEvent);
      expect(onTransformChange).not.toHaveBeenCalled();
    });

    it('handles pointer cancel gracefully', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      const transform = createDefaultTransform();

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;

      viewportEl.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 50, clientY: 50, pointerId: 1, bubbles: true })
      );

      viewportEl.dispatchEvent(
        new PointerEvent('pointercancel', { clientX: 50, clientY: 50, pointerId: 1, bubbles: true })
      );

      // Subsequent move should be ignored
      viewportEl.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 80, clientY: 80, pointerId: 1, bubbles: true })
      );
      expect(onTransformChange).not.toHaveBeenCalled();
    });

    it('ignores non-primary mouse buttons on pointer down (e.g. right click, middle click)', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform: createDefaultTransform(),
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );
      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;

      // Right click (button === 2)
      viewportEl.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 2, pointerId: 1, bubbles: true })
      );
      viewportEl.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 150, clientY: 150, pointerId: 1, bubbles: true })
      );
      expect(onTransformChange).not.toHaveBeenCalled();

      // Middle click (button === 1)
      viewportEl.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 1, pointerId: 1, bubbles: true })
      );
      viewportEl.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 150, clientY: 150, pointerId: 1, bubbles: true })
      );
      expect(onTransformChange).not.toHaveBeenCalled();
    });

    it('guards pointer down, wheel, keyboard, and touch interactions when imageBitmap is null', () => {
      const onTransformChange = vi.fn();
      render(
        h(CropViewport, {
          imageBitmap: null,
          cropWidth: 640,
          cropHeight: 480,
          transform: createDefaultTransform(),
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );
      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;

      // Pointer down and move
      viewportEl.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerId: 1, bubbles: true })
      );
      viewportEl.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 150, clientY: 150, pointerId: 1, bubbles: true })
      );
      expect(onTransformChange).not.toHaveBeenCalled();

      // Wheel
      viewportEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
      expect(onTransformChange).not.toHaveBeenCalled();

      // Keydown
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
      expect(onTransformChange).not.toHaveBeenCalled();

      // Touch
      const touchEvent = new Event('touchstart', { bubbles: true, cancelable: true }) as any;
      touchEvent.touches = [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }];
      viewportEl.dispatchEvent(touchEvent);
      const moveEvent = new Event('touchmove', { bubbles: true, cancelable: true }) as any;
      moveEvent.touches = [{ clientX: 0, clientY: 0 }, { clientX: 200, clientY: 0 }];
      viewportEl.dispatchEvent(moveEvent);
      expect(onTransformChange).not.toHaveBeenCalled();
    });

    it('handles mouse wheel zoom in and zoom out', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      const transform: TransformState = {
        scale: 1.0,
        tx: 0,
        ty: 0,
        rotation: 0,
        flipX: false
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;

      // Wheel up (deltaY < 0) -> zoom in (* 1.05)
      const wheelUp = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(wheelUp, 'preventDefault');
      viewportEl.dispatchEvent(wheelUp);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(onTransformChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 1.05
        })
      );

      // Wheel down (deltaY > 0) -> zoom out (* 0.95)
      const wheelDown = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
      viewportEl.dispatchEvent(wheelDown);

      expect(onTransformChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 0.95
        })
      );
    });

    it('clamps wheel zoom to bounds [0.1, 10]', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);

      // Near max scale
      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform: { scale: 9.9, tx: 0, ty: 0, rotation: 0, flipX: false },
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;
      viewportEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
      expect(onTransformChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 10
        })
      );

      // Near min scale
      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform: { scale: 0.102, tx: 0, ty: 0, rotation: 0, flipX: false },
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      viewportEl.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
      expect(onTransformChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 0.1
        })
      );
    });

    it('handles keyboard navigation (1px steps) and zoom (+/-)', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      const transform: TransformState = {
        scale: 1.0,
        tx: 0,
        ty: 0,
        rotation: 0,
        flipX: false
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;

      // ArrowLeft: tx - 1
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: -1, ty: 0 }));

      // ArrowRight: tx + 1
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: 1, ty: 0 }));

      // ArrowUp: ty - 1
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: 0, ty: -1 }));

      // ArrowDown: ty + 1
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: 0, ty: 1 }));

      // '+' key zoom in
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 1.05 }));

      // '=' key zoom in
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: '=', bubbles: true, cancelable: true }));
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 1.05 }));

      // '-' key zoom out
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }));
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 0.95 }));

      // Unrelated key does not trigger transform change
      onTransformChange.mockClear();
      viewportEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(onTransformChange).not.toHaveBeenCalled();
    });

    it('handles Shift + arrow keys for 10px accelerated panning', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      const transform: TransformState = {
        scale: 1.0,
        tx: 50,
        ty: 50,
        rotation: 0,
        flipX: false
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;

      viewportEl.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true })
      );
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: 40, ty: 50 }));

      viewportEl.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true })
      );
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: 60, ty: 50 }));

      viewportEl.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true })
      );
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: 50, ty: 40 }));

      viewportEl.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true })
      );
      expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ tx: 50, ty: 60 }));
    });

    it('handles tactile pinch-to-zoom with touch events', () => {
      const onTransformChange = vi.fn();
      const mockImage = createMockBitmap(800, 600);
      const transform: TransformState = {
        scale: 1.0,
        tx: 0,
        ty: 0,
        rotation: 0,
        flipX: false
      };

      render(
        h(CropViewport, {
          imageBitmap: mockImage,
          cropWidth: 640,
          cropHeight: 480,
          transform,
          showOvalGuide: true,
          onTransformChange
        }),
        container
      );

      const viewportEl = container.querySelector('.crop-viewport') as HTMLElement;

      // TouchStart with 2 fingers 100px apart: (0, 0) and (100, 0)
      const touch1 = { clientX: 0, clientY: 0 };
      const touch2 = { clientX: 100, clientY: 0 };

      const touchStartEvent = new Event('touchstart', { bubbles: true, cancelable: true }) as any;
      touchStartEvent.touches = [touch1, touch2];
      viewportEl.dispatchEvent(touchStartEvent);

      // TouchMove spreading fingers to 150px apart: (0, 0) and (150, 0) -> scale 1.5
      const touchMove1 = { clientX: 0, clientY: 0 };
      const touchMove2 = { clientX: 150, clientY: 0 };

      const touchMoveEvent = new Event('touchmove', { bubbles: true, cancelable: true }) as any;
      touchMoveEvent.touches = [touchMove1, touchMove2];
      viewportEl.dispatchEvent(touchMoveEvent);

      expect(onTransformChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 1.5
        })
      );

      // TouchEnd reduces touches below 2
      const touchEndEvent = new Event('touchend', { bubbles: true, cancelable: true }) as any;
      touchEndEvent.touches = [{ clientX: 0, clientY: 0 }];
      viewportEl.dispatchEvent(touchEndEvent);

      onTransformChange.mockClear();

      // Subsequent 1-finger touchmove does not pinch zoom
      const singleTouchMove = new Event('touchmove', { bubbles: true, cancelable: true }) as any;
      singleTouchMove.touches = [{ clientX: 50, clientY: 50 }];
      viewportEl.dispatchEvent(singleTouchMove);
      expect(onTransformChange).not.toHaveBeenCalled();
    });
  });
});
