'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function AllCategoriesAndBrandsContent() {
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catRes, brandRes] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('brands').select('*')
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (brandRes.data) setBrands(brandRes.data);
    } catch (err) {
      console.error('Error fetching categories and brands:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-24 font-bold text-sm text-gray-600" dir="rtl">
        טוען את הקטגוריות והמותגים... ⏳
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 pb-20" dir="rtl">
      {/* כותרת ראשית */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          כל הקטגוריות והמותגים
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm">
          בחר את הקטגוריה או המותג המועדף עליך ומצא את המוצר המושלם בקלות
        </p>
      </div>

      {/* חלק המותגים */}
      {brands.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-lg sm:text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
              מותגים מובילים
            </h2>
            <span className="text-xs text-gray-400 font-medium">
              {brands.length} מותגים זמינים
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brand/${encodeURIComponent(brand.name)}`}
                className="bg-white rounded-3xl border border-gray-100 p-4 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md hover:border-orange-300 transition group"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center p-2 rounded-2xl bg-gray-50 group-hover:scale-105 transition">
                  {brand.image_url ? (
                    <img
                      src={brand.image_url}
                      alt={brand.name}
                      className="max-h-full max-w-full object-contain pointer-events-none"
                    />
                  ) : (
                    <span className="text-2xl">🏷️</span>
                  )}
                </div>
                <span className="font-bold text-xs sm:text-sm text-gray-800 group-hover:text-orange-600 transition text-center truncate w-full">
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* חלק הקטגוריות */}
      {categories.length > 0 && (
        <section className="space-y-6 pt-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-lg sm:text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
              כל הקטגוריות בחנות
            </h2>
            <span className="text-xs text-gray-400 font-medium">
              {categories.length} קטגוריות זמינות
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${encodeURIComponent(cat.name)}`}
                className="bg-white rounded-3xl border border-gray-100 p-5 flex flex-col items-center text-center gap-4 shadow-sm hover:shadow-xl hover:border-orange-300 transition group"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-orange-50/60 border border-orange-200/50 flex items-center justify-center overflow-hidden group-hover:scale-105 transition shadow-inner">
                  {cat.image_url ? (
                    <img
                      src={cat.image_url}
                      alt={cat.name}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <span className="text-3xl">📦</span>
                  )}
                </div>
                <div className="space-y-1 w-full">
                  <span className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-orange-600 transition block truncate">
                    {cat.name}
                  </span>
                  <span className="text-[11px] text-orange-600 font-medium inline-flex items-center gap-1">
                    <span>צפה במוצרים</span>
                    <span>➔</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function AllCategoriesAndBrandsPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-bold text-sm text-gray-600">טוען נתונים...</div>}>
      <AllCategoriesAndBrandsContent />
    </Suspense>
  );
}
