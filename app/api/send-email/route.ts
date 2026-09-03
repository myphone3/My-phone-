import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { to, subject, message } = await request.json();

    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const domain = process.env.VERCEL_URL || 'my-phone-iota.vercel.app';
    const logoUrl = `https://${domain}/logo.png`;

    await transporter.sendMail({
      from: `"NEW PHONE" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: subject,
      text: message,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 30px; color: #333; background-color: #f9fafb; border-radius: 16px; text-align: center; max-width: 600px; margin: auto; border: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="NEW PHONE" style="width: 80px; height: 80px; object-fit: contain; border-radius: 50%; margin-bottom: 10px;" />
          <h2 style="color: #ea580c; margin: 0; font-size: 24px; font-weight: 900;">NEW PHONE</h2>
          <p style="font-size: 11px; color: #666; margin-top: 4px; font-weight: bold; letter-spacing: 0.5px;">הפלאפון החדש שלך</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="white-space: pre-line; font-size: 15px; line-height: 1.7; text-align: right; color: #1f2937;">${message}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af;">הודעה זו נשלחה אוטומטית ממערכת ניהול החנות.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Gmail API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
