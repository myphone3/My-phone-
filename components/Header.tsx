'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';

export default function Header() {
  const { totalItems } = useCart();
  const [query, setQuery] = useState('');

  return (
    <header className="sticky top-0 z-40 bg-panel/95 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-display font-extrabold text-xl tracking-tight shrink-0">
          החנות שלי<span className="text-accent">.</span>
        </Link>

        <form
          action="/catalog"
          className="flex-1 hidden sm:flex items-center bg-paper border border-line rounded-card px-3 py-2 focus-within:border-accent transition-colors"
        >
          <input
            type="text"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מכשיר, מותג או אביזר..."
            className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted"
          />
          <button type="submit" aria-label="חפש" className="text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>

        <nav className="flex items-center gap-4 text-sm font-medium shrink-0">
          <Link href="/catalog" className="hover:text-accent transition-colors hidden sm:inline">
            קטלוג
          </Link>
          <Link href="/cart" className="relative flex items-center gap-1 hover:text-accent transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>עגלה</span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-3 bg-signal text-white text-xs font-mono w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
