// הקטנת תמונה לפני העלאה (צד ארוך עד 1600 פיקסלים, JPEG)
export function shrink(file, max = 1600, bg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const g = c.getContext('2d');
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); } // לוגו שקוף: רקע לבן ולא שחור
      g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

// תמונה ל-AI: מוקטנת ל-base64 (בלי להעלות לשום מקום)
export async function toAIImage(file, max = 1400) {
  const blob = await shrink(file, max);
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  return { mime: 'image/jpeg', data, blob };
}
