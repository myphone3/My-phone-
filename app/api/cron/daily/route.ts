import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailTransport } from '@/lib/mailer';
import { dailyReportEmail, reviewRequestEmail } from '@/lib/orderEmails';
import { BUSINESS } from '@/lib/business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://my-phone-iota.vercel.app';

// משימה יומית (Vercel Cron, בבוקר): 1) דוח יומי במייל למנהלים  2) בקשת ביקורת ללקוחות שההזמנה שלהם נמסרה.
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
  const result = { report: 0, reviews: 0, failed: 0, errors: [] as string[] };

  // 1) דוח יומי
  const report = await db.rpc('daily_report', { p_secret: secret });
  if (report.error) result.errors.push(report.error.message);
  else if (report.data) {
    const recipients: string[] = Array.from(new Set([...((report.data as any).recipients || []), BUSINESS.email].filter(Boolean)));
    const email = dailyReportEmail(report.data, `${SITE}/admin/analytics`);
    try {
      await transport.sendMail({ from, to: recipients.join(', '), subject: email.subject, html: email.html });
      result.report = recipients.length;
    } catch {
      result.failed++;
    }
  }

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
