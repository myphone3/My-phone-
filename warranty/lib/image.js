// הכנת תמונה לפני העלאה: הקטנה, ובאופציה — שיפור קבלה (חיתוך הרקע סביב הנייר + ניגודיות)
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

// מחפש את הנייר הבהיר על רקע כהה יותר. מחזיר מלבן או null אם לא בטוח.
function findPaper(lum, w, h) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < lum.length; i++) hist[lum[i]]++;
  // סף אוטומטי (Otsu)
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = lum.length - wB; if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; th = t; }
  }
  const rowFrac = new Float32Array(h), colFrac = new Float32Array(w); // מספר פיקסלים בהירים בכל שורה/עמודה
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lum[y * w + x] > th) { rowFrac[y]++; colFrac[x]++; }
  // שורה/עמודה "של נייר" = לפחות חצי מהמקסימום של פיקסלים בהירים
  const edge = (arr, n) => {
    const max = Math.max(...arr);
    if (!max) return [0, n - 1];
    let a = 0, b = n - 1;
    while (a < n && arr[a] < max * 0.5) a++;
    while (b > a && arr[b] < max * 0.5) b--;
    return [a, b];
  };
  const [y0, y1] = edge(rowFrac, h);
  const [x0, x1] = edge(colFrac, w);
  const area = ((x1 - x0) * (y1 - y0)) / (w * h);
  if (!(area > 0.06 && area < 0.93)) return null;
  // לוודא שבאמת יש הבדל: הנייר בהיר בהרבה מהרקע
  let inS = 0, inN = 0, outS = 0, outN = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const v = lum[y * w + x];
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { inS += v; inN++; } else { outS += v; outN++; }
  }
  if (!outN || inS / inN - outS / outN < 35) return null;
  const pad = Math.round(Math.min(w, h) * 0.015);
  return { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: Math.min(w, x1 + pad) - Math.max(0, x0 - pad), h: Math.min(h, y1 + pad) - Math.max(0, y0 - pad) };
}

function enhance(img, maxSide) {
  // שלב 1: תמונה קטנה לניתוח
  const aw = 240, ah = Math.max(1, Math.round((img.height / img.width) * aw));
  const a = document.createElement('canvas'); a.width = aw; a.height = ah;
  const actx = a.getContext('2d', { willReadFrequently: true });
  actx.drawImage(img, 0, 0, aw, ah);
  const ad = actx.getImageData(0, 0, aw, ah).data;
  const lum = new Uint8Array(aw * ah);
  for (let i = 0; i < lum.length; i++) lum[i] = (ad[i * 4] * 0.299 + ad[i * 4 + 1] * 0.587 + ad[i * 4 + 2] * 0.114) | 0;
  const box = findPaper(lum, aw, ah);
  const k = img.width / aw;
  const src = box ? { x: box.x * k, y: box.y * k, w: box.w * k, h: box.h * k } : { x: 0, y: 0, w: img.width, h: img.height };

  // שלב 2: חיתוך והקטנה
  const scale = Math.min(1, maxSide / Math.max(src.w, src.h));
  const c = document.createElement('canvas');
  c.width = Math.round(src.w * scale); c.height = Math.round(src.h * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, c.width, c.height);

  // שלב 3: מתיחת ניגודיות לכל ערוץ צבע בנפרד (2%–92%) — דהוי הופך לקריא, נייר צהבהב/אפור הופך ללבן
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const luts = [0, 1, 2].map((ch) => {
    const hist = new Array(256).fill(0);
    let total = 0;
    for (let i = ch; i < d.length; i += 16) { hist[d[i]]++; total++; }
    let lo = 0, hi = 255, acc = 0;
    for (; lo < 255; lo++) { acc += hist[lo]; if (acc > total * 0.02) break; }
    acc = 0;
    for (; hi > 0; hi--) { acc += hist[hi]; if (acc > total * 0.08) break; }
    if (hi - lo < 40) return null;
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); lut[v] = 255 * Math.pow(t, 1.15); }
    return lut;
  });
  if (luts.every(Boolean)) {
    for (let i = 0; i < d.length; i += 4) { d[i] = luts[0][d[i]]; d[i + 1] = luts[1][d[i + 1]]; d[i + 2] = luts[2][d[i + 2]]; }
    ctx.putImageData(id, 0, 0);
  }
  return c;
}

export async function prepareImage(file, { maxSide = 1800, quality = 0.82, improve = false } = {}) {
  const img = await loadImage(file);
  let c;
  if (improve) {
    try { c = enhance(img, maxSide); } catch { c = null; }
  }
  if (!c) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  }
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('compress failed'))), 'image/jpeg', quality));
}
