import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import PDFDocument from 'pdfkit';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('id');

  if (!orderId) {
    return new NextResponse('Missing order ID', { status: 400 });
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    return new NextResponse('Order not found', { status: 404 });
  }

  return new Promise<NextResponse>((resolve) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(
          new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="order_${order.id.slice(0, 8)}.pdf"`,
            },
          })
        );
      });

      // כותרת עסק
      doc.fontSize(22).fillColor('#ea580c').text('NEW PHONE', { align: 'right' });
      doc.fontSize(10).fillColor('#4b5563').text('הפלאפון החדש שלך', { align: 'right' });
      doc.moveDown(0.5);

      // פרטי הזמנה
      doc.fontSize(14).fillColor('#111827').text(`סיכום הזמנה #${order.id.slice(0, 8)}`, { align: 'right' });
      doc.fontSize(10).fillColor('#6b7280').text(`תאריך: ${order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : ''}`, { align: 'right' });
      doc.moveDown(1);

      // קו הפרדה
      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#ea580c').lineWidth(2).stroke();
      doc.moveDown(1);

      // פרטי לקוח
      doc.fontSize(12).fillColor('#111827').text('פרטי לקוח למשלוח:', { align: 'right' });
      doc.fontSize(10).fillColor('#374151');
      doc.text(`שם: ${order.customer_name || 'לא צוין'}`, { align: 'right' });
      doc.text(`טלפון: ${order.phone || 'לא צוין'}`, { align: 'right' });
      doc.text(`אימייל: ${order.email || 'לא צוין'}`, { align: 'right' });
      doc.text(`כתובת: עיר: ${order.city || ''}, רחוב: ${order.street || ''} ${order.building || ''}`, { align: 'right' });
      if (order.notes) {
        doc.text(`הערות: ${order.notes}`, { align: 'right' });
      }
      doc.moveDown(1.5);

      // מוצרים
      doc.fontSize(12).fillColor('#111827').text('מוצרים בהזמנה:', { align: 'right' });
      doc.moveDown(0.5);

      const items = order.items || [];
      items.forEach((item: any, index: number) => {
        const colorText = typeof item.selectedColor === 'object' ? item.selectedColor?.name : item.selectedColor;
        const itemTotal = (item.sale_price || item.price || 0) * (item.quantity || 1);
        doc.fontSize(10).fillColor('#1f2937').text(
          `${index + 1}. ${item.name} | כמות: ${item.quantity || 1} | סכום: ${itemTotal} ש"ח ${colorText ? `(צבע: ${colorText})` : ''}`,
          { align: 'right' }
        );
      });

      // משלוח
      doc.fontSize(10).fillColor('#1f2937').text(
        `משלוח מהיר עד הבית | סכום: ${order.shipping_cost || 29} ש"ח`,
        { align: 'right' }
      );

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(1);

      // סה"כ
      doc.fontSize(14).fillColor('#ea580c').text(`סה"כ לתשלום: ${order.total_price || 0} ש"ח`, { align: 'right' });

      doc.end();
    } catch (err) {
      console.error('PDF generation error:', err);
      resolve(new NextResponse('Error generating PDF', { status: 500 }));
    }
  });
}
