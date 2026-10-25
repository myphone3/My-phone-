// עזרים משותפים להזמנות: מספר הזמנה קצר, שורות מוצרים, סכומים וסטטוס

export type OrderItem = {
  name?: string;
  price?: number;
  sale_price?: number | null;
  quantity?: number;
  version?: string;
  color?: string;
};

export type Order = {
  id: string;
  created_at?: string;
  customer_name?: string | null;
  phone?: string | null;
  customer_phone?: string | null;
  email?: string | null;
  address?: string | null;
  customer_address?: string | null;
  notes?: string | null;
  items?: OrderItem[] | null;
  subtotal?: number | null;
  discount_amount?: number | null;
  shipping_cost?: number | null;
  total_price?: number | null;
  total?: number | null;
  status?: string | null;
};

// מספר הזמנה בן 8 ספרות שמחושב מה-id (אותו מספר בפאנל, אצל הלקוח, במייל וב-PDF)
export function orderNumber(id?: string) {
  if (!id) return '';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return String(10000000 + (hash % 90000000));
}

export function orderItems(order: Order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.map((item) => {
    const qty = Number(item.quantity) || 1;
    const unit = Number(item.sale_price || item.price) || 0;
    const extras = [item.version, item.color].filter(Boolean).join(', ');
    return {
      name: (item.name || 'מוצר') + (extras ? ` (${extras})` : ''),
      qty,
      unit,
      total: unit * qty,
    };
  });
}

export function orderTotals(order: Order) {
  const items = orderItems(order);
  const subtotal = Number(order.subtotal) || items.reduce((sum, i) => sum + i.total, 0);
  const discount = Number(order.discount_amount) || 0;
  const shipping = Number(order.shipping_cost) || 0;
  const total = Number(order.total_price ?? order.total) || Math.max(0, subtotal - discount + shipping);
  return { subtotal, discount, shipping, total };
}

export function formatMoney(value: number) {
  return `₪${Math.round(value * 100) / 100}`;
}

export function formatDate(iso?: string, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jerusalem' });
  if (!withTime) return date;
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  return `${date}, ${time}`;
}

// שלבי ההתקדמות שהלקוח רואה, ואיזה שלב הושלם לכל סטטוס בפאנל
export const ORDER_STEPS = ['התקבלה', 'בטיפול', 'נשלחה', 'הושלמה'];

export function orderStepIndex(status?: string | null) {
  switch (status) {
    case 'בטיפול':
    case 'מחכה למשלוח':
    case 'מוכן לאיסוף':
      return 1;
    case 'נשלח':
      return 2;
    case 'הושלם':
      return 3;
    default:
      return 0;
  }
}

export function statusBadge(status?: string | null) {
  switch (status) {
    case 'בטיפול':
      return { label: 'בטיפול ⏳', className: 'bg-amber-50 text-amber-800' };
    case 'מחכה למשלוח':
      return { label: 'מחכה למשלוח 📦', className: 'bg-amber-50 text-amber-800' };
    case 'מוכן לאיסוף':
      return { label: 'מוכן לאיסוף 🛍️', className: 'bg-amber-50 text-amber-800' };
    case 'נשלח':
      return { label: 'נשלח 🚚', className: 'bg-yellow-100 text-yellow-900' };
    case 'הושלם':
      return { label: 'הושלם ✓', className: 'bg-green-100 text-green-800' };
    case 'מבוטל':
      return { label: 'מבוטל ❌', className: 'bg-red-50 text-red-700' };
    default:
      return { label: 'חדש 🆕', className: 'bg-blue-50 text-blue-700' };
  }
}
