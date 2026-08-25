import Link from 'next/link';
import { supabase, Product } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';

export const revalidate = 60;

async function getFeatured(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export default async function Home() {
  const featured = await getFeatured();

  return (
    <div>
      {/* Hero: spec-sheet thesis statement */}
      <section className="border-b border-line bg-panel">
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="spec-num text-accent text-sm tracking-widest">STOCK.LIVE // ISRAEL</span>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl leading-[1.1] mt-3">
              המכשיר הבא שלך,
              <br />
              במחיר שכתוב <span className="text-accent">בשחור-לבן</span>
            </h1>
            <p className="text-muted mt-4 max-w-md">
              מאות מכשירים ואביזרים, מלאי מתעדכן בזמן אמת, בלי הפתעות בקופה.
            </p>
            <Link
              href="/catalog"
              className="inline-block mt-6 bg-ink text-white font-medium px-6 py-3 rounded-card hover:bg-accent transition-colors"
            >
              לקטלוג המלא
            </Link>
          </div>

          {/* Signature: spec sheet card */}
          <div className="bg-ink text-white rounded-card p-6 font-mono text-sm sim-corner">
            <div className="flex justify-between border-b border-white/10 pb-2 mb-2">
              <span className="text-white/50">SPEC_SHEET</span>
              <span className="text-accent">●LIVE</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-white/50">מכשירים בקטלוג</span><span>300+</span></div>
              <div className="flex justify-between"><span className="text-white/50">עדכון מלאי</span><span>זמן אמת</span></div>
              <div className="flex justify-between"><span className="text-white/50">משלוח</span><span>עד הבית</span></div>
              <div className="flex justify-between"><span className="text-white/50">תמיכה</span><span>WhatsApp</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display font-bold text-2xl">חדש בחנות</h2>
          <Link href="/catalog" className="text-sm text-accent hover:underline">לכל המוצרים ←</Link>
        </div>

        {featured.length === 0 ? (
          <div className="border border-dashed border-line rounded-card p-10 text-center text-muted">
            <p className="font-medium">עוד לא הוספת מוצרים</p>
            <p className="text-sm mt-1">מוצרים שתוסיף בטבלת products ב-Supabase יופיעו כאן אוטומטית.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
