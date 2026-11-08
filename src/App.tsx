// src/App.tsx
import { useState, useEffect, useRef } from 'preact/hooks';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { CropViewport } from './components/CropViewport';
import { ActionBar } from './components/ActionBar';
import { SettingsPanel } from './components/SettingsPanel';
import { OutputDimension, TransformState, ExportConfig } from './types';
import { PRESETS, convertToPixels } from './utils/dimensions';
import { createDefaultTransform, rotate90, toggleFlip, fitTransform, fillTransform } from './utils/transform';
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
    format: 'image/jpeg',
    quality: 0.95,
    maxBytes: MAX_NUSUK_BYTES
  });

  const [encodedBytes, setEncodedBytes] = useState<number>(0);
  const [encodedBlob, setEncodedBlob] = useState<Blob | null>(null);
  const [adjustedQuality, setAdjustedQuality] = useState<number | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cropW = convertToPixels(dimension.width, dimension.unit, dimension.dpi);
  const cropH = convertToPixels(dimension.height, dimension.unit, dimension.dpi);

  // Active bitmap displayed in viewport
  const activeBitmap =
    bgRemovalActive && processedBitmap && !isComparing
      ? processedBitmap
      : originalBitmap;

  // Load image bitmap when file selected
  useEffect(() => {
    if (!imageFile) return;

    if (typeof createImageBitmap !== 'function') {
      setErrorMsg('createImageBitmap non supporté par ce navigateur.');
      return;
    }

    createImageBitmap(imageFile, { imageOrientation: 'from-image' })
      .then((bmp) => {
        setOriginalBitmap(bmp);
        setProcessedBitmap(null);
        setBgRemovalActive(false);
        setTransform(fillTransform(cropW, cropH, bmp.width, bmp.height));
      })
      .catch(() => setErrorMsg('Erreur de lecture de la photo.'));
  }, [imageFile]);

  // Handle background removal toggle & updates
  const handleToggleBgRemoval = async (active: boolean) => {
    if (!active) {
      setBgRemovalActive(false);
      setProcessedBitmap(null);
      return;
    }

    if (!originalBitmap) return;

    try {
      setBgLoading(true);
      const remover = getBackgroundRemover();
      if (!remover.isLoaded) {
        await remover.init();
      }
      const result = await remover.removeBackground(originalBitmap, featherRadius);
      setProcessedBitmap(result);
      setBgRemovalActive(true);
    } catch {
      setErrorMsg('Erreur lors du détourage de la photo.');
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
        const result = await remover.removeBackground(originalBitmap, radius);
        setProcessedBitmap(result);
      } catch {
        setErrorMsg('Erreur lors du lissage des contours.');
      }
    }, 150);
  };

  // Debounced weight calculation in worker (300ms)
  useEffect(() => {
    if (!activeBitmap) return;

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
          // Worker encoding error
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
    const filename = getExportFilename(cropW, cropH, exportConfig.format);
    const url = URL.createObjectURL(encodedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setImageFile(null);
    setOriginalBitmap(null);
    setProcessedBitmap(null);
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
            title="Cliquer pour fermer"
          >
            ⚠️ {errorMsg}
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
                onTransformChange={setTransform}
              />

              <div class="quick-toolbar" role="toolbar" aria-label="Outils de cadrage">
                <button
                  type="button"
                  class="btn btn-tool"
                  onClick={() =>
                    setTransform((t) => ({ ...t, scale: Math.max(0.1, t.scale * 0.9) }))
                  }
                  title={t('controls.zoom')}
                >
                  🔍−
                </button>
                <button
                  type="button"
                  class="btn btn-tool"
                  onClick={() =>
                    setTransform((t) => ({ ...t, scale: Math.min(10, t.scale * 1.1) }))
                  }
                  title={t('controls.zoom')}
                >
                  🔍+
                </button>
                <button
                  type="button"
                  class="btn btn-tool"
                  onClick={() => setTransform((t) => ({ ...t, tx: 0, ty: 0 }))}
                >
                  🎯 {t('controls.center')}
                </button>
                <button
                  type="button"
                  class="btn btn-tool"
                  onClick={() => {
                    if (activeBitmap) {
                      setTransform(fitTransform(cropW, cropH, activeBitmap.width, activeBitmap.height));
                    }
                  }}
                >
                  📐 {t('controls.fit')}
                </button>
                <button
                  type="button"
                  class="btn btn-tool"
                  onClick={() => {
                    if (activeBitmap) {
                      setTransform(fillTransform(cropW, cropH, activeBitmap.width, activeBitmap.height));
                    }
                  }}
                >
                  🖼️ {t('controls.fill')}
                </button>
                <button
                  type="button"
                  class="btn btn-tool"
                  onClick={() => setTransform(rotate90)}
                >
                  🔄 {t('controls.rotate')}
                </button>
                <button
                  type="button"
                  class="btn btn-tool"
                  onClick={() => setTransform(toggleFlip)}
                >
                  🪞 {t('controls.flip')}
                </button>
                <button
                  type="button"
                  class={`btn btn-tool ${showOvalGuide ? 'active' : ''}`}
                  onClick={() => setShowOvalGuide((s) => !s)}
                >
                  👤 {t('controls.oval_guide')}
                </button>
                <button
                  type="button"
                  class="btn btn-tool btn-danger"
                  onClick={handleReset}
                >
                  ✕ {t('controls.reset')}
                </button>
              </div>
            </div>

            <SettingsPanel
              dimension={dimension}
              onDimensionChange={setDimension}
              exportConfig={exportConfig}
              onExportConfigChange={setExportConfig}
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
