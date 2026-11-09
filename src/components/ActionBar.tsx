// src/components/ActionBar.tsx
import { SheetConfig } from '../types';
import { SHEET_PRESETS } from '../utils/dimensions';
import { t } from '../utils/i18n';
import { Brand, getBrand } from '../utils/brand';
import { formatFileSize, getMaxExportBytes, formatMaxMb } from '../utils/exportBridge';
import { IconDownload } from './Icons';

export interface ActionBarProps {
  cropWidth: number;
  cropHeight: number;
  bytes: number;
  maxBytes?: number;
  brand?: Brand;
  onDownload: () => void;
  disabled: boolean;
  sheetConfig?: SheetConfig;
  totalPhotos?: number;
}

export function ActionBar({
  cropWidth,
  cropHeight,
  bytes,
  maxBytes,
  brand = getBrand(),
  onDownload,
  disabled,
  sheetConfig,
  totalPhotos
}: ActionBarProps) {
  const effectiveMax = maxBytes ?? getMaxExportBytes(brand);
  const kb = formatFileSize(bytes);
  const ratio = bytes / effectiveMax;

  let gaugeColor = 'var(--gauge-green)';
  if (ratio > 1) {
    gaugeColor = 'var(--gauge-red)';
  } else if (ratio >= 0.8) {
    gaugeColor = 'var(--gauge-orange)';
  }

  const isSheet = sheetConfig?.enabled;
  const sheetPresetLabel = sheetConfig
    ? sheetConfig.preset === 'custom'
      ? `${sheetConfig.width}×${sheetConfig.height} ${sheetConfig.unit}`
      : `${SHEET_PRESETS[sheetConfig.preset]?.name || sheetConfig.preset.toUpperCase()} (${SHEET_PRESETS[sheetConfig.preset]?.width}×${SHEET_PRESETS[sheetConfig.preset]?.height} ${SHEET_PRESETS[sheetConfig.preset]?.unit})`
    : '';

  return (
    <footer class="app-action-bar" role="contentinfo">
      <div class="action-info">
        <span class="info-dim">
          {isSheet
            ? `${sheetPresetLabel} (${totalPhotos ?? 0} photos)`
            : `${cropWidth} × ${cropHeight} px`}
        </span>
        <div class="weight-gauge-container">
          <div
            class="weight-gauge-track"
            role="progressbar"
            aria-valuenow={bytes}
            aria-valuemin={0}
            aria-valuemax={effectiveMax}
          >
            <div
              class="weight-gauge-fill"
              style={{
                width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
                backgroundColor: gaugeColor
              }}
            />
          </div>
          <span class="weight-label" style={{ color: gaugeColor }}>
            {t('weight.gauge', { size: kb, max: formatMaxMb(effectiveMax) })}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-primary download-btn"
        onClick={onDownload}
        disabled={disabled}
      >
        <IconDownload size={18} />
        <span>{isSheet ? t('palette.download_btn') : t('export.download')}</span>
      </button>
    </footer>
  );
}
