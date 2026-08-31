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
  const [selectedVersion, setSelectedVersion] = useState('');
  const [activeImage, setActiveImage] = useState('');

  useEffect(() => {
    if (id) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('id', id).single();
    if (data) {
      setProduct(data);
      setActiveImage(data.image_url || data.images?.[0] || '');
      
      const storageList = data.storage_options ? data.storage_options.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      if (storageList.length > 0) setSelectedStorage(storageList[0]);

      const versionsList = data.product_versions || (data.version ? [data.version] : []);
      if (versionsList.length > 0) setSelectedVersion(versionsList[0]);
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-20 text-gray-500">טוען פרטי מוצר...</div>;
  if (!product) return <div className="text-center py-20 text-gray-400">המוצר אינו נמצא.</div>;

  const storageList = product.storage_options ? product.storage_options.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const versionsList = product.product_versions || (product.version ? [product.version] : []);
  const colorsList = product.product_colors || [];

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
    alert(`המוצר נוסף לעגלה בהצלחה!`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-3xl border shadow-sm space-y-6" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* תמונות המוצר */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-center border h-80">
            <img src={activeImage || product.image_url} alt={product.name} className="max-h-full object-contain" />
          </div>
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.map((img: string, idx: number) => (
                <button key={idx} onClick={() => setActiveImage(img)} className={`border-2 rounded-xl p-1 bg-gray-50 w-16 h-16 flex-shrink-0 ${activeImage === img ? 'border-black' : 'border-transparent'}`}>
                  <img src={img} alt="thumb" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* פרטי המוצר המלאים */}
        <div className="space-y-4">
          <h1 className="text-2xl font-black text-gray-900">{product.name}</h1>
          <div className="text-xl font-black text-black">₪{product.price}</div>

          {/* מותג, קטגוריה וכשרות */}
          <div className="flex flex-wrap gap-2 text-xs">
            {product.brand && <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-xl font-bold">🏷️ מותג: {product.brand}</span>}
            {product.category && <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-xl font-bold">📂 קטגוריה: {product.category}</span>}
            {product.kosher && <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-xl font-bold border border-amber-200">✨ כשרות: {product.kosher}</span>}
          </div>

          <p className="text-sm text-gray-600">{product.short_description || product.description}</p>

          {/* צבעים פיזיים */}
          {colorsList.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">בחר צבע</label>
              <div className="flex flex-wrap gap-2">
                {colorsList.map((col: any, idx: number) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      if (col.image) setActiveImage(col.image);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold hover:border-black transition"
                  >
                    <span className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: col.hex }}></span>
                    {col.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* גרסאות מכשיר */}
          {versionsList.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">בחר גרסה</label>
              <div className="flex flex-wrap gap-2">
                {versionsList.map((ver: string, idx: number) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setSelectedVersion(ver)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${selectedVersion === ver ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    {ver}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* נפחי אחסון */}
          {storageList.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">בחר נפח אחסון</label>
              <div className="flex flex-wrap gap-2">
                {storageList.map((opt: string, idx: number) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setSelectedStorage(opt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${selectedStorage === opt ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* תיאור מלא */}
          {product.description && (
            <div className="border-t pt-3 text-xs text-gray-700 whitespace-pre-line leading-relaxed">
              <span className="font-bold block mb-1">תיאור מלא:</span>
              {product.description}
            </div>
          )}

          {/* הוספה לעגלה */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="w-full bg-black text-white hover:bg-gray-800 font-bold py-3.5 rounded-2xl transition text-sm cursor-pointer"
          >
            הוספה לעגלה 🛒
          </button>

          {/* כפתורי שיתוף (וואטסאפ אייקון בלבד + העתקת קישור) */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              title="שיתוף בוואטסאפ"
              className="bg-emerald-500 hover:bg-emerald-600 text-white w-11 h-11 rounded-2xl flex items-center justify-center transition cursor-pointer text-lg shadow-sm"
            >
              💬
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-3 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer flex-1 justify-center"
            >
              🔗 העתק קישור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
