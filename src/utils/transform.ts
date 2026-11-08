import { TransformState } from '../types';

export interface BoundingBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export function createDefaultTransform(): TransformState {
  return {
    scale: 1,
    tx: 0,
    ty: 0,
    rotation: 0,
    flipX: false,
  };
}

export function rotate90(state: TransformState): TransformState {
  const nextRotation = ((state.rotation + 90) % 360) as 0 | 90 | 180 | 270;
  return { ...state, rotation: nextRotation };
}

export function toggleFlip(state: TransformState): TransformState {
  return { ...state, flipX: !state.flipX };
}

export function fitTransform(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number
): TransformState {
  const scale = Math.min(cropW / imgW, cropH / imgH);
  return {
    scale,
    tx: 0,
    ty: 0,
    rotation: 0,
    flipX: false,
  };
}

export function fillTransform(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number
): TransformState {
  const scale = Math.max(cropW / imgW, cropH / imgH);
  return {
    scale,
    tx: 0,
    ty: 0,
    rotation: 0,
    flipX: false,
  };
}

export function computeBoundingBox(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number,
  state: TransformState
): BoundingBox {
  const isRotated90 = state.rotation === 90 || state.rotation === 270;
  const effectiveW = (isRotated90 ? imgH : imgW) * state.scale;
  const effectiveH = (isRotated90 ? imgW : imgH) * state.scale;

  const left = (cropW - effectiveW) / 2 + state.tx;
  const right = left + effectiveW;
  const top = (cropH - effectiveH) / 2 + state.ty;
  const bottom = top + effectiveH;

  return {
    left,
    right,
    top,
    bottom,
    width: effectiveW,
    height: effectiveH,
  };
}

export function hasEmptyAreas(
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number,
  state: TransformState
): boolean {
  const { left, right, top, bottom } = computeBoundingBox(
    cropW,
    cropH,
    imgW,
    imgH,
    state
  );

  return left > 0 || right < cropW || top > 0 || bottom < cropH;
}
