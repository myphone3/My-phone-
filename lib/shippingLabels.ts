import { BUSINESS } from './business';
import { orderNumber } from './orders';

// טקסט מהלקוח נכנס לדף ה-HTML של המדבקות, לכן מנקים תווים מיוחדים
export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// מספר טלפון ישראלי → קישור וואטסאפ (050-1234567 → 972501234567)
export function waNumber(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

// דף להדפסה: מדבקת משלוח לכל הזמנה, 2 בשורה בדף A4
export function shippingLabelsHtml(orders: any[]) {
  const labels = orders
    .map((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const qty = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0);
      const address = [o.street, o.building].filter(Boolean).join(' ');
      return `
      <div class="label">
        <div class="top"><span>מאת: ${escapeHtml(BUSINESS.name)} · ${escapeHtml(BUSINESS.phone)}</span><span dir="ltr">#${orderNumber(o.id)}</span></div>
        <div class="to">אל:</div>
        <div class="name">${escapeHtml(o.customer_name || '')}</div>
        <div class="addr">${escapeHtml(address || o.address || '')}</div>
        <div class="city">${escapeHtml(o.city || '')}</div>
        <div class="phone" dir="ltr">${escapeHtml(o.phone || o.customer_phone || '')}</div>
        ${o.notes ? `<div class="notes">הערות: ${escapeHtml(o.notes)}</div>` : ''}
        <div class="foot">${qty} פריטים</div>
      </div>`;
    })
    .join('');
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>מדבקות משלוח (${orders.length})</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Arial, sans-serif; margin: 0; padding: 10px; color: #111; }
  .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .bar button { background: #ea580c; color: #fff; border: 0; border-radius: 10px; padding: 10px 18px; font-weight: 800; font-size: 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .label { border: 2px dashed #555; border-radius: 8px; padding: 5mm; min-height: 62mm; break-inside: avoid; display: flex; flex-direction: column; gap: 1.5mm; }
  .top { display: flex; justify-content: space-between; font-size: 11px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 2mm; }
  .to { font-size: 11px; color: #555; margin-top: 1mm; }
  .name { font-size: 20px; font-weight: 900; }
  .addr, .city { font-size: 16px; font-weight: 700; }
  .phone { font-size: 16px; font-weight: 700; text-align: right; }
  .notes { font-size: 12px; background: #fff7ed; border-radius: 4px; padding: 1.5mm; }
  .foot { margin-top: auto; font-size: 11px; color: #555; }
  @media print { .bar { display: none; } body { padding: 0; } }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
</style></head><body>
<div class="bar"><strong>${orders.length} מדבקות משלוח</strong><button onclick="window.print()">הדפסה 🖨️</button></div>
<div class="grid">${labels}</div>
</body></html>`;
}
