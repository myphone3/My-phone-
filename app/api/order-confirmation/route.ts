import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { brandedEmail, escapeHtml, mailTransport } from '@/lib/mailer';
import { buildOrderPdf, PDF_ASSET_PATHS } from '@/lib/orderPdf';
import { Order, formatMoney, orderItems, orderNumber, orderTotals } from '@/lib/orders';

export const runtime = 'nodejs';

// מייל אישור הזמנה עם PDF, ללקוח ועותק לחנות.
// הבסיס נתונים מחזיר את ההזמנה רק עם המפתח החד-פעמי שנוצר בעגלה, ורק פעם אחת.
export async function POST(request: Request) {
  try {
    const { orderId, token } = await request.json();
    if (!orderId || !token) {
      return NextResponse.json({ error: 'Missing order' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('claim_order_for_email', { p_id: orderId, p_token: token });
    if (error || !data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const order = data as Order;
    if (!order.email) {
      return NextResponse.json({ success: true, skipped: 'no email' });
    }

    const publicDir = path.join(process.cwd(), 'public');
    const [regular, bold, logo] = await Promise.all(
      [PDF_ASSET_PATHS.regular, PDF_ASSET_PATHS.bold, PDF_ASSET_PATHS.logo].map((p) => readFile(path.join(publicDir, p)))
    );
    const pdf = await buildOrderPdf(order, { regular, bold, logo });

    const number = orderNumber(order.id);
    const totals = orderTotals(order);
    const rows = orderItems(order)
      .map(
        (item) => `<tr>
          <td style="padding: 6px 0; text-align: right;">${escapeHtml(item.name)} × ${item.qty}</td>
          <td style="padding: 6px 0; text-align: left; white-space: nowrap;">${item.gift ? `${item.original > 0 ? `<span style="text-decoration: line-through; color: #9ca3af; font-size: 12px; margin-left: 6px;">${formatMoney(item.original)}</span>` : ''}<span style="color: #16a34a; font-weight: bold;">חינם</span>` : formatMoney(item.total)}</td>
        </tr>`
      )
      .join('');
    const sumRow = (label: string, value: string, strong = false) =>
      `<tr><td style="padding: 6px 0; text-align: right;${strong ? ' font-weight: 900; color: #ea580c; font-size: 16px;' : ''}">${label}</td>
       <td style="padding: 6px 0; text-align: left;${strong ? ' font-weight: 900; color: #ea580c; font-size: 16px;' : ''}">${value}</td></tr>`;

    const ordersUrl = `${new URL(request.url).origin}/cart?tab=orders`;
    const firstName = escapeHtml((order.customer_name || '').trim().split(/\s+/)[0] || 'לקוח יקר');

    const html = brandedEmail(`
      <p style="font-size: 16px; line-height: 1.7; color: #1f2937; margin: 0 0 6px;">שלום ${firstName}, תודה על הקנייה! 🧡</p>
      <p style="font-size: 15px; line-height: 1.7; color: #1f2937; margin: 0 0 16px;">ההזמנה שלך התקבלה והתשלום בוצע בהצלחה.</p>
      <div style="display: inline-block; background: #fff7ed; border: 1px dashed #fdba74; color: #c2410c; font-weight: 900; border-radius: 12px; padding: 8px 14px; font-size: 14px; margin-bottom: 16px;">מספר הזמנה: #${number}</div>
      <table dir="rtl" style="width: 100%; border-collapse: collapse; font-size: 14px; background: #ffffff; border-radius: 12px; padding: 12px; color: #1f2937;">
        ${rows}
        <tr><td colspan="2" style="border-top: 1px solid #e5e7eb;"></td></tr>
        ${totals.discount > 0 ? sumRow('הנחה', `-${formatMoney(totals.discount)}`) : ''}
        ${sumRow('משלוח', totals.shipping > 0 ? formatMoney(totals.shipping) : 'חינם')}
        ${sumRow('סה״כ', formatMoney(totals.total), true)}
      </table>
      <p style="font-size: 13px; color: #4b5563; margin: 16px 0;">סיכום ההזמנה מצורף כקובץ PDF.</p>
      <a href="${ordersUrl}" style="display: inline-block; background: #ea580c; color: #ffffff; text-decoration: none; font-weight: 900; padding: 12px 24px; border-radius: 12px; font-size: 14px;">צפייה בהזמנה באתר</a>
    `);

    await mailTransport().sendMail({
      from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
      to: order.email,
      bcc: process.env.GMAIL_USER,
      subject: `אישור הזמנה #${number} - NEW PHONE`,
      text: `שלום ${order.customer_name || ''}, ההזמנה שלך #${number} התקבלה והתשלום בוצע בהצלחה. סה"כ: ${formatMoney(totals.total)}. סיכום ההזמנה מצורף כקובץ PDF.`,
      html,
      attachments: [{ filename: `order-${number}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Order confirmation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
