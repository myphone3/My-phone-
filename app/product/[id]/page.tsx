import { supabase } from '@/lib/supabase';
import ProductClientView from './ProductClientView';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
  if (!product) return { title: 'מוצר לא נמצא' };

  return {
    title: product.seo_title || product.name,
    description: product.seo_description || product.short_description || 'חנות מכשירים ואביזרים כשרים',
    keywords: product.seo_keywords || '',
  };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
  if (!product) return <div className="text-center py-20">המוצר אינו נמצא.</div>;

  // שליפת קטגוריות, מותגים וכשרויות לתצוגת תמונות
  const { data: categories } = await supabase.from('categories').select('*');
  const { data: brands } = await supabase.from('brands').select('*');
  const { data: kosherOptions } = await supabase.from('kosher_options').select('*');

  // שליפת מוצרים קשורים (מוצרים אחרים בחנות)
  const { data: allProducts } = await supabase.from('products').select('*').neq('id', id).limit(4);

  // בחירת מוצר מבצע להצגה בעגלה (למשל המוצר הראשון או השני ברשימה)
  const promoProduct = allProducts && allProducts.length > 0 ? allProducts[0] : null;

  const matchedCategory = categories?.find(c => c.name?.trim().toLowerCase() === product.category?.trim().toLowerCase());
  const matchedBrand = brands?.find(b => b.name?.trim().toLowerCase() === product.brand?.trim().toLowerCase());
  const matchedKosher = kosherOptions?.find(k => k.name?.trim().toLowerCase() === product.kosher?.trim().toLowerCase());

  const enrichedProduct = {
    ...product,
    categoryImage: matchedCategory?.image_url || null,
    brandImage: matchedBrand?.image_url || null,
    kosherImage: matchedKosher?.image_url || null,
  };

  return (
    <ProductClientView 
      product={enrichedProduct} 
      relatedProducts={allProducts || []} 
      promoProduct={promoProduct} 
    />
  );
}
