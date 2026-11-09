import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailTransport } from '@/lib/mailer';
import { reviewRequestEmail } from '@/lib/orderEmails';
import { BUSINESS } from '@/lib/business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://my-phone-iota.vercel.app';

// משימה יומית (Vercel Cron, בבוקר): ניקוי סטטיסטיקה ישנה, ובקשת ביקורת ללקוחות שההזמנה שלהם נמסרה.
// מוגן באותו CRON_SECRET כמו תזכורת העגלה.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const transport = mailTransport();
  const from = `"NEW PHONE" <${process.env.GMAIL_USER}>`;
  const result = { reviews: 0, failed: 0, errors: [] as string[] };

  // 1) תחזוקה: daily_report מוחק סטטיסטיקה ישנה מ-13 חודשים. הדוח עצמו לא נשלח במייל
  //    (ביקשת לראות את הסיכום בפאנל, במסך סטטיסטיקה ← סיכום).
  const maintenance = await db.rpc('daily_report', { p_secret: secret });
  if (maintenance.error) result.errors.push(maintenance.error.message);

  // 2) בקשות ביקורת
  const due = await db.rpc('claim_review_requests', { p_secret: secret });
  if (due.error) result.errors.push(due.error.message);
  for (const o of (due.data as any[]) || []) {
    const email = reviewRequestEmail({
      name: o.name,
      reviewUrl: `${SITE}/?review=1#reviews`,
      whatsappUrl: `https://wa.me/${BUSINESS.whatsapp}`,
    });
    try {
      await transport.sendMail({ from, to: o.email, subject: email.subject, html: email.html });
      result.reviews++;
    } catch {
      result.failed++;
    }
  }

  return NextResponse.json(result, { status: result.errors.length ? 500 : 200 });
}
