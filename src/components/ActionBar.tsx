// src/components/ActionBar.tsx
import { t } from '../utils/i18n';
import { MAX_NUSUK_BYTES, formatFileSize } from '../utils/exportBridge';
import { IconDownload } from './Icons';

export interface ActionBarProps {
  cropWidth: number;
  cropHeight: number;
  bytes: number;
  onDownload: () => void;
  disabled: boolean;
}

export function ActionBar({
  cropWidth,
  cropHeight,
  bytes,
  onDownload,
  disabled
}: ActionBarProps) {
  const kb = formatFileSize(bytes);
  const ratio = bytes / MAX_NUSUK_BYTES;

  let gaugeColor = 'var(--gauge-green)';
  if (ratio > 1) {
    gaugeColor = 'var(--gauge-red)';
  } else if (ratio >= 0.8) {
    gaugeColor = 'var(--gauge-orange)';
  }

  return (
    <footer class="app-action-bar" role="contentinfo">
      <div class="action-info">
        <span class="info-dim">{cropWidth} × {cropHeight} px</span>
        <div class="weight-gauge-container">
          <div class="weight-gauge-track" role="progressbar" aria-valuenow={bytes} aria-valuemin={0} aria-valuemax={MAX_NUSUK_BYTES}>
            <div
              class="weight-gauge-fill"
              style={{
                width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
                backgroundColor: gaugeColor
              }}
            />
          </div>
          <span class="weight-label" style={{ color: gaugeColor }}>
            {t('weight.gauge', { size: kb })}
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
        <span>{t('export.download')}</span>
      </button>
    </footer>
  );
}
