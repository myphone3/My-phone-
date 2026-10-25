import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailTransport } from '@/lib/mailer';
import { orderStatusEmail } from '@/lib/orderEmails';
import { Order } from '@/lib/orders';

export const runtime = 'nodejs';

// מייל עדכון סטטוס ללקוח. רק מנהל מחובר: ההזמנה נקראת עם ההתחברות שלו,
// ולפי הרשאות בסיס הנתונים רק מנהל יכול לקרוא הזמנות של לקוחות.
export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: isAdmin } = await db.rpc('is_admin');
    if (isAdmin !== true) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order' }, { status: 400 });
    }
    const { data: order, error } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!order.email) {
      return NextResponse.json({ success: true, skipped: 'no email' });
    }

    // הסטטוס נלקח מההזמנה השמורה, לא מהבקשה
    const email = orderStatusEmail(order as Order, order.status || 'חדש', `${new URL(request.url).origin}/cart?tab=orders`);
    await mailTransport().sendMail({
      from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
      to: order.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Order status email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
