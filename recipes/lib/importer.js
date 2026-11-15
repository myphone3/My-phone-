'use client';
// הופך קבצים מהטלפון (תמונות / PDF) לעמודים, מעלה אותם ושולח לקריאה חכמה
import { uploadImage } from './api';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
let pdfjsPromise;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  pdfjsPromise = pdfjsPromise || new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${PDFJS}/pdf.min.js`;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { pdfjsPromise = null; reject(new Error('לא הצלחנו לפתוח את קובץ ה-PDF')); };
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

const toBlob = (canvas, q = 0.82) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('image'))), 'image/jpeg', q));

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('bad image'));
    img.src = src;
  });
}

export async function compressImage(file, maxSide = 1800, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await toBlob(c, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// כל קובץ → רשימת עמודים {blob, preview} + טקסט (מ-PDF עם טקסט)
export async function filesToPages(files, onStatus, maxPages = 10) {
  const pages = [];
  let text = '';
  for (const file of files) {
    if (pages.length >= maxPages) break;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) {
      onStatus?.('פותחים את ה-PDF...');
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      for (let i = 1; i <= doc.numPages && pages.length < maxPages; i++) {
        onStatus?.(`מכינים עמוד ${i} מתוך ${doc.numPages}...`);
        const page = await doc.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(2.5, 1600 / vp1.width) });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width);
        c.height = Math.round(vp.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const blob = await toBlob(c);
        pages.push({ blob, preview: URL.createObjectURL(blob) });
        try {
          const tc = await page.getTextContent();
          const t = tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('');
          if (t.trim()) text += `\n--- עמוד ${i} ---\n` + t;
        } catch {}
      }
    } else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      onStatus?.('מכינים את התמונות...');
      const blob = await compressImage(file);
      pages.push({ blob, preview: URL.createObjectURL(blob) });
    }
  }
  return { pages, text: text.trim() };
}

export async function uploadPages(kitchen, pages, onStatus) {
  const urls = [];
  for (let i = 0; i < pages.length; i++) {
    onStatus?.(`מעלים ${i + 1} מתוך ${pages.length}...`);
    urls.push(await uploadImage(kitchen, pages[i].blob));
  }
  return urls;
}

export async function extractRecipes({ images = [], text = '' }) {
  const r = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, text }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'לא הצלחנו לקרוא את המתכון');
  return j.recipes || [];
}

// חיתוך צילום המנה מתוך העמוד (לפי המסגרת שהבינה המלאכותית מצאה) לתמונה ראשית
export async function cropCover(kitchen, blob, box) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImg(url);
    const [y1, x1, y2, x2] = box;
    const sx = (x1 / 1000) * img.width, sy = (y1 / 1000) * img.height;
    const sw = ((x2 - x1) / 1000) * img.width, sh = ((y2 - y1) / 1000) * img.height;
    if (sw < 120 || sh < 120) return null;
    const scale = Math.min(1, 1400 / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return await uploadImage(kitchen, await toBlob(c, 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
