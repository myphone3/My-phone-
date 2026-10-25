import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import { Order, orderItems, orderNumber, orderTotals, formatDate, formatMoney } from './orders';

// יצירת קובץ PDF של סיכום הזמנה (עובד גם בשרת וגם בדפדפן)

const bidi = bidiFactory();

const ORANGE = rgb(0.918, 0.345, 0.047);
const DARK = rgb(0.067, 0.094, 0.153);
const GRAY = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(1, 0.969, 0.929);
const LINE = rgb(0.9, 0.91, 0.92);
const GREEN = rgb(0.086, 0.639, 0.29);

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;

// pdf-lib כותב משמאל לימין, לכן ממירים כל שורה לסדר תצוגה (עברית, מספרים ואנגלית מעורבים)
function visual(text: string) {
  // תווים שאין בגופן (אימוג'י וכו') מוסרים
  const clean = Array.from(text).filter((ch) => (ch.codePointAt(0) || 0) <= 0xffff && !/[☀-➿️]/.test(ch)).join('');
  const levels = bidi.getEmbeddingLevels(clean, 'rtl');
  const chars = clean.split('');
  bidi.getMirroredCharactersMap(clean, levels.levels).forEach((mirrored: string, i: number) => {
    chars[i] = mirrored;
  });
  for (const [start, end] of bidi.getReorderSegments(clean, levels)) {
    const reversed = chars.slice(start, end + 1).reverse();
    chars.splice(start, end - start + 1, ...reversed);
  }
  return chars.join('');
}

// fontkit הופך בעצמו רצף עברי, לכן אותיות עבריות נכתבות אחת-אחת ושאר הטקסט ברצפים
const HEBREW = /[֐-׿יִ-ﭏ]/;

function runs(visualText: string) {
  const out: string[] = [];
  let buf = '';
  for (const ch of visualText) {
    if (HEBREW.test(ch)) {
      if (buf) out.push(buf);
      buf = '';
      out.push(ch);
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function textWidth(text: string, font: PDFFont, size: number) {
  return runs(visual(text)).reduce((sum, run) => sum + font.widthOfTextAtSize(run, size), 0);
}

// חלוקת טקסט לשורות לפי רוחב
function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, font, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

type PdfAssets = { regular: ArrayBuffer | Uint8Array; bold: ArrayBuffer | Uint8Array; logo?: ArrayBuffer | Uint8Array };

export async function buildOrderPdf(order: Order, assets: PdfAssets) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(assets.regular, { subset: true });
  const bold = await pdf.embedFont(assets.bold, { subset: true });
  const logo = assets.logo ? await pdf.embedJpg(assets.logo) : null;
  pdf.setTitle(`הזמנה ${orderNumber(order.id)}`);
  pdf.setAuthor('NEW PHONE');

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const draw = (text: string, x: number, yy: number, size: number, font: PDFFont, color: typeof DARK) => {
    let cursor = x;
    for (const run of runs(visual(text))) {
      page.drawText(run, { x: cursor, y: yy, size, font, color });
      cursor += font.widthOfTextAtSize(run, size);
    }
  };
  const right = (text: string, x: number, yy: number, size: number, font = regular, color = DARK) => {
    draw(text, x - textWidth(text, font, size), yy, size, font, color);
  };
  const left = (text: string, x: number, yy: number, size: number, font = regular, color = DARK) => {
    draw(text, x, yy, size, font, color);
  };
  const center = (text: string, yy: number, size: number, font = regular, color = DARK) => {
    draw(text, (PAGE_W - textWidth(text, font, size)) / 2, yy, size, font, color);
  };
  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN + 40) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // כותרת: לוגו מימין, פרטי ההזמנה משמאל
  const logoH = 70;
  if (logo) {
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, { x: PAGE_W - MARGIN - logoW, y: y - logoH, width: logoW, height: logoH });
  } else {
    right('NEW PHONE', PAGE_W - MARGIN, y - 18, 24, bold, ORANGE);
    right('הפלאפון החדש שלך', PAGE_W - MARGIN, y - 34, 10, regular, GRAY);
  }
  left('סיכום הזמנה', MARGIN, y - 20, 14, bold);
  left(`#${orderNumber(order.id)}`, MARGIN, y - 38, 11);
  left(formatDate(order.created_at, true), MARGIN, y - 54, 10, regular, GRAY);
  y -= logoH + 10;
  page.drawRectangle({ x: MARGIN, y, width: PAGE_W - MARGIN * 2, height: 3, color: ORANGE });
  y -= 26;

  // פרטי לקוח
  right('פרטי הלקוח', PAGE_W - MARGIN, y, 12, bold);
  y -= 18;
  const phone = order.phone || order.customer_phone || '';
  const contact = [order.customer_name, phone, order.email].filter(Boolean).join('  ·  ');
  if (contact) {
    right(contact, PAGE_W - MARGIN, y, 10);
    y -= 15;
  }
  const address = order.address || order.customer_address || '';
  for (const line of wrap(address, regular, 10, PAGE_W - MARGIN * 2)) {
    right(line, PAGE_W - MARGIN, y, 10);
    y -= 15;
  }
  if (order.notes) {
    for (const line of wrap(`הערות: ${order.notes}`, regular, 10, PAGE_W - MARGIN * 2)) {
      right(line, PAGE_W - MARGIN, y, 10, regular, GRAY);
      y -= 15;
    }
  }
  y -= 12;

  // טבלת מוצרים: מוצר (ימין) | כמות | מחיר | סה"כ (שמאל)
  const colName = PAGE_W - MARGIN - 8;
  const colQty = 230;
  const colUnit = 160;
  const colTotal = MARGIN + 8;
  const nameWidth = colName - colQty - 20;

  page.drawRectangle({ x: MARGIN, y: y - 8, width: PAGE_W - MARGIN * 2, height: 24, color: LIGHT });
  right('מוצר', colName, y, 10, bold, ORANGE);
  right('כמות', colQty, y, 10, bold, ORANGE);
  right('מחיר', colUnit, y, 10, bold, ORANGE);
  left('סה"כ', colTotal, y, 10, bold, ORANGE);
  y -= 26;

  for (const item of orderItems(order)) {
    const lines = wrap(item.name, regular, 10, nameWidth);
    newPageIfNeeded(lines.length * 14 + 12);
    lines.forEach((line, i) => right(line, colName, y - i * 14, 10));
    right(String(item.qty), colQty, y, 10);
    if (item.gift) {
      // מחיר מקורי מחוק ו"חינם"
      if (item.original > 0) {
        const orig = formatMoney(item.original);
        const w = textWidth(orig, regular, 10);
        right(orig, colUnit, y, 10, regular, GRAY);
        page.drawLine({ start: { x: colUnit - w, y: y + 3.5 }, end: { x: colUnit, y: y + 3.5 }, thickness: 0.8, color: GRAY });
      }
      left('חינם', colTotal, y, 10, bold, GREEN);
    } else {
      right(formatMoney(item.unit), colUnit, y, 10);
      left(formatMoney(item.total), colTotal, y, 10);
    }
    y -= lines.length * 14 + 6;
    page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.5, color: LINE });
    y -= 10;
  }

  // סכומים
  newPageIfNeeded(110);
  const totals = orderTotals(order);
  const sumRow = (label: string, value: string, font = regular, size = 10, color = DARK) => {
    right(label, colQty, y, size, font, color);
    left(value, colTotal, y, size, font, color);
    y -= size + 8;
  };
  y -= 4;
  sumRow('סכום ביניים', formatMoney(totals.subtotal));
  if (totals.discount > 0) sumRow('הנחה', `-${formatMoney(totals.discount)}`);
  sumRow('משלוח', totals.shipping > 0 ? formatMoney(totals.shipping) : 'חינם');
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: colQty, y: y + 12 }, thickness: 1, color: LINE });
  sumRow('סה"כ לתשלום', formatMoney(totals.total), bold, 14, ORANGE);

  // תחתית בכל עמוד
  for (const p of pdf.getPages()) {
    page = p;
    center('מסמך זה הוא סיכום הזמנה ואינו חשבונית מס.', MARGIN, 9, regular, GRAY);
    center('NEW PHONE · תודה שקנית אצלנו!', MARGIN - 13, 9, regular, GRAY);
  }

  return pdf.save();
}

// הקבצים שה-PDF צריך: גופנים ולוגו (מתוך public)
export const PDF_ASSET_PATHS = { regular: 'fonts/Heebo-Regular.ttf', bold: 'fonts/Heebo-Bold.ttf', logo: 'Logo.JPG' };

// טעינה בדפדפן
export async function loadPdfAssets() {
  const [regular, bold, logo] = await Promise.all(
    [PDF_ASSET_PATHS.regular, PDF_ASSET_PATHS.bold, PDF_ASSET_PATHS.logo].map(async (path) => {
      const res = await fetch(`/${path}`);
      if (!res.ok) throw new Error(`Asset load failed: ${path}`);
      return res.arrayBuffer();
    })
  );
  return { regular, bold, logo };
}
