import { supabase } from '@/lib/supabase';
import ProductClientView from './ProductClientView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const { data: categories } = await supabase.from('categories').select('*');
  const { data: brands } = await supabase.from('brands').select('*');
  const { data: kosherOptions } = await supabase.from('kosher_options').select('*');

  let relatedProducts: any[] = [];
  if (product.related_ids && product.related_ids.length > 0) {
    const { data: relData } = await supabase.from('products').select('*').in('id', product.related_ids);
    if (relData) relatedProducts = relData;
  }

  let promoProduct = null;
  if (product.upsell_product_id) {
    const { data: promoData } = await supabase.from('products').select('*').eq('id', product.upsell_product_id).single();
    if (promoData) {
      promoData.price = product.upsell_price !== null ? product.upsell_price : promoData.price;
      promoProduct = promoData;
    }
  }

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
      relatedProducts={relatedProducts} 
      promoProduct={promoProduct} 
    />
  );
}
