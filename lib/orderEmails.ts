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

export type SavedCartItem = { name: string; price: number; quantity: number; image_url?: string | null };

// תזכורת לעגלה שלא הושלמה. נשלחת רק ללקוח רשום שאישר קבלת מבצעים במייל, ותמיד עם קישור הסרה
export function abandonedCartEmail(opts: { name?: string | null; items: SavedCartItem[]; cartUrl: string; unsubscribeUrl: string }) {
  const first = escapeHtml((opts.name || '').trim().split(/\s+/)[0] || 'לקוח יקר');
  const cell = 'padding:10px 0; border-bottom:1px solid #f3f4f6; vertical-align:middle;';
  const total = opts.items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
  const rows = opts.items
    .map((i) => {
      const img = i.image_url
        ? `<img src="${escapeHtml(i.image_url)}" alt="" width="52" height="52" style="width:52px; height:52px; object-fit:contain; border-radius:10px; border:1px solid #f3f4f6; background:#f9fafb;" />`
        : '';
      return `<tr><td style="${cell} width:60px;">${img}</td><td style="${cell}">${escapeHtml(i.name)}${(Number(i.quantity) || 1) > 1 ? ` × ${Number(i.quantity)}` : ''}</td><td style="${cell} text-align:left; white-space:nowrap; font-weight:bold;">${formatMoney((Number(i.price) || 0) * (Number(i.quantity) || 1))}</td></tr>`;
    })
    .join('');
  const html = layout({
    title: 'שכחת משהו בעגלה? 🛒',
    subtitle: 'המוצרים שבחרת עדיין מחכים לך',
    body: `
      <p style="margin:0 0 8px;">שלום ${first},</p>
      <p style="margin:0;">ראינו שהשארת מוצרים בעגלה ולא השלמת את ההזמנה. שמרנו לך אותם:</p>
      <table dir="rtl" style="width:100%; border-collapse:collapse; font-size:13px; margin:14px 0;">${rows}
        <tr><td></td><td style="padding:10px 0 0; font-weight:900; color:${ORANGE};">סה״כ</td><td style="padding:10px 0 0; font-weight:900; color:${ORANGE}; text-align:left;">${formatMoney(total)}</td></tr>
      </table>
      ${button(opts.cartUrl, 'להשלמת ההזמנה')}
      <p style="margin:14px 0 0; font-size:11px; color:#9ca3af; text-align:center;">
        קיבלת את המייל כי אישרת לקבל מאיתנו מבצעים ועדכונים.
        <a href="${opts.unsubscribeUrl}" style="color:#9ca3af;">להסרה מרשימת הדיוור</a>
      </p>`,
  });
  return { subject: 'שכחת משהו בעגלה? המוצרים שלך מחכים 🛒', html };
}

// מייל מבצעים/עדכון ללקוחות שאישרו קבלת מבצעים. תמיד עם קישור הסרה אישי
export function campaignEmail(opts: { name?: string | null; subject: string; message: string; buttonText?: string; buttonUrl?: string; unsubscribeUrl?: string }) {
  const first = escapeHtml((opts.name || '').trim().split(/\s+/)[0] || '');
  // שורות ריקות מפרידות פסקאות, ושורה חדשה נשמרת
  const paragraphs = escapeHtml(opts.message)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, '<br />')}</p>`)
    .join('');
  const html = layout({
    title: escapeHtml(opts.subject),
    subtitle: 'NEW PHONE · הפלאפון החדש שלך',
    body: `
      ${first ? `<p style="margin:0 0 10px;">שלום ${first},</p>` : ''}
      ${paragraphs}
      ${opts.buttonUrl ? button(escapeHtml(opts.buttonUrl), escapeHtml(opts.buttonText || 'לאתר')) : ''}
      ${
        opts.unsubscribeUrl
          ? `<p style="margin:14px 0 0; font-size:11px; color:#9ca3af; text-align:center;">
        קיבלת את המייל כי אישרת לקבל מאיתנו מבצעים ועדכונים.
        <a href="${opts.unsubscribeUrl}" style="color:#9ca3af;">להסרה מרשימת הדיוור</a>
      </p>`
          : ''
      }`,
  });
  return { subject: opts.subject, html };
}

// בקשת ביקורת: נשלחת פעם אחת אחרי שההזמנה נמסרה (מייל שירות על הקנייה, בלי פרסום)
export function reviewRequestEmail(opts: { name?: string | null; reviewUrl: string; whatsappUrl: string }) {
  const first = escapeHtml((opts.name || '').trim().split(/\s+/)[0] || 'לקוח יקר');
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<a href="${opts.reviewUrl}" style="text-decoration:none; font-size:30px; color:#f59e0b; padding:0 2px;">★</a>`)
    .join('');
  const html = layout({
    title: 'איך המכשיר החדש? ⭐',
    subtitle: 'נשמח לשמוע מה דעתך',
    body: `
      <p style="margin:0 0 8px;">שלום ${first},</p>
      <p style="margin:0;">ההזמנה שלך הגיעה, ונשמח לדעת איך הייתה החוויה. ביקורת קצרה (ואפילו תמונה) עוזרת ללקוחות אחרים לבחור, ולנו להשתפר.</p>
      <div style="text-align:center; margin:18px 0 6px;" dir="ltr">${stars}</div>
      ${button(opts.reviewUrl, 'כתיבת ביקורת')}
      <p style="margin:14px 0 0; font-size:12px; color:#6b7280; text-align:center;">
        משהו לא בסדר? <a href="${opts.whatsappUrl}" style="color:${ORANGE}; font-weight:bold;">כתבו לנו בוואטסאפ</a> ונטפל בזה מיד.
      </p>`,
  });
  return { subject: 'איך המכשיר החדש? נשמח לביקורת קצרה ⭐', html };
}

// התראה לבעלי החנות על הזמנה חדשה (מייל נפרד מהמייל ללקוח, עם כותרת שקל לזהות בטלפון)
export function newOrderAlertEmail(order: Order, adminUrl: string) {
  const num = orderNumber(order.id);
  const totals = orderTotals(order);
  const name = escapeHtml(order.customer_name || 'לקוח');
  const phone = escapeHtml(order.phone || order.customer_phone || '');
  const address = escapeHtml(order.address || order.customer_address || '');
  const rows = orderItems(order)
    .map(
      (i) =>
        `<tr><td style="padding:6px 0; border-bottom:1px solid #f3f4f6;">${escapeHtml(i.name)} × ${i.qty}</td><td style="padding:6px 0; border-bottom:1px solid #f3f4f6; text-align:left; white-space:nowrap;">${i.gift ? 'מתנה' : formatMoney(i.total)}</td></tr>`
    )
    .join('');
  const body = `
    <p style="margin:0 0 10px;"><b>${name}</b>${phone ? ` · <a href="tel:${phone}" style="color:${ORANGE};">${phone}</a>` : ''}</p>
    ${address ? `<p style="margin:0 0 10px; color:#4b5563;">📍 ${address}</p>` : ''}
    <table style="width:100%; border-collapse:collapse; font-size:13px;">${rows}</table>
    <p style="font-size:18px; font-weight:900; margin:14px 0;">סה״כ: ${formatMoney(totals.total)}</p>
    ${order.notes ? `<p style="background:#fff7ed; padding:10px; border-radius:10px; margin:0 0 14px;">📝 ${escapeHtml(order.notes)}</p>` : ''}
    <div style="text-align:center;"><a href="${adminUrl}" style="display:inline-block; background:#111827; color:#fff; text-decoration:none; padding:12px 22px; border-radius:12px; font-weight:900;">לפתיחת ההזמנה בפאנל</a></div>
  `;
  return {
    subject: `🛍️ הזמנה חדשה #${num} · ${order.customer_name || 'לקוח'} · ${formatMoney(totals.total)}`,
    html: layout({ title: '🛍️ הזמנה חדשה!', subtitle: `מספר ${num}`, body }),
    text: `הזמנה חדשה #${num} מ-${order.customer_name || 'לקוח'} (${order.phone || ''}), סה״כ ${formatMoney(totals.total)}. ${adminUrl}`,
  };
}
