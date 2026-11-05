import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailTransport } from '@/lib/mailer';
import { abandonedCartEmail, SavedCartItem } from '@/lib/orderEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://my-phone-iota.vercel.app';

// משימה יומית (Vercel Cron): מייל תזכורת לעגלות שלא הושלמו.
// Vercel שולח את CRON_SECRET בכותרת; אותו סוד שמור גם בבסיס הנתונים ונבדק שם.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc('claim_abandoned_carts', { p_secret: secret });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transport = mailTransport();
  let sent = 0;
  let failed = 0;
  for (const cart of (data as any[]) || []) {
    const items: SavedCartItem[] = (Array.isArray(cart.items) ? cart.items : [])
      .filter((i: any) => i && i.name)
      .map((i: any) => ({ name: String(i.name), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, image_url: i.image || i.image_url || null }));
    if (!items.length) continue;
    const email = abandonedCartEmail({
      name: cart.name,
      items,
      cartUrl: `${SITE}/cart`,
      unsubscribeUrl: `${SITE}/unsubscribe?token=${cart.unsubscribe_token}`,
    });
    try {
      await transport.sendMail({
        from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
        to: cart.email,
        subject: email.subject,
        html: email.html,
        headers: { 'List-Unsubscribe': `<${SITE}/unsubscribe?token=${cart.unsubscribe_token}>` },
      });
      sent++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ sent, failed });
}
