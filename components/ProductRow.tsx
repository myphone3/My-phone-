'use client';

import ProductCard from './ProductCard';

// שורת מוצרים נגללת לצדדים (צפיתם לאחרונה / קנו גם)
export default function ProductRow({ title, products }: { title: string; products: any[] }) {
  if (!products.length) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-base sm:text-lg font-black text-gray-900 border-r-4 border-orange-600 pr-3">{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-40 sm:w-48">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
