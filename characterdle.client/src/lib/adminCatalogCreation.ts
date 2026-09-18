export const maxPortraitBytes = 5 * 1024 * 1024;

export function portraitFileError(file: Pick<File, 'size' | 'type'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG, or WebP image.';
  return file.size === 0 || file.size > maxPortraitBytes ? 'Images must be non-empty and 5 MB or smaller.' : null;
}

// Called only on Save. The selected image stays a local blob URL until then.
export function encodePortrait(file: File): Promise<{ contentType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected image. Select it again.'));
    reader.onabort = () => reject(new Error('Image reading was interrupted.'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ contentType: file.type, data: result.slice(result.indexOf(',') + 1) });
    };
    reader.readAsDataURL(file);
  });
}
