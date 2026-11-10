import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { mailTransport } from '@/lib/mailer';
import { buildOrderPdf, PDF_ASSET_PATHS } from '@/lib/orderPdf';
import { newOrderAlertEmail, orderConfirmationEmail } from '@/lib/orderEmails';
import { Order, formatMoney, orderNumber, orderTotals } from '@/lib/orders';
import { pushToAdmins } from '@/lib/push';

export const runtime = 'nodejs';

// מייל אישור הזמנה עם PDF ללקוח (מייל אחד בלבד), ומייל נפרד "הזמנה חדשה" למנהלי החנות.
// הבסיס נתונים מחזיר את ההזמנה רק עם המפתח החד-פעמי שנוצר בעגלה, ורק פעם אחת, כך שאין כפילויות.
// קודם נשלח לחנות עותק מוסתר (BCC) של מייל הלקוח: ג'ימייל לא מתריע על מייל ששלחת לעצמך,
// והעותק נראה כמו מייל כפול. עכשיו המנהלים מקבלים מייל משלהם עם כותרת ברורה.
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

    const origin = new URL(request.url).origin;
    const transport = mailTransport();
    const from = `"NEW PHONE" <${process.env.GMAIL_USER}>`;

    // 1) התראה למנהלים (גם כשאין ללקוח מייל)
    const alert = sendAdminAlert(order, origin, transport, from);
    // 2) התראה לטלפון (למנהלים שהפעילו "התראות לטלפון" בפאנל)
    const push = pushToAdmins({
      title: `🛍️ הזמנה חדשה · ${formatMoney(orderTotals(order).total)}`,
      body: `${order.customer_name || 'לקוח'} · הזמנה #${orderNumber(order.id)}`,
      url: `/admin/orders?q=${orderNumber(order.id)}`,
      tag: order.id,
    }).catch((err) => console.error('Push failed:', err));

    // 3) מייל ללקוח
    if (order.email) {
      const publicDir = path.join(process.cwd(), 'public');
      // הלוגו לא חובה: אם אין, ה-PDF מציג כותרת טקסט
      const [regular, bold, logo] = await Promise.all([
        readFile(path.join(publicDir, PDF_ASSET_PATHS.regular)),
        readFile(path.join(publicDir, PDF_ASSET_PATHS.bold)),
        readFile(path.join(publicDir, PDF_ASSET_PATHS.logo)).catch(() => undefined),
      ]);
      const pdf = await buildOrderPdf(order, { regular, bold, logo });
      const email = orderConfirmationEmail(order, `${origin}/cart?tab=orders`);
      await transport.sendMail({
        from,
        to: order.email,
        replyTo: process.env.GMAIL_USER,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: [{ filename: `order-${orderNumber(order.id)}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
      });
    }

    await Promise.all([alert, push]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Order confirmation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// מייל "הזמנה חדשה" לכל המנהלים (לפי רשימת המנהלים בבסיס הנתונים), ואם אין, לחשבון החנות.
// כתובות נוספות אפשר להוסיף ב-Vercel במשתנה ORDER_ALERT_EMAILS (מופרדות בפסיק).
async function sendAdminAlert(order: Order, origin: string, transport: ReturnType<typeof mailTransport>, from: string) {
  try {
    const to = new Set<string>();
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const { data } = await supabase.rpc('order_alert_recipients', { p_secret: secret });
      for (const e of (data as string[]) || []) if (e) to.add(String(e).toLowerCase());
    }
    for (const e of String(process.env.ORDER_ALERT_EMAILS || '').split(',')) if (e.trim()) to.add(e.trim().toLowerCase());
    if (!to.size && process.env.GMAIL_USER) to.add(process.env.GMAIL_USER);
    const mail = newOrderAlertEmail(order, `${origin}/admin/orders?q=${orderNumber(order.id)}`);
    await transport.sendMail({
      from,
      to: Array.from(to).join(', '),
      replyTo: order.email || undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: { 'X-Priority': '1', Importance: 'high' },
    });
  } catch (err) {
    console.error('New order alert failed:', err);
  }
}
