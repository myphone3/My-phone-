import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// שליחת מיילים מחשבון הג'ימייל של החנות (צד שרת בלבד)

export const LOGO_URL = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

export function mailTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// מסגרת מעוצבת אחידה לכל המיילים של החנות
export function brandedEmail(bodyHtml: string, footer = 'הודעה זו נשלחה אוטומטית ממערכת החנות.') {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; padding: 30px; color: #333; background-color: #f9fafb; border-radius: 16px; text-align: center; max-width: 600px; margin: auto; border: 1px solid #e5e7eb;">
      <div style="margin-bottom: 12px; display: inline-block; background: white; padding: 8px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <img src="${LOGO_URL}" alt="NEW PHONE" style="width: 75px; height: 75px; object-fit: contain; border-radius: 50%; display: block;" />
      </div>
      <h2 style="color: #ea580c; margin: 0; font-size: 24px; font-weight: 900;">NEW PHONE</h2>
      <p style="font-size: 11px; color: #666; margin-top: 4px; font-weight: bold; letter-spacing: 0.5px;">הפלאפון החדש שלך</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; color: #9ca3af;">${footer}</p>
    </div>
  `;
}

// בדיקה שהבקשה הגיעה ממנהל מחובר (לפי ה-token שנשלח בכותרת Authorization)
export async function isAdminRequest(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}
