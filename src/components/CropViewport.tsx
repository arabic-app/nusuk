// src/components/CropViewport.tsx
import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { TransformState } from '../types';
import { t } from '../utils/i18n';
import { hasEmptyAreas } from '../utils/transform';
import { IconInfo } from './Icons';

function getBiometricHeadPath(faceHalfW: number): string {
  const hw = faceHalfW;
  const p1 = (50 + hw * 0.55).toFixed(1);
  const p2 = (50 + hw).toFixed(1);
  const p3 = (50 + hw * 1.02).toFixed(1);
  const p4 = (50 + hw * 0.75).toFixed(1);
  const p5 = (50 + hw * 0.32).toFixed(1);
  const p6 = (50 + hw * 0.16).toFixed(1);
  const m6 = (50 - hw * 0.16).toFixed(1);
  const m5 = (50 - hw * 0.32).toFixed(1);
  const m4 = (50 - hw * 0.75).toFixed(1);
  const m3 = (50 - hw * 1.02).toFixed(1);
  const m2 = (50 - hw).toFixed(1);
  const m1 = (50 - hw * 0.55).toFixed(1);

  return `M 50 12 C ${p1} 12, ${p2} 23, ${p2} 40 C ${p3} 54, ${p4} 70, ${p5} 79 C ${p6} 81, ${m6} 81, ${m5} 79 C ${m4} 70, ${m3} 54, ${m2} 40 C ${m2} 23, ${m1} 12, 50 12 Z`;
}

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

  const aspectRatio = cropWidth / cropHeight;
  const faceHalfW = Math.min(38, Math.max(16, Number((21 / aspectRatio).toFixed(1))));
  const headPath = getBiometricHeadPath(faceHalfW);
  const pupilLeftX = (50 - faceHalfW * 0.38).toFixed(1);
  const pupilRightX = (50 + faceHalfW * 0.38).toFixed(1);
  const crownLeftX = (50 - faceHalfW * 0.85).toFixed(1);
  const crownRightX = (50 + faceHalfW * 0.85).toFixed(1);
  const eyeLeftX = (50 - faceHalfW * 1.15).toFixed(1);
  const eyeRightX = (50 + faceHalfW * 1.15).toFixed(1);
  const chinLeftX = (50 - faceHalfW * 0.65).toFixed(1);
  const chinRightX = (50 + faceHalfW * 0.65).toFixed(1);

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

        {/* Biometric Face Guide */}
        {showOvalGuide && (
          <div class="biometric-oval" aria-hidden="true">
            <svg
              class="biometric-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* Vertical symmetry axis */}
              <line class="guide-axis" x1="50" y1="5" x2="50" y2="95" />

              {/* Anatomical head contour */}
              <path class="guide-head" d={headPath} />

              {/* Crown level reference */}
              <line class="guide-crown-line" x1={crownLeftX} y1="12" x2={crownRightX} y2="12" />

              {/* Eye level line */}
              <line class="guide-eye-line" x1={eyeLeftX} y1="42.8" x2={eyeRightX} y2="42.8" />
              {/* Eye pupil markers */}
              <circle class="guide-pupil" cx={pupilLeftX} cy="42.8" r="1.4" />
              <circle class="guide-pupil" cx={pupilRightX} cy="42.8" r="1.4" />

              {/* Chin level line */}
              <line class="guide-chin-line" x1={chinLeftX} y1="80" x2={chinRightX} y2="80" />
            </svg>

            {/* DOM eye-level-line anchor */}
            <div class="eye-level-line" />

            {/* Micro-badges */}
            <div class="guide-marker marker-crown">
              <span class="guide-tag">{t('guide.crown')}</span>
            </div>
            <div class="guide-marker marker-eyes">
              <span class="guide-tag">{t('guide.eyes')}</span>
            </div>
            <div class="guide-marker marker-chin">
              <span class="guide-tag">{t('guide.chin')}</span>
            </div>
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
