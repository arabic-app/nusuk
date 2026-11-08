// src/components/SheetPreviewModal.tsx
import { useEffect, useRef } from 'preact/hooks';
import { OutputDimension, SheetConfig, TransformState } from '../types';
import { clampDimension, convertToPixels, SHEET_PRESETS } from '../utils/dimensions';
import { calculateSheetLayout, drawCutGuides } from '../utils/sheetTiling';
import { IconClose, IconDownload, IconGrid } from './Icons';
import { t } from '../utils/i18n';

export interface SheetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bitmap: ImageBitmap | null;
  transform: TransformState;
  dimension: OutputDimension;
  sheetConfig: SheetConfig;
  onDownload: () => void;
}

export function SheetPreviewModal({
  isOpen,
  onClose,
  bitmap,
  transform,
  dimension,
  sheetConfig,
  onDownload
}: SheetPreviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !bitmap || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cropW = clampDimension(convertToPixels(dimension.width, dimension.unit, dimension.dpi));
    const cropH = clampDimension(convertToPixels(dimension.height, dimension.unit, dimension.dpi));
    const layout = calculateSheetLayout(cropW, cropH, sheetConfig);

    canvas.width = layout.sheetWidthPx;
    canvas.height = layout.sheetHeightPx;

    // Fill sheet background with pure white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, layout.sheetWidthPx, layout.sheetHeightPx);

    // Draw cutting guides if enabled
    if (sheetConfig.cutGuides) {
      drawCutGuides(ctx, layout);
    }

    // Step 1: Render single cropped photo buffer
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = cropW;
    photoCanvas.height = cropH;
    const pCtx = photoCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#FFFFFF';
      pCtx.fillRect(0, 0, cropW, cropH);
      pCtx.save();
      pCtx.translate(cropW / 2 + transform.tx, cropH / 2 + transform.ty);
      pCtx.rotate((transform.rotation * Math.PI) / 180);
      pCtx.scale((transform.flipX ? -1 : 1) * transform.scale, transform.scale);
      pCtx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      pCtx.restore();

      // Step 2: Tile photos onto sheet
      for (const pos of layout.positions) {
        ctx.drawImage(
          photoCanvas,
          pos.x,
          pos.y,
          layout.photoWidthPx,
          layout.photoHeightPx
        );
      }
    }
  }, [isOpen, bitmap, transform, dimension, sheetConfig]);

  if (!isOpen) return null;

  const cropW = clampDimension(convertToPixels(dimension.width, dimension.unit, dimension.dpi));
  const cropH = clampDimension(convertToPixels(dimension.height, dimension.unit, dimension.dpi));
  const layout = calculateSheetLayout(cropW, cropH, sheetConfig);

  const presetName =
    sheetConfig.preset === 'custom'
      ? `${sheetConfig.width}×${sheetConfig.height} ${sheetConfig.unit}`
      : SHEET_PRESETS[sheetConfig.preset]?.name || sheetConfig.preset;

  return (
    <div
      class="sheet-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        class="sheet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-modal-header">
          <div class="sheet-modal-title-group">
            <h2 id="sheet-preview-title" class="sheet-modal-title">
              <IconGrid size={20} class="icon-inline" />
              <span>{t('palette.preview_title')}</span>
            </h2>
            <span class="sheet-modal-subtitle">
              {presetName} • {t('palette.info', {
                count: layout.totalPhotos,
                cols: layout.cols,
                rows: layout.rows
              })}
            </span>
          </div>
          <button
            type="button"
            class="sheet-modal-close"
            onClick={onClose}
            aria-label={t('palette.close')}
          >
            <IconClose size={18} />
          </button>
        </div>

        <div class="sheet-modal-body">
          <div class="sheet-canvas-wrapper">
            <canvas ref={canvasRef} class="sheet-preview-canvas" />
          </div>
          <div class="sheet-modal-specs">
            <span>{layout.sheetWidthPx} × {layout.sheetHeightPx} px @ {sheetConfig.dpi} DPI</span>
            {sheetConfig.cutGuides && <span> • {t('palette.cut_guides')}</span>}
          </div>
        </div>

        <div class="sheet-modal-footer">
          <button
            type="button"
            class="btn btn-secondary sheet-btn-secondary"
            onClick={onClose}
          >
            {t('palette.close')}
          </button>
          <button
            type="button"
            class="btn btn-primary sheet-btn-download"
            onClick={() => {
              onDownload();
              onClose();
            }}
          >
            <IconDownload size={18} />
            <span>{t('palette.download_btn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
