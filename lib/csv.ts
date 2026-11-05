// טקסט שמתחיל ב- = + - @ אקסל מריץ כנוסחה; מוסיפים לפניו גרש כדי שיוצג כטקסט
const csvSafe = (c: string | number) => (typeof c === 'string' && /^[=+\-@\t\r]/.test(c) ? `'${c}` : String(c));

// הורדת טבלה כקובץ CSV שנפתח באקסל (עם BOM כדי שהעברית תוצג נכון)
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${csvSafe(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
