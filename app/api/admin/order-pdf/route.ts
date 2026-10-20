import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');

    if (!orderId) {
      return new NextResponse('Missing order ID', { status: 400 });
    }

    // שליפת פרטי ההזמנה מ-Supabase
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return new NextResponse('Order not found', { status: 404 });
    }

    const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

    const itemsRows = (order.items || []).map((item: any, idx: number) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: center; font-weight: bold; width: 40px;">${idx + 1}</td>
        <td style="padding: 12px; font-weight: bold;">
          ${item.name || 'מוצר'}
          ${item.selectedVariant ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">גרסה: ${item.selectedVariant}</div>` : ''}
          ${item.selectedColor ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">צבע: ${item.selectedColor.name || item.selectedColor}</div>` : ''}
        </td>
        <td style="padding: 12px; text-align: center; font-weight: bold; width: 60px;">${item.quantity || 1}</td>
        <td style="padding: 12px; text-align: left; font-weight: bold; width: 80px;">₪${(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>סיכום הזמנה #${order.id?.slice(0, 8)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #111827; direction: rtl; margin: 0; background-color: #ffffff; }
          .container { max-width: 650px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 16px; margin-bottom: 20px; }
          .logo-box { display: flex; align-items: center; gap: 12px; }
          .logo-img { width: 50px; height: 50px; object-fit: contain; border-radius: 50%; }
          .store-title { font-size: 20px; font-weight: 900; color: #111827; }
          .store-sub { font-size: 11px; color: #ea580c; font-weight: bold; }
          .details-card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          th { background-color: #ea580c; color: #ffffff; padding: 10px; text-align: right; }
          .total-card { margin-top: 20px; text-align: left; font-size: 18px; font-weight: 900; color: #ea580c; border-top: 2px solid #e5e7eb; padding-top: 14px; }
          
          @media print {
            body { padding: 0; }
            .container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-box">
              <img src="${logoUrl}" alt="NEW PHONE" class="logo-img" />
              <div>
                <div class="store-title">NEW PHONE</div>
                <div class="store-sub">הפלאפון החדש שלך</div>
              </div>
            </div>
            <div style="text-align: left;">
              <div style="font-size: 14px; font-weight: 900; color: #ea580c;">סיכום הזמנה</div>
              <div style="font-size: 12px; font-weight: bold;">#${order.id?.slice(0, 8)}</div>
              <div style="font-size: 10px; color: #6b7280;">${order.created_at ? new Date(order.created_at).toLocaleString('he-IL') : ''}</div>
            </div>
          </div>

          <div class="details-card">
            <strong>פרטי לקוח למשלוח:</strong><br>
            שם: <strong>${order.customer_name || 'לא צוין'}</strong><br>
            טלפון: ${order.phone || 'לא צוין'}<br>
            אימייל: ${order.email || 'לא צוין'}<br>
            כתובת: עיר: ${order.city || ''}, רחוב: ${order.street || ''} ${order.building || ''}<br>
            ${order.notes ? `<div style="margin-top:6px; color:#c2410c;"><strong>הערות לקוח:</strong> ${order.notes}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>תיאור פריט</th>
                <th style="width: 60px; text-align: center;">כמות</th>
                <th style="width: 80px; text-align: left;">סכום</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
              <tr style="border-bottom: 1px solid #e5e7eb; background-color: #fff7ed;">
                <td style="padding: 12px; text-align: center; font-weight: bold;">${(order.items || []).length + 1}</td>
                <td style="padding: 12px; font-weight: bold;">משלוח מהיר עד הבית</td>
                <td style="padding: 12px; text-align: center; font-weight: bold;">1</td>
                <td style="padding: 12px; text-align: left; font-weight: bold;">₪${order.shipping_cost || 29}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-card">
            סה"כ לתשלום: ₪${order.total_price || 0}
          </div>
        </div>

        <script>
          // הפעלת מנגנון ההדפסה/שמירה כ-PDF של הדפדפן מיד עם תום הטעינה
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    return new NextResponse(`Server error: ${err.message}`, { status: 500 });
  }
}
