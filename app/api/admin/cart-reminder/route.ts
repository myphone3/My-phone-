import { NextResponse } from 'next/server';
import { adminDb, mailTransport } from '@/lib/mailer';
import { abandonedCartEmail, SavedCartItem } from '@/lib/orderEmails';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "שליחת תזכורת עכשיו" לעגלה אחת, מתוך מסך לקוחות ומיילים בפאנל.
// בסיס הנתונים בודק שהשולח מנהל ושהלקוח אישר מבצעים במייל.
export async function POST(request: Request) {
  const db = await adminDb(request);
  if (!db) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = await request.json().catch(() => ({}));
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { data, error } = await db.rpc('admin_cart_for_reminder', { p_user_id: userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const cart = Array.isArray(data) ? data[0] : null;
  if (!cart) return NextResponse.json({ error: 'הלקוח לא אישר מבצעים במייל, או שהעגלה ריקה' }, { status: 409 });

  const items: SavedCartItem[] = (Array.isArray(cart.items) ? cart.items : [])
    .filter((i: any) => i && i.name)
    .map((i: any) => ({ name: String(i.name), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, image_url: i.image || i.image_url || null }));
  const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${cart.unsubscribe_token}`;
  const email = abandonedCartEmail({ name: cart.name, items, cartUrl: `${SITE_URL}/cart`, unsubscribeUrl });

  try {
    await mailTransport().sendMail({
      from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
      to: cart.email,
      subject: email.subject,
      html: email.html,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'שליחת המייל נכשלה: ' + (e?.message || '') }, { status: 502 });
  }
  await db.from('email_log').insert({ kind: 'cart', subject: email.subject, recipients: 1, failed: 0 });
  return NextResponse.json({ sent: 1 });
}
