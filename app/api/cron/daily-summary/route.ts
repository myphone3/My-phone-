import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailTransport } from '@/lib/mailer';
import { DailySummary, dailySummaryEmail } from '@/lib/orderEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://my-phone-iota.vercel.app';

// משימה יומית (Vercel Cron): מייל סיכום של אתמול לחנות
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc('daily_summary', { p_secret: secret });
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'No data' }, { status: 500 });
  }
  const email = dailySummaryEmail(data as DailySummary, `${SITE}/admin`);
  await mailTransport().sendMail({
    from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  return NextResponse.json({ sent: true });
}
