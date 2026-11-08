// src/components/CropViewport.tsx
import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { TransformState } from '../types';
import { t } from '../utils/i18n';
import { hasEmptyAreas } from '../utils/transform';
import { IconInfo } from './Icons';

export interface CropViewportProps {
  imageBitmap: ImageBitmap | null;
  cropWidth: number;
  cropHeight: number;
  transform: TransformState;
  showOvalGuide: boolean;
  onTransformChange: (t: TransformState) => void;
}

export function CropViewport({
  imageBitmap,
  cropWidth,
  cropHeight,
  transform,
  showOvalGuide,
  onTransformChange
}: CropViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const touchStartDist = useRef<number | null>(null);
  const touchStartScale = useRef(1);

  // Keep latest refs to avoid stale closures in event listeners
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;

  // Redraw canvas preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Fill pure white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cropWidth, cropHeight);

    if (imageBitmap) {
      // Apply transforms
      ctx.save();
      ctx.translate(cropWidth / 2 + transform.tx, cropHeight / 2 + transform.ty);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.flipX ? -transform.scale : transform.scale, transform.scale);
      ctx.drawImage(imageBitmap, -imageBitmap.width / 2, -imageBitmap.height / 2);
      ctx.restore();
    }
  }, [imageBitmap, cropWidth, cropHeight, transform]);

  // Handle pointer pan
  const onPointerDown = (e: h.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!imageBitmap || e.button !== 0) return;
    isDragging.current = true;
    setIsDraggingState(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transformRef.current.tx,
      ty: transformRef.current.ty
    };
    const target = e.currentTarget as HTMLElement | null;
    if (typeof target?.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Gracefully ignore in non-browser/test environments
      }
    }
  };

  const onPointerMove = (e: h.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || touchStartDist.current !== null) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    onTransformChangeRef.current({
      ...transformRef.current,
      tx: dragStart.current.tx + dx,
      ty: dragStart.current.ty + dy
    });
  };

  const onPointerUp = (e: h.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    setIsDraggingState(false);
    const target = e.currentTarget as HTMLElement | null;
    if (typeof target?.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // Gracefully ignore
      }
    }
  };

  const onPointerCancel = (e: h.JSX.TargetedPointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    setIsDraggingState(false);
    const target = e.currentTarget as HTMLElement | null;
    if (typeof target?.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // Gracefully ignore
      }
    }
  };

  // Wheel zoom
  const onWheel = (e: h.JSX.TargetedWheelEvent<HTMLDivElement>) => {
    if (!imageBitmap) return;
    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (e.deltaY === 0) return;
    const factor = e.deltaY < 0 ? 1.05 : 0.95;
    const newScale = Math.max(0.1, Math.min(10, transformRef.current.scale * factor));
    onTransformChangeRef.current({ ...transformRef.current, scale: newScale });
  };

  // Keyboard controls (1px, 10px with Shift, +/- zoom)
  const onKeyDown = (e: h.JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (!imageBitmap) return;
    const delta = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -delta;
    else if (e.key === 'ArrowRight') dx = delta;
    else if (e.key === 'ArrowUp') dy = -delta;
    else if (e.key === 'ArrowDown') dy = delta;
    else if (e.key === '+' || e.key === '=') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const newScale = Math.min(10, transformRef.current.scale * 1.05);
      onTransformChangeRef.current({ ...transformRef.current, scale: newScale });
      return;
    } else if (e.key === '-') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const newScale = Math.max(0.1, transformRef.current.scale * 0.95);
      onTransformChangeRef.current({ ...transformRef.current, scale: newScale });
      return;
    } else {
      return;
    }

    if (typeof e.preventDefault === 'function') e.preventDefault();
    onTransformChangeRef.current({
      ...transformRef.current,
      tx: transformRef.current.tx + dx,
      ty: transformRef.current.ty + dy
    });
  };

  // Tactile pinch-to-zoom (touch)
  const onTouchStart = (e: h.JSX.TargetedTouchEvent<HTMLDivElement>) => {
    if (!imageBitmap) return;
    if (e.touches && e.touches.length === 2) {
      isDragging.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDist.current = dist;
      touchStartScale.current = transformRef.current.scale;
    }
  };

  const onTouchMove = (e: h.JSX.TargetedTouchEvent<HTMLDivElement>) => {
    if (
      e.touches &&
      e.touches.length === 2 &&
      touchStartDist.current !== null &&
      touchStartDist.current > 0
    ) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = dist / touchStartDist.current;
      const newScale = Math.max(0.1, Math.min(10, touchStartScale.current * factor));
      onTransformChangeRef.current({ ...transformRef.current, scale: newScale });
    }
  };

  const onTouchEnd = (e: h.JSX.TargetedTouchEvent<HTMLDivElement>) => {
    if (!e.touches || e.touches.length < 2) {
      touchStartDist.current = null;
    }
  };

  const isEmpty = imageBitmap
    ? hasEmptyAreas(cropWidth, cropHeight, imageBitmap.width, imageBitmap.height, transform)
    : false;

  return (
    <div
      ref={containerRef}
      class={`crop-viewport ${isDraggingState ? 'is-dragging' : ''}`}
      tabIndex={0}
      role="region"
      aria-label={t('app.title')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        class="crop-frame-wrapper"
        style={{ aspectRatio: `${cropWidth} / ${cropHeight}` }}
      >
        <canvas ref={canvasRef} class="crop-canvas" />

        {/* Biometric Oval Guide */}
        {showOvalGuide && (
          <div class="biometric-oval" aria-hidden="true">
            <div class="eye-level-line" />
          </div>
        )}

        {/* Thirds Grid */}
        <div class="thirds-grid" aria-hidden="true">
          <div class="grid-line horizontal h1" />
          <div class="grid-line horizontal h2" />
          <div class="grid-line vertical v1" />
          <div class="grid-line vertical v2" />
        </div>
      </div>

      {isEmpty && (
        <div class="empty-warning-badge" role="status">
          <IconInfo size={15} />
          <span>{t('controls.empty_warning')}</span>
        </div>
      )}
    </div>
  );
}
