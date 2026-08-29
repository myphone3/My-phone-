import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const { data: products } = await supabase.from('products').select('*').order('id', { ascending: false });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-gray-900">ברוכים הבאים לחנות 🛒</h1>
        <p className="text-gray-500 text-sm">כל המוצרים האיכותיים ביותר במקום אחד</p>
      </div>

      {!products || products.length === 0 ? (
        <p className="text-center text-gray-400 py-12">אין עדיין מוצרים בחנות.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/product/${product.id}`} className="bg-white p-4 rounded-3xl border shadow-sm hover:shadow-md transition flex flex-col justify-between group">
              <div>
                <div className="w-full h-48 bg-gray-50 rounded-2xl overflow-hidden mb-4 flex items-center justify-center p-2">
                  <img src={product.image_url || product.image_urls?.[0]} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition duration-200" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{product.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{product.short_description}</p>
              </div>
              <div className="mt-4 flex justify-between items-center pt-3 border-t">
                <span className="font-black text-black text-base">₪{product.price}</span>
                <span className="text-xs bg-black text-white px-3 py-1.5 rounded-xl font-medium">לצפייה במוצר</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
