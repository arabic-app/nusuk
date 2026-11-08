export type Unit = 'px' | 'mm' | 'cm' | 'in';

export interface OutputDimension {
  width: number;
  height: number;
  unit: Unit;
  dpi: number;
  lockRatio: boolean;
}

export interface TransformState {
  scale: number;
  tx: number; // pixel offset X relative to crop center
  ty: number; // pixel offset Y relative to crop center
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
}

export type ExportFormat = 'image/jpeg' | 'image/png';

export interface ExportConfig {
  format: ExportFormat;
  quality: number; // 0.70 to 1.00 for JPEG
  maxBytes: number; // default 1,000,000
}

export interface EncodedResult {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  adjustedQuality?: number;
}
