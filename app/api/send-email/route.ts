import { NextResponse } from 'next/server';
import { brandedEmail, escapeHtml, isAdminRequest, mailTransport } from '@/lib/mailer';

export async function POST(request: Request) {
  try {
    // רק מנהל מחובר יכול לשלוח מיילים דרך החנות
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, message } = await request.json();

    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await mailTransport().sendMail({
      from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: subject,
      text: message,
      html: brandedEmail(
        `<p style="white-space: pre-line; font-size: 15px; line-height: 1.7; text-align: right; color: #1f2937;">${escapeHtml(message)}</p>`,
        'הודעה זו נשלחה אוטומטית ממערכת ניהול החנות.'
      ),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Gmail API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
