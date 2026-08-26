'use client';

import { useEffect, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { createClient } from '@supabase/supabase-js';

// הגדרת חיבור ל-Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*');
      if (error) {
        console.error('שגיאה בטעינת המוצרים:', error);
      } else if (data) {
        setProducts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // סינון מוצרים לפי חיפוש
  const filteredProducts = products.filter((p) =>
    (p.name || p.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">קטלוג מוצרים</h1>
        
        {/* תיבת חיפוש */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded-lg px-4 py-2 flex-1 bg-white text-black"
          />
        </div>

        {/* מונה מוצרים */}
        <p className="text-sm text-gray-500 mb-4">{filteredProducts.length} מוצרים</p>

        {/* רשת המוצרים */}
        {loading ? (
          <p className="text-center py-10">טוען מוצרים...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-center py-10 text-gray-500">אין מוצרים להצגה</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id || Math.random()} {...product} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
