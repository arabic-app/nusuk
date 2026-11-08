export const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB

export function isValidImageHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return true;
  }

  return false;
}

export async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (file.size > MAX_FILE_BYTES) {
    return { valid: false, error: 'dropzone.error_size' };
  }
  const buffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!isValidImageHeader(bytes)) {
    return { valid: false, error: 'dropzone.error_format' };
  }
  return { valid: true };
}
