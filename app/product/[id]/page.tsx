'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useParams } from 'next/navigation';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState<any>(null);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStorage, setSelectedStorage] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [activeImage, setActiveImage] = useState('');

  useEffect(() => {
    if (id) fetchProductData();
  }, [id]);

  const fetchProductData = async () => {
    setLoading(true);
    const [prodRes, catRes, brandRes] = await Promise.all([
      supabase.from('products').select('*').eq('id', id).single(),
      supabase.from('categories').select('*'),
      supabase.from('brands').select('*'),
    ]);

    if (prodRes.data) {
      setProduct(prodRes.data);
      setActiveImage(prodRes.data.image_url || prodRes.data.images?.[0] || '');
      
      const storageList = prodRes.data.storage_options ? prodRes.data.storage_options.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      if (storageList.length > 0) setSelectedStorage(storageList[0]);

      const versionsList = prodRes.data.product_versions || (prodRes.data.version ? [prodRes.data.version] : []);
      if (versionsList.length > 0) setSelectedVersion(versionsList[0]);
    }
    if (catRes.data) setCategoriesList(catRes.data);
    if (brandRes.data) setBrandsList(brandRes.data);

    setLoading(false);
  };

  if (loading) return <div className="text-center py-20 text-gray-500">טוען פרטי מוצר...</div>;
  if (!product) return <div className="text-center py-20 text-gray-400">המוצר אינו נמצא.</div>;

  const storageList = product.storage_options ? product.storage_options.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const versionsList = product.product_versions || (product.version ? [product.version] : []);
  const colorsList = product.product_colors || [];

  // מציאת תמונת לוגו למותג או לקטגוריה אם קיימת
  const currentBrandObj = brandsList.find((b) => b.name === product.brand);
  const currentCatObj = categoriesList.find((c) => c.name === product.category);

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

          {/* מותג, קטגוריה וכשרות (מותג וקטגוריה כוללים תמונה/אייקון אם זמין) */}
          <div className="flex flex-wrap gap-2 text-xs items-center">
            {product.brand && (
              <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                {currentBrandObj?.image_url && <img src={currentBrandObj.image_url} alt="" className="w-4 h-4 object-contain" />}
                🏷️ {product.brand}
              </span>
            )}
            {product.category && (
              <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                {currentCatObj?.image_url && <img src={currentCatObj.image_url} alt="" className="w-4 h-4 object-contain" />}
                📂 {product.category}
              </span>
            )}
            {product.kosher && (
              <span className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl font-bold border border-amber-200">
                {product.kosher}
              </span>
            )}
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
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold hover:border-black transition cursor-pointer"
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${selectedVersion === ver ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${selectedStorage === opt ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}
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

          {/* כפתורי שיתוף (אייקון וואטסאפ רשמי בלבד + העתקת קישור) */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              title="שיתוף בוואטסאפ"
              className="bg-emerald-500 hover:bg-emerald-600 text-white w-11 h-11 rounded-2xl flex items-center justify-center transition cursor-pointer shadow-sm flex-shrink-0"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
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
