import { LOGO_URL, escapeHtml } from './mailer';
import { ORDER_STEPS, Order, formatMoney, orderItems, orderNumber, orderStepIndex, orderTotals } from './orders';

// תבניות המיילים ללקוח: אישור הזמנה ועדכון סטטוס (עיצוב אחיד)

const ORANGE = '#ea580c';

function layout(opts: { title: string; subtitle: string; body: string }) {
  return `
  <div dir="rtl" style="background:#f3f4f6; padding:24px 12px; font-family:Arial, sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb;">
      <div style="background:${ORANGE}; background-image:linear-gradient(135deg,#fb923c,${ORANGE}); color:#ffffff; text-align:center; padding:24px 16px 20px;">
        <img src="${LOGO_URL}" alt="NEW PHONE" width="68" height="68" style="width:68px; height:68px; border-radius:50%; background:#ffffff; object-fit:contain; display:block; margin:0 auto 10px;" />
        <div style="font-size:22px; font-weight:900; margin:0;">${opts.title}</div>
        <div style="font-size:13px; margin-top:4px; opacity:.95;">${opts.subtitle}</div>
      </div>
      <div style="padding:22px 20px; font-size:14px; line-height:1.75; color:#1f2937; text-align:right;">
        ${opts.body}
      </div>
      <div style="background:#f9fafb; text-align:center; font-size:11px; color:#6b7280; padding:14px 16px; line-height:1.8;">
        יש שאלה? פשוט השיבו למייל הזה ונחזור אליכם בהקדם.<br /><b>NEW PHONE</b> · הפלאפון החדש שלך
      </div>
    </div>
  </div>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:block; text-align:center; background:${ORANGE}; color:#ffffff; font-weight:900; padding:13px; border-radius:12px; text-decoration:none; margin:18px 0 6px;">${label}</a>`;
}

function firstName(order: Order) {
  return escapeHtml((order.customer_name || '').trim().split(/\s+/)[0] || 'לקוח יקר');
}

function itemsTable(order: Order) {
  const totals = orderTotals(order);
  const cell = 'padding:8px 0; border-bottom:1px solid #f3f4f6;';
  const rows = orderItems(order)
    .map((item) => {
      const price = item.gift
        ? `${item.original > 0 ? `<span style="text-decoration:line-through; color:#9ca3af; font-size:11px; margin-left:4px;">${formatMoney(item.original)}</span>` : ''}<span style="color:#16a34a; font-weight:bold;">חינם</span>`
        : formatMoney(item.total);
      return `<tr><td style="${cell}">${item.gift ? '🎁 ' : ''}${escapeHtml(item.name)} × ${item.qty}</td><td style="${cell} text-align:left; white-space:nowrap;">${price}</td></tr>`;
    })
    .join('');
  const row = (label: string, value: string) =>
    `<tr><td style="${cell}">${label}</td><td style="${cell} text-align:left; white-space:nowrap;">${value}</td></tr>`;
  return `
    <table dir="rtl" style="width:100%; border-collapse:collapse; font-size:13px; margin:14px 0;">
      ${rows}
      ${totals.discount > 0 ? row('הנחה', `-${formatMoney(totals.discount)}`) : ''}
      ${row('משלוח', totals.shipping > 0 ? formatMoney(totals.shipping) : 'חינם')}
      <tr><td style="padding:10px 0 0; font-weight:900; color:${ORANGE}; font-size:15px;">סה״כ</td><td style="padding:10px 0 0; font-weight:900; color:${ORANGE}; font-size:15px; text-align:left;">${formatMoney(totals.total)}</td></tr>
    </table>`;
}

function addressBox(order: Order) {
  const contact = [order.customer_name, order.phone || order.customer_phone].filter(Boolean).map(escapeHtml).join(' · ');
  const address = escapeHtml(order.address || order.customer_address || '');
  return `<div style="background:#f9fafb; border-radius:12px; padding:10px 12px; font-size:13px; margin:12px 0;"><b>כתובת למשלוח</b><br />${contact}<br />${address}</div>`;
}

// פס התקדמות בטבלה (נתמך גם ב-Gmail וב-Outlook)
function statusTrack(status?: string | null) {
  const current = orderStepIndex(status);
  const cells = ORDER_STEPS.map((step, i) => {
    const on = i <= current;
    return `<td style="text-align:center; width:25%; padding:0 2px;">
      <div style="height:6px; border-radius:6px; background:${on ? ORANGE : '#e5e7eb'};"></div>
      <div style="font-size:11px; margin-top:6px; color:${i === current ? '#c2410c' : '#6b7280'}; font-weight:${i === current ? '900' : 'normal'};">${on ? '✓ ' : ''}${step}</div>
    </td>`;
  }).join('');
  return `<table dir="rtl" style="width:100%; border-collapse:collapse; margin:16px 0 6px;"><tr>${cells}</tr></table>`;
}

export function orderConfirmationEmail(order: Order, ordersUrl: string) {
  const number = orderNumber(order.id);
  return {
    subject: `✅ ההזמנה שלך התקבלה – מספר ${number} | NEW PHONE`,
    html: layout({
      title: 'תודה על ההזמנה!',
      subtitle: 'ההזמנה שלך התקבלה והתשלום בוצע בהצלחה',
      body: `
        <p style="margin:0 0 12px;">שלום ${firstName(order)},</p>
        <p style="margin:0 0 14px;">תודה שבחרת ב-NEW PHONE. קיבלנו את ההזמנה שלך, והיא כבר בדרך לטיפול הצוות שלנו. ברגע שההזמנה תצא למשלוח, נעדכן אותך במייל.</p>
        <span style="display:inline-block; background:#fff7ed; border:1px dashed #fdba74; color:#c2410c; font-weight:900; border-radius:10px; padding:6px 12px; font-size:13px;">מספר הזמנה: #${number}</span>
        ${itemsTable(order)}
        ${addressBox(order)}
        ${button(ordersUrl, 'צפייה בהזמנה שלי')}
        <p style="font-size:12px; color:#6b7280; margin:0;">📎 סיכום ההזמנה מצורף כקובץ PDF.</p>`,
    }),
    text: `שלום ${order.customer_name || ''}, תודה על ההזמנה! ההזמנה שלך (#${number}) התקבלה והתשלום בוצע בהצלחה. סה"כ: ${formatMoney(orderTotals(order).total)}. סיכום ההזמנה מצורף כקובץ PDF. לצפייה בהזמנה: ${ordersUrl}`,
  };
}

// ניסוח לכל סטטוס
const STATUS_COPY: Record<string, { icon: string; title: string; subject: string; text: string }> = {
  'בטיפול': { icon: '⏳', title: 'ההזמנה שלך בטיפול', subject: 'ההזמנה שלך בטיפול', text: 'ההזמנה שלך בטיפול. הצוות שלנו מכין אותה עבורך, ונעדכן אותך ברגע שתצא למשלוח.' },
  'מחכה למשלוח': { icon: '📦', title: 'ההזמנה ארוזה ומוכנה', subject: 'ההזמנה שלך ארוזה ומוכנה', text: 'ההזמנה שלך ארוזה ומוכנה, וממתינה לאיסוף השליח.' },
  'מוכן לאיסוף': { icon: '🛍️', title: 'ההזמנה מוכנה לאיסוף', subject: 'ההזמנה שלך מוכנה לאיסוף', text: 'ההזמנה שלך מוכנה לאיסוף. נשמח לראות אותך!' },
  'נשלח': { icon: '🚚', title: 'ההזמנה שלך בדרך!', subject: 'ההזמנה שלך בדרך אליך', text: 'שמחים לעדכן שההזמנה שלך יצאה למשלוח ונמצאת בדרך אליך. השליח ייצור איתך קשר לפני ההגעה.' },
  'הושלם': { icon: '✅', title: 'ההזמנה נמסרה', subject: 'ההזמנה שלך נמסרה', text: 'ההזמנה שלך נמסרה. תודה שקנית אצלנו, נשמח לראות אותך שוב!' },
  'מבוטל': { icon: '❌', title: 'ההזמנה בוטלה', subject: 'ההזמנה שלך בוטלה', text: 'ההזמנה שלך בוטלה. אם לא ביקשת זאת, או שיש לך שאלה, פשוט השיבו למייל הזה.' },
  'חדש': { icon: '🆕', title: 'ההזמנה שלך התקבלה', subject: 'ההזמנה שלך התקבלה', text: 'ההזמנה שלך התקבלה ונמצאת אצלנו. נעדכן אותך בכל שלב.' },
};

export function orderStatusEmail(order: Order, status: string, ordersUrl: string) {
  const number = orderNumber(order.id);
  const copy = STATUS_COPY[status] || { icon: '🔔', title: 'עדכון בהזמנה שלך', subject: 'עדכון בהזמנה שלך', text: `ההזמנה שלך עודכנה לסטטוס: ${escapeHtml(status)}.` };
  return {
    subject: `${copy.icon} ${copy.subject} – מספר ${number} | NEW PHONE`,
    html: layout({
      title: `${copy.title} ${copy.icon}`,
      subtitle: `הזמנה מספר #${number}`,
      body: `
        <p style="margin:0 0 12px;">שלום ${firstName(order)},</p>
        <p style="margin:0 0 6px;">${copy.text}</p>
        ${status === 'מבוטל' ? '' : statusTrack(status)}
        ${button(ordersUrl, 'מעקב אחרי ההזמנה')}`,
    }),
    text: `שלום ${order.customer_name || ''}, ${copy.text} (הזמנה #${number}). למעקב: ${ordersUrl}`,
  };
}
