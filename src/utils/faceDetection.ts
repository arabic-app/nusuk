// src/utils/faceDetection.ts
// 100% Client-side face detection & intelligent ID photo pre-framing

import { TransformState } from '../types';
import { fillTransform } from './transform';

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detect face bounding box using native Shape Detection API (Chrome/Edge/Android)
 * or fast color-cluster heuristic fallback (Safari/Firefox/iOS).
 */
export async function detectFace(bitmap: ImageBitmap): Promise<FaceBox | null> {
  const width = bitmap.width;
  const height = bitmap.height;

  // 1. Try native Shape Detection API (hardware-accelerated, 0 KB download)
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const detector = new (window as any).FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1,
      });
      const faces = await detector.detect(bitmap);
      if (faces && faces.length > 0 && faces[0].boundingBox) {
        const box = faces[0].boundingBox;
        return {
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: Math.min(width, box.width),
          height: Math.min(height, box.height),
        };
      }
    } catch {
      // Fallback if native FaceDetector throws
    }
  }

  // 2. Fast lightweight skin-cluster fallback for Safari/Firefox
  // Downsample to 120x120 for instant (~2ms) analysis
  try {
    const sampleW = 120;
    const sampleH = Math.max(1, Math.round((height / width) * sampleW));

    let canvas: any;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(sampleW, sampleH);
    } else if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = sampleW;
      canvas.height = sampleH;
    } else {
      return null;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(bitmap, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    let minX = sampleW;
    let maxX = 0;
    let minY = sampleH;
    let maxY = 0;
    let count = 0;

    // Focus on top 65% of the portrait where head is located
    const scanLimitY = Math.floor(sampleH * 0.65);

    for (let y = Math.floor(sampleH * 0.05); y < scanLimitY; y++) {
      for (let x = Math.floor(sampleW * 0.15); x < Math.floor(sampleW * 0.85); x++) {
        const idx = (y * sampleW + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Standard YCbCr skin tone detection:
        // Cb: 77 to 127, Cr: 133 to 173
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        if (yVal > 40 && cb >= 77 && cb <= 135 && cr >= 130 && cr <= 175) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Require a plausible cluster size (at least 200 pixels)
    if (count > 200 && maxX > minX && maxY > minY) {
      const scaleX = width / sampleW;
      const scaleY = height / sampleH;
      return {
        x: Math.round(minX * scaleX),
        y: Math.round(minY * scaleY),
        width: Math.round((maxX - minX) * scaleX),
        height: Math.round((maxY - minY) * scaleY),
      };
    }
  } catch {
    // Return null on analysis error
  }

  return null;
}

/**
 * Calculates optimal Nusuk / ICAO biometric framing:
 * - Face height represents ~62% - 66% of frame height
 * - Face is horizontally centered
 * - Eye line / face center aligns with upper 43% of frame (matching oval guide)
 */
export function computeFaceFraming(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number,
  faceBox: FaceBox | null
): TransformState {
  if (!faceBox || faceBox.width <= 0 || faceBox.height <= 0) {
    return fillTransform(cropW, cropH, imgW, imgH);
  }

  // 1. Calculate target scale so face occupies ~63% of crop height
  const targetFaceH = cropH * 0.63;
  let scale = targetFaceH / faceBox.height;

  // Ensure image at least reasonably fills the frame
  const fillScale = Math.max(cropW / imgW, cropH / imgH);
  if (scale < fillScale * 0.8) {
    scale = fillScale * 0.8;
  }
  // Clamp scale to safe bounds [0.1, 5]
  scale = Math.max(0.1, Math.min(5, scale));

  // 2. Face center in image coordinates
  const faceCenterX = faceBox.x + faceBox.width / 2;
  const faceCenterY = faceBox.y + faceBox.height / 2;

  // 3. Distance from image center when scaled
  const deltaX = (faceCenterX - imgW / 2) * scale;
  const deltaY = (faceCenterY - imgH / 2) * scale;

  // 4. Target position in crop coordinates:
  // Horizontally centered (cropW / 2)
  // Vertically at 44% from top (matching standard oval guide eye/nose alignment)
  const targetX = cropW / 2;
  const targetY = cropH * 0.44;

  const tx = Math.round(targetX - cropW / 2 - deltaX);
  const ty = Math.round(targetY - cropH / 2 - deltaY);

  return {
    scale: Number(scale.toFixed(3)),
    tx,
    ty,
    rotation: 0,
    flipX: false,
  };
}
