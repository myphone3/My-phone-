// הקטנת תמונה לפני העלאה (בפאנל): עד 1600 פיקסלים ובפורמט WebP קל.
// תמונה שכבר קטנה וקלה, GIF או SVG, עולה כמו שהיא. אם משהו נכשל, עולה הקובץ המקורי.
const MAX_SIDE = 1600;
const LIGHT_ENOUGH = 250 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (typeof window === 'undefined' || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= LIGHT_ENOUGH) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
  } catch {
    return file;
  }
}
