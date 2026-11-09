// src/components/SettingsPanel.tsx
import { OutputDimension, ExportConfig, Unit, SheetConfig } from '../types';
import { PRESETS, SHEET_PRESETS, clampDimension, convertToPixels } from '../utils/dimensions';
import { calculateSheetLayout } from '../utils/sheetTiling';
import { getMaxExportBytes, formatMaxMb } from '../utils/exportBridge';
import { isPhotoSheetEnabled } from '../utils/features';
import { Brand, getBrand } from '../utils/brand';
import { t } from '../utils/i18n';
import {
  IconRuler,
  IconSparkles,
  IconEye,
  IconUndo,
  IconInfo,
  IconSave,
  IconAlert,
  IconGrid,
  IconScissors
} from './Icons';

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
  sheetConfig?: SheetConfig;
  onSheetConfigChange?: (cfg: SheetConfig) => void;
  onOpenSheetPreview?: () => void;
  showPhotoSheet?: boolean;
  brand?: Brand;
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
  onCompareEnd,
  sheetConfig,
  onSheetConfigChange,
  onOpenSheetPreview,
  showPhotoSheet = isPhotoSheetEnabled(),
  brand = getBrand()
}: SettingsPanelProps) {
  const isNusuk = brand === 'nusuk';

  const isNusukPreset =
    dimension.width === PRESETS.nusuk.width &&
    dimension.height === PRESETS.nusuk.height &&
    dimension.unit === PRESETS.nusuk.unit;

  const isNusukDocPreset =
    dimension.width === PRESETS.nusukDoc.width &&
    dimension.height === PRESETS.nusukDoc.height &&
    dimension.unit === PRESETS.nusukDoc.unit;

  const isPassportPreset =
    dimension.width === PRESETS.passport.width &&
    dimension.height === PRESETS.passport.height &&
    dimension.unit === PRESETS.passport.unit;

  const isIntlPreset =
    (dimension.width === PRESETS.intl.width &&
      dimension.height === PRESETS.intl.height &&
      dimension.unit === PRESETS.intl.unit) ||
    (dimension.width === 51 && dimension.height === 51 && dimension.unit === 'mm');

  const isCanadaPreset =
    dimension.width === PRESETS.canada.width &&
    dimension.height === PRESETS.canada.height &&
    dimension.unit === PRESETS.canada.unit;

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
      {/* Background Removal Card */}
      <div class="settings-card">
        <h3 class="card-title">
          <IconSparkles size={18} class="card-title-icon" />
          <span>{t('bg.title')}</span>
        </h3>

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
                <IconEye size={16} />
                <span>{t('bg.hold_compare')}</span>
              </button>
              <button
                type="button"
                class="btn btn-outline restore-btn"
                onClick={() => onToggleBgRemoval(false)}
              >
                <IconUndo size={16} />
                <span>{t('bg.restore')}</span>
              </button>
            </div>

            <p class="bg-hint">
              <IconInfo size={14} />
              <span>{t('bg.check_contours')}</span>
            </p>
          </div>
        )}
      </div>

      {/* Size Card */}
      <div class="settings-card">
        <h3 class="card-title">
          <IconRuler size={18} class="card-title-icon" />
          <span>{t('size.title')}</span>
        </h3>

        <div class="preset-buttons" role="group" aria-label={t('aria.size_presets')}>
          {isNusuk ? (
            <>
              <button
                type="button"
                class={`btn btn-sm ${isNusukPreset ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onDimensionChange(PRESETS.nusuk)}
                title={t('size.preset_nusuk_tooltip')}
              >
                {t('size.preset_nusuk')}
              </button>
              <button
                type="button"
                class={`btn btn-sm ${isNusukDocPreset ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onDimensionChange(PRESETS.nusukDoc)}
                title={t('size.preset_nusuk_doc_tooltip')}
              >
                {t('size.preset_nusuk_doc')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                class={`btn btn-sm ${isPassportPreset ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onDimensionChange(PRESETS.passport)}
                title={t('size.preset_passport_tooltip')}
              >
                {t('size.preset_passport')}
              </button>
              <button
                type="button"
                class={`btn btn-sm ${isIntlPreset ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onDimensionChange(PRESETS.intl)}
                title={t('size.preset_intl_tooltip')}
              >
                {t('size.preset_intl')}
              </button>
              <button
                type="button"
                class={`btn btn-sm ${isCanadaPreset ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onDimensionChange(PRESETS.canada)}
                title={t('size.preset_canada_tooltip')}
              >
                {t('size.preset_canada')}
              </button>
            </>
          )}
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

          {dimension.unit !== 'px' ? (
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
          ) : (
            <div class="form-group">
              <label>{t('size.pixel_result') || 'Pixels'}</label>
              <div class="computed-pixels-badge" title={t('size.pixel_result')}>
                → {clampDimension(convertToPixels(dimension.width, dimension.unit, dimension.dpi))} × {clampDimension(convertToPixels(dimension.height, dimension.unit, dimension.dpi))} px
              </div>
            </div>
          )}
        </div>

        {dimension.unit !== 'px' && (
          <div class="computed-pixels-banner">
            → {clampDimension(convertToPixels(dimension.width, dimension.unit, dimension.dpi))} × {clampDimension(convertToPixels(dimension.height, dimension.unit, dimension.dpi))} px
          </div>
        )}

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

      {/* Photo Sheet (Palette) Card */}
      {showPhotoSheet && sheetConfig && onSheetConfigChange && (
        <div class="settings-card palette-card">
          <h3 class="card-title">
            <IconGrid size={18} class="card-title-icon" />
            <span>{t('palette.title')}</span>
          </h3>

          <label class="toggle-label">
            <input
              type="checkbox"
              name="palette-enabled"
              checked={sheetConfig.enabled}
              onChange={(e) =>
                onSheetConfigChange({
                  ...sheetConfig,
                  enabled: (e.target as HTMLInputElement).checked
                })
              }
            />
            <span class="toggle-text">{t('palette.toggle')}</span>
          </label>

          {sheetConfig.enabled && (
            <div class="palette-expanded-options">
              {/* Presets */}
              <div class="preset-buttons" role="group" aria-label={t('palette.title')}>
                <button
                  type="button"
                  class={`btn btn-sm ${sheetConfig.preset === '10x15' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    const preset = SHEET_PRESETS['10x15'];
                    onSheetConfigChange({
                      ...sheetConfig,
                      preset: '10x15',
                      width: preset.width,
                      height: preset.height,
                      unit: preset.unit,
                      dpi: preset.dpi
                    });
                  }}
                >
                  {t('palette.preset_10x15')}
                </button>
                <button
                  type="button"
                  class={`btn btn-sm ${sheetConfig.preset === '13x18' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    const preset = SHEET_PRESETS['13x18'];
                    onSheetConfigChange({
                      ...sheetConfig,
                      preset: '13x18',
                      width: preset.width,
                      height: preset.height,
                      unit: preset.unit,
                      dpi: preset.dpi
                    });
                  }}
                >
                  {t('palette.preset_13x18')}
                </button>
                <button
                  type="button"
                  class={`btn btn-sm ${sheetConfig.preset === 'a4' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    const preset = SHEET_PRESETS['a4'];
                    onSheetConfigChange({
                      ...sheetConfig,
                      preset: 'a4',
                      width: preset.width,
                      height: preset.height,
                      unit: preset.unit,
                      dpi: preset.dpi
                    });
                  }}
                >
                  {t('palette.preset_a4')}
                </button>
                <button
                  type="button"
                  class={`btn btn-sm ${sheetConfig.preset === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() =>
                    onSheetConfigChange({
                      ...sheetConfig,
                      preset: 'custom'
                    })
                  }
                >
                  {t('palette.preset_custom')}
                </button>
              </div>

              {/* Custom dimensions if preset === 'custom' */}
              {sheetConfig.preset === 'custom' && (
                <div class="custom-dim-grid">
                  <div class="form-group">
                    <label for="sheet-width">{t('size.width')}</label>
                    <input
                      id="sheet-width"
                      name="sheet-width"
                      type="number"
                      min="1"
                      value={sheetConfig.width}
                      onChange={(e) =>
                        onSheetConfigChange({
                          ...sheetConfig,
                          width: parseFloat((e.target as HTMLInputElement).value) || sheetConfig.width
                        })
                      }
                    />
                  </div>
                  <div class="form-group">
                    <label for="sheet-height">{t('size.height')}</label>
                    <input
                      id="sheet-height"
                      name="sheet-height"
                      type="number"
                      min="1"
                      value={sheetConfig.height}
                      onChange={(e) =>
                        onSheetConfigChange({
                          ...sheetConfig,
                          height: parseFloat((e.target as HTMLInputElement).value) || sheetConfig.height
                        })
                      }
                    />
                  </div>
                  <div class="form-group">
                    <label for="sheet-unit">{t('size.unit')}</label>
                    <select
                      id="sheet-unit"
                      name="sheet-unit"
                      value={sheetConfig.unit}
                      onChange={(e) =>
                        onSheetConfigChange({
                          ...sheetConfig,
                          unit: (e.target as HTMLSelectElement).value as Unit
                        })
                      }
                    >
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                      <option value="in">in</option>
                      <option value="px">px</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="sheet-dpi">{t('size.dpi')}</label>
                    <input
                      id="sheet-dpi"
                      name="sheet-dpi"
                      type="number"
                      min="72"
                      max="1200"
                      value={sheetConfig.dpi}
                      onChange={(e) =>
                        onSheetConfigChange({
                          ...sheetConfig,
                          dpi: parseInt((e.target as HTMLInputElement).value, 10) || sheetConfig.dpi
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Orientation selector */}
              <div class="form-group palette-orientation-group">
                <label>{t('palette.orientation')}</label>
                <div class="segmented-control" role="radiogroup">
                  <button
                    type="button"
                    class={`segment-btn ${sheetConfig.orientation === 'auto' ? 'active' : ''}`}
                    onClick={() => onSheetConfigChange({ ...sheetConfig, orientation: 'auto' })}
                  >
                    {t('palette.orientation_auto')}
                  </button>
                  <button
                    type="button"
                    class={`segment-btn ${sheetConfig.orientation === 'landscape' ? 'active' : ''}`}
                    onClick={() => onSheetConfigChange({ ...sheetConfig, orientation: 'landscape' })}
                  >
                    {t('palette.orientation_landscape')}
                  </button>
                  <button
                    type="button"
                    class={`segment-btn ${sheetConfig.orientation === 'portrait' ? 'active' : ''}`}
                    onClick={() => onSheetConfigChange({ ...sheetConfig, orientation: 'portrait' })}
                  >
                    {t('palette.orientation_portrait')}
                  </button>
                </div>
              </div>

              {/* Cut guides option */}
              <label class="checkbox-label cut-guides-label">
                <input
                  type="checkbox"
                  name="cut-guides"
                  checked={sheetConfig.cutGuides}
                  onChange={(e) =>
                    onSheetConfigChange({
                      ...sheetConfig,
                      cutGuides: (e.target as HTMLInputElement).checked
                    })
                  }
                />
                <IconScissors size={15} class="icon-inline" />
                <span>{t('palette.cut_guides')}</span>
              </label>

              {/* Info badge */}
              {(() => {
                const cropWidthPx = clampDimension(convertToPixels(dimension.width, dimension.unit, dimension.dpi));
                const cropHeightPx = clampDimension(convertToPixels(dimension.height, dimension.unit, dimension.dpi));
                const layout = calculateSheetLayout(cropWidthPx, cropHeightPx, sheetConfig);
                return (
                  <div class="palette-info-badge">
                    <IconInfo size={16} />
                    <span>
                      {t('palette.info', {
                        count: layout.totalPhotos,
                        cols: layout.cols,
                        rows: layout.rows
                      })}
                    </span>
                  </div>
                );
              })()}

              {/* Preview Button */}
              {onOpenSheetPreview && (
                <button
                  type="button"
                  class="btn btn-secondary btn-block preview-sheet-btn"
                  onClick={onOpenSheetPreview}
                >
                  <IconEye size={16} />
                  <span>{t('palette.preview_btn')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Export Card */}
      <div class="settings-card">
        <h3 class="card-title">
          <IconSave size={18} class="card-title-icon" />
          <span>{t('export.title')}</span>
        </h3>

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
            <IconInfo size={14} />
            <span>
              {t('export.quality_adjusted', {
                quality: adjustedQuality.toFixed(2),
                max: formatMaxMb(exportConfig.maxBytes ?? getMaxExportBytes(brand))
              })}
            </span>
          </p>
        )}

        {exportConfig.format === 'image/png' &&
          encodedBytes > (exportConfig.maxBytes ?? getMaxExportBytes(brand)) && (
            <div class="warning-banner" role="alert">
              <p>
                <IconAlert size={16} />
                <span>
                  {isNusuk
                    ? t('export.png_warning', {
                        max: formatMaxMb(exportConfig.maxBytes ?? getMaxExportBytes(brand))
                      })
                    : t('export.png_warning_portrait', {
                        max: formatMaxMb(exportConfig.maxBytes ?? getMaxExportBytes(brand))
                      })}
                </span>
              </p>
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
