import { supabase, Product } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';

export const revalidate = 30;

async function getProducts(q?: string, category?: string): Promise<Product[]> {
  let query = supabase.from('products').select('*').order('name');

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

async function getCategories(): Promise<string[]> {
  const { data } = await supabase.from('products').select('category');
  const set = new Set((data ?? []).map((d: { category: string }) => d.category).filter(Boolean));
  return Array.from(set);
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const [products, categories] = await Promise.all([
    getProducts(searchParams.q, searchParams.category),
    getCategories(),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl mb-1">קטלוג מוצרים</h1>
      <p className="text-muted text-sm mb-6 spec-num">{products.length} מוצרים</p>

      {/* Mobile search */}
      <form action="/catalog" className="sm:hidden mb-4 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="חיפוש..."
          className="flex-1 bg-panel border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button className="bg-ink text-white rounded-card px-4 text-sm">חפש</button>
      </form>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <a
            href="/catalog"
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              !searchParams.category ? 'bg-ink text-white border-ink' : 'border-line text-muted hover:border-ink'
            }`}
          >
            הכל
          </a>
          {categories.map((c) => (
            <a
              key={c}
              href={`/catalog?category=${encodeURIComponent(c)}`}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                searchParams.category === c ? 'bg-ink text-white border-ink' : 'border-line text-muted hover:border-ink'
              }`}
            >
              {c}
            </a>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="border border-dashed border-line rounded-card p-10 text-center text-muted">
          לא נמצאו מוצרים תואמים
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
