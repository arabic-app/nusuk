import { useState, useRef, useEffect } from 'preact/hooks';
import { t } from '../utils/i18n';
import { validateImageFile } from '../utils/fileValidation';

interface DropzoneProps {
  onImageSelected: (file: File) => void;
  onError: (msg: string) => void;
}

export function Dropzone({ onImageSelected, onError }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const res = await validateImageFile(file);
    if (!res.valid) {
      onError(t(res.error || 'dropzone.error_format'));
      return;
    }
    onImageSelected(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div
      class={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer?.files[0];
        if (file) processFile(file);
      }}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={t('dropzone.title')}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          if (file) processFile(file);
          input.value = '';
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          if (file) processFile(file);
          input.value = '';
        }}
      />

      <div class="dropzone-content">
        <div class="dropzone-icon">📷</div>
        <h2 class="dropzone-title">{t('dropzone.title')}</h2>
        <p class="dropzone-subtitle">{t('dropzone.subtitle')}</p>
        <p class="dropzone-hint">{t('dropzone.paste_hint')}</p>

        <div class="dropzone-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => cameraInputRef.current?.click()}
          >
            📸 {t('dropzone.camera')}
          </button>
        </div>
      </div>
    </div>
  );
}
