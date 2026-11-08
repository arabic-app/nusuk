// src/components/SettingsPanel.tsx
import { OutputDimension, ExportConfig, Unit } from '../types';
import { PRESETS, clampDimension } from '../utils/dimensions';
import { MAX_NUSUK_BYTES } from '../utils/exportBridge';
import { t } from '../utils/i18n';

export interface SettingsPanelProps {
  dimension: OutputDimension;
  onDimensionChange: (d: OutputDimension) => void;
  exportConfig: ExportConfig;
  onExportConfigChange: (cfg: ExportConfig) => void;
  encodedBytes: number;
  adjustedQuality?: number;
  bgRemovalActive: boolean;
  bgLoading: boolean;
  featherRadius: number;
  onToggleBgRemoval: (active: boolean) => void;
  onFeatherChange: (radius: number) => void;
  onCompareStart?: () => void;
  onCompareEnd?: () => void;
}

export function SettingsPanel({
  dimension,
  onDimensionChange,
  exportConfig,
  onExportConfigChange,
  encodedBytes,
  adjustedQuality,
  bgRemovalActive,
  bgLoading,
  featherRadius,
  onToggleBgRemoval,
  onFeatherChange,
  onCompareStart,
  onCompareEnd
}: SettingsPanelProps) {
  const isNusukPreset =
    dimension.width === PRESETS.nusuk.width &&
    dimension.height === PRESETS.nusuk.height &&
    dimension.unit === PRESETS.nusuk.unit;

  const isPassportPreset =
    dimension.width === PRESETS.passport.width &&
    dimension.height === PRESETS.passport.height &&
    dimension.unit === PRESETS.passport.unit;

  const isIntlPreset =
    (dimension.width === PRESETS.intl.width &&
      dimension.height === PRESETS.intl.height &&
      dimension.unit === PRESETS.intl.unit) ||
    (dimension.width === 51 && dimension.height === 51 && dimension.unit === 'mm');

  const onWidthChange = (val: number) => {
    if (isNaN(val) || val <= 0) return;
    const clampedVal = dimension.unit === 'px' ? clampDimension(val) : val;
    if (dimension.lockRatio && dimension.width > 0) {
      const ratio = clampedVal / dimension.width;
      const newHeight = dimension.unit === 'px' ? clampDimension(Math.round(dimension.height * ratio)) : Number((dimension.height * ratio).toFixed(1));
      onDimensionChange({ ...dimension, width: clampedVal, height: newHeight });
    } else {
      onDimensionChange({ ...dimension, width: clampedVal });
    }
  };

  const onHeightChange = (val: number) => {
    if (isNaN(val) || val <= 0) return;
    const clampedVal = dimension.unit === 'px' ? clampDimension(val) : val;
    if (dimension.lockRatio && dimension.height > 0) {
      const ratio = clampedVal / dimension.height;
      const newWidth = dimension.unit === 'px' ? clampDimension(Math.round(dimension.width * ratio)) : Number((dimension.width * ratio).toFixed(1));
      onDimensionChange({ ...dimension, width: newWidth, height: clampedVal });
    } else {
      onDimensionChange({ ...dimension, height: clampedVal });
    }
  };

  const onUnitChange = (unit: Unit) => {
    onDimensionChange({ ...dimension, unit });
  };

  const onDpiChange = (dpi: number) => {
    if (isNaN(dpi) || dpi <= 0) return;
    onDimensionChange({ ...dimension, dpi });
  };

  const onToggleLockRatio = (lockRatio: boolean) => {
    onDimensionChange({ ...dimension, lockRatio });
  };

  return (
    <aside class="dashboard-settings-col" aria-label={t('aria.settings_panel')}>
      {/* Size Card */}
      <div class="settings-card">
        <h3 class="card-title">📏 {t('size.title')}</h3>

        <div class="preset-buttons" role="group" aria-label={t('aria.size_presets')}>
          <button
            type="button"
            class={`btn btn-sm ${isNusukPreset ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onDimensionChange(PRESETS.nusuk)}
          >
            {t('size.preset_nusuk')}
          </button>
          <button
            type="button"
            class={`btn btn-sm ${isPassportPreset ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onDimensionChange(PRESETS.passport)}
          >
            {t('size.preset_passport')}
          </button>
          <button
            type="button"
            class={`btn btn-sm ${isIntlPreset ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onDimensionChange(PRESETS.intl)}
          >
            {t('size.preset_intl')}
          </button>
        </div>

        <div class="custom-dim-grid">
          <div class="form-group">
            <label for="dim-width">{t('size.width')}</label>
            <input
              id="dim-width"
              name="dim-width"
              type="number"
              min="1"
              value={dimension.width}
              onChange={(e) => onWidthChange(parseFloat((e.target as HTMLInputElement).value))}
            />
          </div>

          <div class="form-group">
            <label for="dim-height">{t('size.height')}</label>
            <input
              id="dim-height"
              name="dim-height"
              type="number"
              min="1"
              value={dimension.height}
              onChange={(e) => onHeightChange(parseFloat((e.target as HTMLInputElement).value))}
            />
          </div>

          <div class="form-group">
            <label for="dim-unit">{t('size.unit')}</label>
            <select
              id="dim-unit"
              name="dim-unit"
              value={dimension.unit}
              onChange={(e) => onUnitChange((e.target as HTMLSelectElement).value as Unit)}
            >
              <option value="px">px</option>
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="in">in</option>
            </select>
          </div>

          <div class="form-group">
            <label for="dim-dpi">{t('size.dpi')}</label>
            <input
              id="dim-dpi"
              name="dim-dpi"
              type="number"
              min="72"
              max="1200"
              value={dimension.dpi}
              onChange={(e) => onDpiChange(parseInt((e.target as HTMLInputElement).value, 10))}
            />
          </div>
        </div>

        <label class="checkbox-label lock-ratio-label">
          <input
            type="checkbox"
            name="lock-ratio"
            checked={dimension.lockRatio}
            onChange={(e) => onToggleLockRatio((e.target as HTMLInputElement).checked)}
          />
          <span>{t('size.lock_ratio')}</span>
        </label>
      </div>

      {/* Background Removal Card */}
      <div class="settings-card">
        <h3 class="card-title">✨ {t('bg.title')}</h3>

        <label class="toggle-label">
          <input
            type="checkbox"
            name="bg-remove"
            checked={bgRemovalActive}
            disabled={bgLoading}
            onChange={(e) => onToggleBgRemoval((e.target as HTMLInputElement).checked)}
          />
          <span class="toggle-text">{t('bg.remove_ai')}</span>
        </label>

        {bgLoading && (
          <div class="bg-loading-indicator" role="status">
            <span class="spinner" aria-hidden="true" />
            <span>{t('bg.loading_model')}</span>
          </div>
        )}

        {bgRemovalActive && !bgLoading && (
          <div class="bg-active-controls">
            <div class="feather-control">
              <div class="feather-header">
                <label for="feather-slider">{t('bg.feather')}</label>
                <span class="feather-val">{featherRadius.toFixed(1)} px</span>
              </div>
              <input
                id="feather-slider"
                name="feather-slider"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={featherRadius}
                onInput={(e) => onFeatherChange(parseFloat((e.target as HTMLInputElement).value) || 0)}
              />
            </div>

            <div class="compare-actions">
              <button
                type="button"
                class="btn btn-secondary compare-btn"
                onPointerDown={onCompareStart}
                onPointerUp={onCompareEnd}
                onPointerLeave={onCompareEnd}
                onTouchStart={onCompareStart}
                onTouchEnd={onCompareEnd}
              >
                👁️ {t('bg.hold_compare')}
              </button>
              <button
                type="button"
                class="btn btn-outline restore-btn"
                onClick={() => onToggleBgRemoval(false)}
              >
                ↩️ {t('bg.restore')}
              </button>
            </div>

            <p class="bg-hint">💡 {t('bg.check_contours')}</p>
          </div>
        )}
      </div>

      {/* Export Card */}
      <div class="settings-card">
        <h3 class="card-title">💾 {t('export.title')}</h3>

        <div class="format-toggle" role="radiogroup" aria-label={t('export.format')}>
          <label class="radio-label">
            <input
              type="radio"
              name="export-fmt"
              value="image/png"
              checked={exportConfig.format === 'image/png'}
              onChange={() => onExportConfigChange({ ...exportConfig, format: 'image/png' })}
            />
            <span>
              PNG <span class="badge-rec">{t('export.recommended')}</span>
            </span>
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="export-fmt"
              value="image/jpeg"
              checked={exportConfig.format === 'image/jpeg'}
              onChange={() => onExportConfigChange({ ...exportConfig, format: 'image/jpeg' })}
            />
            <span>JPG</span>
          </label>
        </div>

        {exportConfig.format === 'image/jpeg' && adjustedQuality !== undefined && (
          <p class="quality-info">
            ℹ️ {t('export.quality_adjusted', { quality: adjustedQuality.toFixed(2) })}
          </p>
        )}

        {exportConfig.format === 'image/png' && encodedBytes > MAX_NUSUK_BYTES && (
          <div class="warning-banner" role="alert">
            <p>⚠️ {t('export.png_warning')}</p>
            <button
              type="button"
              class="btn btn-sm btn-primary switch-btn"
              onClick={() => onExportConfigChange({ ...exportConfig, format: 'image/jpeg' })}
            >
              {t('export.switch_to_jpg')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
