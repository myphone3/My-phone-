// הודעה קופצת מעוצבת במקום alert של הדפדפן. מוצגת על ידי components/Toast.tsx.
export type ToastOptions = {
  kind?: 'success' | 'error' | 'info';
  action?: { href: string; label: string };
};

export function showToast(message: string, options: ToastOptions = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, ...options } }));
}

export function showAddedToCart() {
  showToast('המוצר נוסף לעגלה 🛒', { kind: 'success', action: { href: '/cart', label: 'מעבר לעגלה' } });
}
