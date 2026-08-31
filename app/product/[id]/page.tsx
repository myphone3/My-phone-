'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useParams } from 'next/navigation';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStorage, setSelectedStorage] = useState('');

  useEffect(() => {
    if (id) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('id', id).single();
    if (data) {
      setProduct(data);
      const list = data.storage_options ? data.storage_options.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      if (list.length > 0) setSelectedStorage(list[0]);
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-20 text-gray-500">טוען פרטי מוצר...</div>;
  if (!product) return <div className="text-center py-20 text-gray-400">המוצר אינו נמצא.</div>;

  // פירוק נפחי אחסון
  const storageList = product.storage_options 
    ? product.storage_options.split(',').map((s: string) => s.trim()).filter(Boolean) 
    : [];
  const isStorageRequired = storageList.length > 1;

  // שיתוף בוואצפ והעתקת קישור
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`היי, תראה איזה מוצר מדהים מצאתי בחנות: ${product.name} - ${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('הקישור הועתק בהצלחה ללוח! 📋');
  };

  const handleAddToCart = () => {
    if (isStorageRequired && !selectedStorage) {
      alert('נא לבחור נפח אחסון לפני הוספה לעגלה.');
      return;
    }
    alert(`המוצר נוסף לעגלה בהצלחה! ${selectedStorage ? `(נפח: ${selectedStorage})` : ''}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-3xl border shadow-sm space-y-6" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* תמונה ראשית */}
        <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-center border h-80">
          <img src={product.image_url} alt={product.name} className="max-h-full object-contain" />
        </div>

        {/* פרטי המוצר */}
        <div className="space-y-4">
          <h1 className="text-2xl font-black text-gray-900">{product.name}</h1>
          <div className="text-xl font-black text-black">₪{product.price}</div>
          <p className="text-sm text-gray-600">{product.short_description || product.description}</p>

          {/* בחירת נפח אחסון */}
          {storageList.length > 0 && (
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-gray-700">
                בחר נפח אחסון {isStorageRequired && <span className="text-red-500">*</span>}
              </label>
              <div className="flex flex-wrap gap-2">
                {storageList.map((opt: string, idx: number) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setSelectedStorage(opt)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      selectedStorage === opt
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-black'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* כפתור הוספה לעגלה */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="w-full bg-black text-white hover:bg-gray-800 font-bold py-3.5 rounded-2xl transition text-sm cursor-pointer"
          >
            הוספה לעגלה 🛒
          </button>

          {/* כפתורי שיתוף בוואטסאפ והעתקת קישור */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              💬 שיתוף בוואצפ
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              🔗 העתק קישור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
