import { supabase } from '../../../lib/supabase';
import ProductClientView from './ProductClientView';

export default async function ProductPage({ params }: { params: { id: string } }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (!product) {
    return (
      <div className="text-center py-32 space-y-4" dir="rtl">
        <h2 className="text-2xl font-black text-gray-900">המוצר לא נמצא</h2>
      </div>
    );
  }

  return <ProductClientView product={product} />;
}
