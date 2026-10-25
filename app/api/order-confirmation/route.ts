import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { mailTransport } from '@/lib/mailer';
import { buildOrderPdf, PDF_ASSET_PATHS } from '@/lib/orderPdf';
import { orderConfirmationEmail } from '@/lib/orderEmails';
import { Order, orderNumber } from '@/lib/orders';

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
    // הלוגו לא חובה: אם אין, ה-PDF מציג כותרת טקסט
    const [regular, bold, logo] = await Promise.all([
      readFile(path.join(publicDir, PDF_ASSET_PATHS.regular)),
      readFile(path.join(publicDir, PDF_ASSET_PATHS.bold)),
      readFile(path.join(publicDir, PDF_ASSET_PATHS.logo)).catch(() => undefined),
    ]);
    const pdf = await buildOrderPdf(order, { regular, bold, logo });

    const ordersUrl = `${new URL(request.url).origin}/cart?tab=orders`;
    const email = orderConfirmationEmail(order, ordersUrl);

    await mailTransport().sendMail({
      from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
      to: order.email,
      bcc: process.env.GMAIL_USER,
      subject: email.subject,
      text: email.text,
      html: email.html,
      attachments: [{ filename: `order-${orderNumber(order.id)}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Order confirmation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
