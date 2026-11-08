import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { isValidImageHeader, validateImageFile, MAX_FILE_BYTES } from '../src/utils/fileValidation';
import { Dropzone } from '../src/components/Dropzone';

// Polyfill missing drag event properties on happy-dom's HTMLElement
['ondragover', 'ondragleave', 'ondrop'].forEach((event) => {
  if (typeof window !== 'undefined' && !(event in window.HTMLElement.prototype)) {
    (window.HTMLElement.prototype as any)[event] = null;
  }
});

describe('File validation', () => {
  describe('isValidImageHeader', () => {
    it('detects JPEG magic bytes (FF D8 FF)', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
      expect(isValidImageHeader(bytes)).toBe(true);
    });

    it('detects PNG magic bytes (89 50 4E 47)', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(isValidImageHeader(bytes)).toBe(true);
    });

    it('detects WebP magic bytes (RIFF....WEBP)', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x20, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
        0x56, 0x50, 0x38, 0x20
      ]);
      expect(isValidImageHeader(bytes)).toBe(true);
    });

    it('rejects short byte arrays (< 4 bytes)', () => {
      expect(isValidImageHeader(new Uint8Array([0xff, 0xd8]))).toBe(false);
      expect(isValidImageHeader(new Uint8Array([]))).toBe(false);
    });

    it('rejects invalid executable or text files', () => {
      const textBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // 'Hello'
      expect(isValidImageHeader(textBytes)).toBe(false);
    });

    it('rejects RIFF files that are not WebP (e.g. WAV)', () => {
      const wavBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x24, 0x00, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45
      ]);
      expect(isValidImageHeader(wavBytes)).toBe(false);
    });
  });

  describe('validateImageFile', () => {
    it('accepts valid JPEG file', async () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const file = new File([bytes], 'photo.jpg', { type: 'image/jpeg' });
      const result = await validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts valid PNG file', async () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = new File([bytes], 'photo.png', { type: 'image/png' });
      const result = await validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts valid WebP file', async () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x20, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50
      ]);
      const file = new File([bytes], 'photo.webp', { type: 'image/webp' });
      const result = await validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects file larger than MAX_FILE_BYTES (30MB)', async () => {
      const largeFile = new File(['dummy'], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: MAX_FILE_BYTES + 1 });

      const result = await validateImageFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('dropzone.error_size');
    });

    it('rejects invalid file format despite image extension', async () => {
      const textBytes = new TextEncoder().encode('not an actual image');
      const file = new File([textBytes], 'fake.jpg', { type: 'image/jpeg' });
      const result = await validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('dropzone.error_format');
    });
  });

  describe('Dropzone component', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      render(null, container);
      container.remove();
    });

    it('renders dropzone elements properly', () => {
      const onSelected = vi.fn();
      const onError = vi.fn();

      render(h(Dropzone, { onImageSelected: onSelected, onError }), container);

      const dropzoneEl = container.querySelector('.dropzone-container');
      expect(dropzoneEl).not.toBeNull();
      expect(dropzoneEl?.getAttribute('role')).toBe('button');
      expect(dropzoneEl?.getAttribute('tabindex')).toBe('0');

      const inputs = container.querySelectorAll('input[type="file"]');
      expect(inputs.length).toBe(2);

      const cameraBtn = container.querySelector('.dropzone-actions button');
      expect(cameraBtn).not.toBeNull();
    });

    it('handles dragover and dragleave state', async () => {
      const onSelected = vi.fn();
      const onError = vi.fn();

      render(h(Dropzone, { onImageSelected: onSelected, onError }), container);
      const dropzoneEl = container.querySelector('.dropzone-container') as HTMLElement;

      dropzoneEl.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
      // Allow Preact state update to flush
      await new Promise((r) => setTimeout(r, 10));
      expect(dropzoneEl.classList.contains('drag-over')).toBe(true);

      dropzoneEl.dispatchEvent(new Event('dragleave', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 10));
      expect(dropzoneEl.classList.contains('drag-over')).toBe(false);
    });

    it('processes dropped valid image file', async () => {
      const onSelected = vi.fn();
      const onError = vi.fn();

      render(h(Dropzone, { onImageSelected: onSelected, onError }), container);
      const dropzoneEl = container.querySelector('.dropzone-container') as HTMLElement;

      const validBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
      const validFile = new File([validBytes], 'test.jpg', { type: 'image/jpeg' });

      const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
      dropEvent.dataTransfer = { files: [validFile] };

      dropzoneEl.dispatchEvent(dropEvent);

      await vi.waitFor(() => {
        expect(onSelected).toHaveBeenCalledWith(validFile);
      });
      expect(onError).not.toHaveBeenCalled();
    });

    it('calls onError when dropping invalid file', async () => {
      const onSelected = vi.fn();
      const onError = vi.fn();

      render(h(Dropzone, { onImageSelected: onSelected, onError }), container);
      const dropzoneEl = container.querySelector('.dropzone-container') as HTMLElement;

      const invalidFile = new File(['not an image'], 'test.txt', { type: 'text/plain' });

      const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
      dropEvent.dataTransfer = { files: [invalidFile] };

      dropzoneEl.dispatchEvent(dropEvent);

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
      expect(onSelected).not.toHaveBeenCalled();
    });

    it('processes image pasted from clipboard', async () => {
      const onSelected = vi.fn();
      const onError = vi.fn();

      render(h(Dropzone, { onImageSelected: onSelected, onError }), container);
      // Wait for useEffect to register window paste listener
      await new Promise((r) => setTimeout(r, 50));

      const validBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const validFile = new File([validBytes], 'clipboard.png', { type: 'image/png' });

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any;
      pasteEvent.clipboardData = {
        items: [
          {
            type: 'image/png',
            getAsFile: () => validFile,
          },
        ],
      };

      window.dispatchEvent(pasteEvent);

      await vi.waitFor(() => {
        expect(onSelected).toHaveBeenCalledWith(validFile);
      });
    });

    it('triggers input click on Enter or Space key press', () => {
      const onSelected = vi.fn();
      const onError = vi.fn();

      render(h(Dropzone, { onImageSelected: onSelected, onError }), container);
      const dropzoneEl = container.querySelector('.dropzone-container') as HTMLElement;
      const fileInput = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(fileInput, 'click');

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      dropzoneEl.dispatchEvent(enterEvent);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      dropzoneEl.dispatchEvent(spaceEvent);
      expect(clickSpy).toHaveBeenCalledTimes(2);
    });

    it('processes file selected via file input', async () => {
      const onSelected = vi.fn();
      const onError = vi.fn();

      render(h(Dropzone, { onImageSelected: onSelected, onError }), container);
      const fileInput = container.querySelector('input[accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement;

      const validBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
      const validFile = new File([validBytes], 'selected.jpg', { type: 'image/jpeg' });

      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: true,
      });

      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      await vi.waitFor(() => {
        expect(onSelected).toHaveBeenCalledWith(validFile);
      });
    });
  });
});
