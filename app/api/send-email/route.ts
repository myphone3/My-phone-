import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, subject, message } = await request.json();

    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'NEW PHONE <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      text: message,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 25px; color: #333; background-color: #f9fafb; border-radius: 12px;">
          <h2 style="color: #ea580c; margin-bottom: 5px;">NEW PHONE</h2>
          <p style="font-size: 12px; color: #666; margin-top: 0;">חנות סלולר ואביזרים מתקדמים</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="white-space: pre-line; font-size: 15px; line-height: 1.6;">${message}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af;">הודעה זו נשלחה אוטומטית ממערכת ניהול החנות.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
