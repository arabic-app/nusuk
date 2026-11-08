// src/App.tsx
import { useState, useEffect, useRef } from 'preact/hooks';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { CropViewport } from './components/CropViewport';
import { ActionBar } from './components/ActionBar';
import { SettingsPanel } from './components/SettingsPanel';
import {
  IconZoomIn,
  IconZoomOut,
  IconCenter,
  IconFit,
  IconFill,
  IconRotateCw,
  IconFlipHorizontal,
  IconFaceGuide,
  IconReset,
  IconChangePhoto,
  IconAlert
} from './components/Icons';
import { OutputDimension, TransformState, ExportConfig } from './types';
import { PRESETS, convertToPixels, clampDimension } from './utils/dimensions';
import { createDefaultTransform, rotate90, toggleFlip, fitTransform, fillTransform } from './utils/transform';
import { detectFace, computeFaceFraming } from './utils/faceDetection';
import { renderAndEncode, getExportFilename, MAX_NUSUK_BYTES } from './utils/exportBridge';
import { getBackgroundRemover } from './services/BackgroundRemover';
import { t, subscribeLocale, initLocale } from './utils/i18n';
import { initTheme } from './utils/theme';
import './styles/theme.css';
import './styles/viewport.css';
import './styles/app.css';

export function App() {
  const [, setTick] = useState(0);

  useEffect(() => {
    initLocale();
    initTheme();
    return subscribeLocale(() => setTick((v) => v + 1));
  }, []);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalBitmap, setOriginalBitmap] = useState<ImageBitmap | null>(null);
  const [processedBitmap, setProcessedBitmap] = useState<ImageBitmap | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const [dimension, setDimension] = useState<OutputDimension>(PRESETS.nusuk);
  const [transform, setTransform] = useState<TransformState>(createDefaultTransform());
  const [showOvalGuide, setShowOvalGuide] = useState(true);

  const [bgRemovalActive, setBgRemovalActive] = useState(false);
  const [bgLoading, setBgLoading] = useState(false);
  const [featherRadius, setFeatherRadius] = useState(0);

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'image/png',
    quality: 0.95,
    maxBytes: MAX_NUSUK_BYTES
  });

  const [encodedBytes, setEncodedBytes] = useState<number>(0);
  const [encodedBlob, setEncodedBlob] = useState<Blob | null>(null);
  const [adjustedQuality, setAdjustedQuality] = useState<number | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initialTransformRef = useRef<TransformState | null>(null);

  const updateTransform = (next: TransformState | ((prev: TransformState) => TransformState)) => {
    setEncodedBlob(null);
    setTransform(next);
  };

  const updateDimension = (d: OutputDimension) => {
    setEncodedBlob(null);
    setDimension(d);
  };

  const updateExportConfig = (cfg: ExportConfig) => {
    setEncodedBlob(null);
    setExportConfig(cfg);
  };

  const cropW = clampDimension(convertToPixels(dimension.width, dimension.unit, dimension.dpi));
  const cropH = clampDimension(convertToPixels(dimension.height, dimension.unit, dimension.dpi));

  // Active bitmap displayed in viewport
  const activeBitmap =
    bgRemovalActive && processedBitmap && !isComparing
      ? processedBitmap
      : originalBitmap;

  // Load image bitmap when file selected and auto-crop with face detection
  useEffect(() => {
    if (!imageFile) return;

    if (typeof createImageBitmap !== 'function') {
      setErrorMsg('createImageBitmap non supporté par ce navigateur.');
      return;
    }

    createImageBitmap(imageFile, { imageOrientation: 'from-image' })
      .then(async (bmp) => {
        setOriginalBitmap((prev) => {
          prev?.close?.();
          return bmp;
        });
        setProcessedBitmap((prev) => {
          prev?.close?.();
          return null;
        });
        setBgRemovalActive(false);

        // Pre-crop photo using intelligent face detection
        let initialT: TransformState;
        try {
          const faceBox = await detectFace(bmp);
          initialT = computeFaceFraming(cropW, cropH, bmp.width, bmp.height, faceBox);
        } catch {
          initialT = fillTransform(cropW, cropH, bmp.width, bmp.height);
        }
        initialTransformRef.current = initialT;
        setTransform(initialT);
      })
      .catch(() => setErrorMsg(t('error.read_image')));
  }, [imageFile]);

  // Handle background removal toggle & updates
  const handleToggleBgRemoval = async (active: boolean) => {
    if (!active) {
      setBgRemovalActive(false);
      setProcessedBitmap((prev) => {
        prev?.close?.();
        return null;
      });
      return;
    }

    if (!originalBitmap) return;

    try {
      setBgLoading(true);
      const remover = getBackgroundRemover();
      if (!remover.isLoaded) {
        await remover.init();
      }
      const result = await remover.removeBackground(originalBitmap, featherRadius, false);
      setProcessedBitmap((prev) => {
        prev?.close?.();
        return result;
      });
      setBgRemovalActive(true);
    } catch {
      setErrorMsg(t('error.bg_removal'));
    } finally {
      setBgLoading(false);
    }
  };

  const featherTimerRef = useRef<any>(null);
  const handleFeatherChange = (radius: number) => {
    setFeatherRadius(radius);
    if (!bgRemovalActive || !originalBitmap) return;

    clearTimeout(featherTimerRef.current);
    featherTimerRef.current = setTimeout(async () => {
      try {
        const remover = getBackgroundRemover();
        const result = await remover.removeBackground(originalBitmap, radius, true);
        setProcessedBitmap((prev) => {
          prev?.close?.();
          return result;
        });
      } catch {
        setErrorMsg(t('error.bg_feather'));
      }
    }, 150);
  };

  // Debounced weight calculation in worker (300ms)
  useEffect(() => {
    if (!activeBitmap) return;

    setEncodedBlob(null);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await renderAndEncode(
          activeBitmap,
          cropW,
          cropH,
          transform,
          exportConfig,
          controller.signal
        );
        setEncodedBytes(res.bytes);
        setEncodedBlob(res.blob);
        setAdjustedQuality(res.adjustedQuality);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setErrorMsg(t('error.generate_file'));
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeBitmap, cropW, cropH, transform, exportConfig]);

  const handleDownload = () => {
    if (!encodedBlob) return;
    try {
      const filename = getExportFilename(cropW, cropH, exportConfig.format);
      const url = URL.createObjectURL(encodedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 2000);
    } catch {
      setErrorMsg(t('error.generate_file'));
    }
  };

  const handleResetTransform = () => {
    if (initialTransformRef.current) {
      updateTransform(initialTransformRef.current);
    } else if (activeBitmap) {
      updateTransform(fillTransform(cropW, cropH, activeBitmap.width, activeBitmap.height));
    }
  };

  const handleClosePhoto = () => {
    setImageFile(null);
    setOriginalBitmap((prev) => {
      prev?.close?.();
      return null;
    });
    setProcessedBitmap((prev) => {
      prev?.close?.();
      return null;
    });
    initialTransformRef.current = null;
    setBgRemovalActive(false);
    setEncodedBlob(null);
    setEncodedBytes(0);
    setAdjustedQuality(undefined);
    setErrorMsg(null);
  };

  return (
    <div class="app-root">
      <Header />

      <main class="app-main">
        {errorMsg && (
          <div
            class="toast-error"
            role="alert"
            onClick={() => setErrorMsg(null)}
            title={t('aria.close_toast')}
            aria-label={t('aria.close_toast')}
          >
            <IconAlert size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {!activeBitmap ? (
          <div class="landing-view">
            <Dropzone
              onImageSelected={(file) => setImageFile(file)}
              onError={(msg) => setErrorMsg(msg)}
            />
            <p class="privacy-notice">🔒 {t('privacy.badge')}</p>
          </div>
        ) : (
          <div class="dashboard-layout">
            <div class="dashboard-viewport-col">
              <CropViewport
                imageBitmap={activeBitmap}
                cropWidth={cropW}
                cropHeight={cropH}
                transform={transform}
                showOvalGuide={showOvalGuide}
                onTransformChange={updateTransform}
              />

              <div class="quick-toolbar" role="toolbar" aria-label={t('aria.toolbar')}>
                <div class="toolbar-group">
                  <button
                    type="button"
                    class="btn btn-tool btn-icon-only"
                    onClick={() =>
                      updateTransform((t) => ({ ...t, scale: Math.max(0.1, Number((t.scale * 0.9).toFixed(3))) }))
                    }
                    title={`${t('controls.zoom')} -`}
                    aria-label={`${t('controls.zoom')} -`}
                  >
                    <IconZoomOut size={16} />
                  </button>
                  <button
                    type="button"
                    class="btn btn-tool btn-icon-only"
                    onClick={() =>
                      updateTransform((t) => ({ ...t, scale: Math.min(10, Number((t.scale * 1.1).toFixed(3))) }))
                    }
                    title={`${t('controls.zoom')} +`}
                    aria-label={`${t('controls.zoom')} +`}
                  >
                    <IconZoomIn size={16} />
                  </button>
                </div>

                <div class="toolbar-divider" />

                <div class="toolbar-group">
                  <button
                    type="button"
                    class="btn btn-tool"
                    onClick={() => updateTransform((t) => ({ ...t, tx: 0, ty: 0 }))}
                    title={t('controls.center')}
                  >
                    <IconCenter size={16} />
                    <span>{t('controls.center')}</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-tool"
                    onClick={() => {
                      if (activeBitmap) {
                        updateTransform(fitTransform(cropW, cropH, activeBitmap.width, activeBitmap.height));
                      }
                    }}
                    title={t('controls.fit')}
                  >
                    <IconFit size={16} />
                    <span>{t('controls.fit')}</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-tool"
                    onClick={() => {
                      if (activeBitmap) {
                        updateTransform(fillTransform(cropW, cropH, activeBitmap.width, activeBitmap.height));
                      }
                    }}
                    title={t('controls.fill')}
                  >
                    <IconFill size={16} />
                    <span>{t('controls.fill')}</span>
                  </button>
                </div>

                <div class="toolbar-divider" />

                <div class="toolbar-group">
                  <button
                    type="button"
                    class="btn btn-tool"
                    onClick={() => updateTransform(rotate90)}
                    title={t('controls.rotate')}
                  >
                    <IconRotateCw size={16} />
                    <span>{t('controls.rotate')}</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-tool"
                    onClick={() => updateTransform(toggleFlip)}
                    title={t('controls.flip')}
                  >
                    <IconFlipHorizontal size={16} />
                    <span>{t('controls.flip')}</span>
                  </button>
                  <button
                    type="button"
                    class={`btn btn-tool ${showOvalGuide ? 'active' : ''}`}
                    onClick={() => setShowOvalGuide((s) => !s)}
                    title={t('controls.oval_guide')}
                  >
                    <IconFaceGuide size={16} />
                    <span>{t('controls.oval_guide')}</span>
                  </button>
                </div>

                <div class="toolbar-divider" />

                <div class="toolbar-group">
                  <button
                    type="button"
                    class="btn btn-tool btn-reset"
                    onClick={handleResetTransform}
                    title={t('controls.reset')}
                  >
                    <IconReset size={16} />
                    <span>{t('controls.reset')}</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-tool btn-close-photo"
                    onClick={handleClosePhoto}
                    title={t('controls.change_photo')}
                  >
                    <IconChangePhoto size={16} />
                    <span>{t('controls.change_photo')}</span>
                  </button>
                </div>
              </div>
            </div>

            <SettingsPanel
              dimension={dimension}
              onDimensionChange={updateDimension}
              exportConfig={exportConfig}
              onExportConfigChange={updateExportConfig}
              encodedBytes={encodedBytes}
              adjustedQuality={adjustedQuality}
              bgRemovalActive={bgRemovalActive}
              bgLoading={bgLoading}
              featherRadius={featherRadius}
              onToggleBgRemoval={handleToggleBgRemoval}
              onFeatherChange={handleFeatherChange}
              onCompareStart={() => setIsComparing(true)}
              onCompareEnd={() => setIsComparing(false)}
            />
          </div>
        )}
      </main>

      {activeBitmap && (
        <ActionBar
          cropWidth={cropW}
          cropHeight={cropH}
          bytes={encodedBytes}
          onDownload={handleDownload}
          disabled={!encodedBlob}
        />
      )}
    </div>
  );
}
