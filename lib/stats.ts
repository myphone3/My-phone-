import { Order, orderItems, orderTotals } from './orders';

// חישובי מכירות משותפים לדשבורד ולדוחות. הזמנות שבוטלו לא נספרות.

export const isCountedOrder = (o: Order) => o?.status !== 'מבוטל';

export function orderDate(o: any) {
  const d = new Date(o?.created_at || o?.date || 0);
  return isNaN(d.getTime()) ? null : d;
}

export function inRange(o: any, from: Date, to: Date) {
  const d = orderDate(o);
  return !!d && d >= from && d < to;
}

export function revenueOf(orders: Order[]) {
  return orders.filter(isCountedOrder).reduce((sum, o) => sum + orderTotals(o).total, 0);
}

// מכירות לפי מוצר: כמות, הכנסה ועלות (כשמוגדרת עלות למוצר).
// הנחה על כל ההזמנה (קופון) מתחלקת בין המוצרים לפי חלקם בסכום, ועלות של מתנה נספרת כהוצאה בלי הכנסה.
// העלות היא העלות שמוגדרת היום למוצר (אין שמירה של העלות בזמן המכירה).
export function productSales(orders: Order[], products: any[] = []) {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const byName = new Map(products.map((p) => [String(p.name || '').trim(), p]));
  const rows = new Map<string, { name: string; qty: number; revenue: number; cost: number; hasCost: boolean }>();

  for (const order of orders.filter(isCountedOrder)) {
    const raw = Array.isArray(order.items) ? (order.items as any[]) : [];
    const items = orderItems(order);
    const paidSum = items.filter((i) => !i.gift).reduce((s, i) => s + i.total, 0);
    const discount = Math.min(paidSum, Math.max(0, orderTotals(order).discount));
    const keepShare = paidSum > 0 ? (paidSum - discount) / paidSum : 1;

    items.forEach((item, i) => {
      const src = raw[i] || {};
      const product = byId.get(String(src.product_id || src.productId || '')) || byName.get(String(src.name || '').trim());
      const key = product ? String(product.id) : String(src.name || item.name);
      const unitCost = Number(product?.cost);
      const costKnown = !!product && product.cost !== null && product.cost !== undefined && !isNaN(unitCost);
      if (item.gift && !costKnown) return;

      const row = rows.get(key) || { name: product?.name || src.name || item.name, qty: 0, revenue: 0, cost: 0, hasCost: false };
      if (!item.gift) {
        row.qty += item.qty;
        row.revenue += item.total * keepShare;
      }
      if (costKnown) {
        row.cost += unitCost * item.qty;
        row.hasCost = true;
      }
      rows.set(key, row);
    });
  }
  return Array.from(rows.values()).sort((a, b) => b.qty - a.qty);
}

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// יום קלנדרי מקומי (לא 24 שעות קבועות, כדי שמעבר שעון קיץ/חורף לא יזיז ימים)
export function addDays(d: Date, days: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

// מצרף לכל מוצר את העלות מטבלת העלויות (שגלויה רק למנהל)
export function withCosts(products: any[], costRows: any[] | null | undefined) {
  const map = new Map((costRows || []).map((c) => [String(c.product_id), Number(c.cost)]));
  return products.map((p) => (map.has(String(p.id)) ? { ...p, cost: map.get(String(p.id)) } : p));
}
