// גיבוי: קובץ אקסל (CSV), או ZIP מלא — כל הקבלות עם התמונות וה-PDF, בתיקייה לכל מוצר
import { expiryDate, fmtDate } from './warranty';

export function csvOf(list) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['תמונת מוצר', 'מוצר', 'חנות', 'קטגוריה', 'תאריך קנייה', 'מחיר', 'אחריות (חודשים)', 'הרחבה (חודשים)', 'מחיר הרחבה', 'סיום אחריות', 'מספר סידורי', 'מספר קבלה', 'טלפון שירות', 'טלפון חנות', 'הערות', 'קבצים'];
  const rows = list.map((r) => { const e = expiryDate(r); return [r.product_photo, r.product, r.store, r.category, r.purchase_date, r.price, r.warranty_months, r.ext_months, r.ext_price, e ? fmtDate(e) : '', r.serial, r.receipt_no, r.service_phone, r.store_phone, r.notes, (r.photos || []).join(' ')]; });
  return '﻿' + [head, ...rows].map((x) => x.map(esc).join(',')).join('\n');
}

function save(blob, name) {
  // קובץ עם שם (גם בטלפונים שמתעלמים משם בקישור)
  const file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : blob;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 30000);
}

export function downloadCsv(list) {
  save(new Blob([csvOf(list)], { type: 'text/csv;charset=utf-8' }), `kabalot-${stamp()}.csv`);
}

// שם קובץ באנגלית: חלק מהדפדפנים מתעלמים משם קובץ בעברית
const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

// onProgress(done, total)
export async function downloadZip(vaultName, list, onProgress) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('קבלות.csv', csvOf(list));
  const jobs = [];
  const used = new Set();
  list.forEach((r) => {
    let dir = safe(`${r.purchase_date || 'ללא תאריך'} ${r.product || r.store || 'קבלה'}`);
    while (used.has(dir)) dir += '+';
    used.add(dir);
    if (r.product_photo) jobs.push([`${dir}/מוצר.jpg`, r.product_photo]);
    (r.photos || []).forEach((u, i) => jobs.push([`${dir}/קבלה-${i + 1}.${/\.pdf($|\?)/i.test(u) ? 'pdf' : 'jpg'}`, u]));
  });
  let done = 0, failed = 0;
  onProgress?.(0, jobs.length);
  // 4 הורדות במקביל
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const [path, url] = queue.shift();
      try { const res = await fetch(url); if (!res.ok) throw 0; zip.file(path, await res.blob()); } catch { failed++; }
      onProgress?.(++done, jobs.length);
    }
  }));
  const blob = await zip.generateAsync({ type: 'blob' });
  save(blob, `kabalot-backup-${stamp()}.zip`);
  return { files: jobs.length - failed, failed };
}
