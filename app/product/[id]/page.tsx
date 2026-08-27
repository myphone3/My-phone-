import { supabase } from '@/lib/supabase';
import ProductClientView from './ProductClientView';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
  
  if (!product) {
    return { title: 'מוצר לא נמצא' };
  }

  return {
    title: product.seo_title || product.name,
    description: product.seo_description || product.short_description || 'חנות מכשירים ואביזרים כשרים',
    keywords: product.seo_keywords || '',
  };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
  if (!product) return <div className="text-center py-20">המוצר אינו נמצא.</div>;

  // שליפת כל הקטגוריות, המותגים והכשרויות כדי למצוא התאמה גמישה
  const { data: categories } = await supabase.from('categories').select('*');
  const { data: brands } = await supabase.from('brands').select('*');
  const { data: kosherOptions } = await supabase.from('kosher_options').select('*');

  // חיפוש גמיש שמתעלם מרווחים מיותרים או הבדלי כתיב
  const matchedCategory = categories?.find(c => c.name?.trim().toLowerCase() === product.category?.trim().toLowerCase());
  const matchedBrand = brands?.find(b => b.name?.trim().toLowerCase() === product.brand?.trim().toLowerCase());
  const matchedKosher = kosherOptions?.find(k => k.name?.trim().toLowerCase() === product.kosher?.trim().toLowerCase());

  const enrichedProduct = {
    ...product,
    categoryImage: matchedCategory?.image_url || null,
    brandImage: matchedBrand?.image_url || null,
    kosherImage: matchedKosher?.image_url || null,
  };

  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: product.image_urls || [product.image_url],
    description: product.description || product.short_description,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'ILS',
      price: product.price,
      availability: 'https://schema.org/InStock',
    },
    brand: {
      '@type': 'Brand',
      name: product.brand || 'General',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductClientView product={enrichedProduct} />
    </>
  );
}
