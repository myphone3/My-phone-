import { NextResponse } from 'next/server';
import { adminDb, mailTransport } from '@/lib/mailer';
import { campaignEmail } from '@/lib/orderEmails';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_RECIPIENTS = 300;

// מייל מבצעים/עדכון מהפאנל. נשלח רק ללקוחות שאישרו מבצעים במייל (הרשימה מגיעה מבסיס הנתונים),
// כל לקוח מקבל מייל אישי משלו עם קישור הסרה. test=true שולח רק עותק לתיבת החנות.
export async function POST(request: Request) {
  const db = await adminDb(request);
  if (!db) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const subject = String(body.subject || '').trim().slice(0, 150);
  const message = String(body.message || '').trim().slice(0, 5000);
  const buttonText = String(body.buttonText || '').trim().slice(0, 40);
  const rawUrl = String(body.buttonUrl || '').trim();
  const buttonUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : rawUrl.startsWith('/') ? SITE_URL + rawUrl : '';
  const test = body.test === true;
  const userIds: string[] | null = Array.isArray(body.userIds) ? body.userIds.filter((x: any) => typeof x === 'string').slice(0, 1000) : null;
  if (!subject || !message) return NextResponse.json({ error: 'חסר נושא או תוכן' }, { status: 400 });

  const transport = mailTransport();
  const from = `"NEW PHONE" <${process.env.GMAIL_USER}>`;

  if (test) {
    const email = campaignEmail({ name: 'NEW PHONE', subject, message, buttonText, buttonUrl, unsubscribeUrl: `${SITE_URL}/unsubscribe` });
    try {
      await transport.sendMail({ from, to: process.env.GMAIL_USER, subject: `[ניסיון] ${email.subject}`, html: email.html });
    } catch (e: any) {
      return NextResponse.json({ error: 'שליחת הניסיון נכשלה: ' + (e?.message || '') }, { status: 502 });
    }
    return NextResponse.json({ sent: 1, test: true });
  }

  const { data, error } = await db.rpc('admin_marketing_recipients', { p_user_ids: userIds && userIds.length ? userIds : null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const recipients = ((data as any[]) || []).slice(0, MAX_RECIPIENTS);
  if (!recipients.length) return NextResponse.json({ error: 'אין נמענים שאישרו קבלת מבצעים במייל' }, { status: 409 });

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${r.unsubscribe_token}`;
    const email = campaignEmail({ name: r.name, subject, message, buttonText, buttonUrl, unsubscribeUrl });
    try {
      await transport.sendMail({ from, to: r.email, subject: email.subject, html: email.html, headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } });
      sent++;
    } catch {
      failed++;
    }
  }
  await db.from('email_log').insert({ kind: 'campaign', subject, recipients: sent, failed });
  return NextResponse.json({ sent, failed, capped: ((data as any[]) || []).length > MAX_RECIPIENTS });
}
