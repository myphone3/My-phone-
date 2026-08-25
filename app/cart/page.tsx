'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';

export default function CartPage() {
  const { items, updateQty, removeItem, totalPrice, clearCart } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  const buildOrderMessage = () => {
    const lines = items.map(
      (i) => `• ${i.product.name} × ${i.qty} — ₪${(i.product.price * i.qty).toLocaleString()}`
    );
    return [
      'הזמנה חדשה מהאתר:',
      '',
      ...lines,
      '',
      `סה"כ: ₪${totalPrice.toLocaleString()}`,
      '',
      `שם: ${name || '-'}`,
      `טלפון: ${phone || '-'}`,
      `כתובת למשלוח: ${address || '-'}`,
    ].join('\n');
  };

  const handleCheckout = () => {
    const message = encodeURIComponent(buildOrderMessage());
    const url = `https://wa.me/${waNumber}?text=${message}`;
    window.open(url, '_blank');
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold text-2xl mb-2">העגלה שלך ריקה</h1>
        <p className="text-muted mb-6">עדיין לא הוספת מוצרים לעגלה</p>
        <Link href="/catalog" className="inline-block bg-ink text-white px-6 py-3 rounded-card hover:bg-accent transition-colors">
          למעבר לקטלוג
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl mb-6">העגלה שלך</h1>

      <div className="space-y-3 mb-8">
        {items.map(({ product, qty }) => (
          <div key={product.id} className="flex items-center gap-4 bg-panel border border-line rounded-card p-3">
            <div className="relative w-16 h-16 bg-paper rounded shrink-0">
              {product.image_url && (
                <Image src={product.image_url} alt={product.name} fill className="object-contain p-1" sizes="64px" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p className="spec-num text-sm text-muted">₪{product.price.toLocaleString()} ליחידה</p>
            </div>
            <div className="flex items-center border border-line rounded-card overflow-hidden shrink-0">
              <button onClick={() => updateQty(product.id, qty - 1)} className="w-8 h-8 hover:bg-paper">−</button>
              <span className="w-8 text-center spec-num text-sm">{qty}</span>
              <button onClick={() => updateQty(product.id, qty + 1)} className="w-8 h-8 hover:bg-paper">+</button>
            </div>
            <button
              onClick={() => removeItem(product.id)}
              className="text-muted hover:text-signal text-sm shrink-0"
              aria-label="הסר מהעגלה"
            >
              הסר
            </button>
          </div>
        ))}
      </div>

      <div className="bg-ink text-white rounded-card p-5 font-mono sim-corner mb-8">
        <div className="flex justify-between text-lg">
          <span className="text-white/50">סה"כ לתשלום</span>
          <span className="font-semibold">₪{totalPrice.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-card p-5 space-y-3">
        <h2 className="font-display font-bold">פרטי משלוח</h2>
        <input
          type="text"
          placeholder="שם מלא"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="tel"
          placeholder="טלפון"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="text"
          placeholder="כתובת למשלוח"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <button
          onClick={handleCheckout}
          className="w-full bg-[#25D366] text-white font-medium py-3 rounded-card hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          שליחת הזמנה בוואטסאפ
        </button>
        <p className="text-xs text-muted text-center">
          ההזמנה תישלח לוואטסאפ העסקי שלנו לאישור וסגירת תשלום
        </p>
      </div>
    </div>
  );
}
