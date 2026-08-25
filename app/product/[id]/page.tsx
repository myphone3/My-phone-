import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import AddToCartBox from '@/components/AddToCartBox';

export const revalidate = 30;

async function getProduct(id: string) {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  if (!product) return notFound();

  const specs = [
    { label: 'אחסון', value: product.spec_storage },
    { label: 'זיכרון RAM', value: product.spec_ram },
    { label: 'סוללה', value: product.spec_battery },
  ].filter((s) => s.value);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-10">
      <div className="relative aspect-square bg-panel border border-line rounded-card sim-corner">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain p-8"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">אין תמונה</div>
        )}
      </div>

      <div>
        <span className="text-xs text-muted uppercase tracking-wide spec-num">{product.brand}</span>
        <h1 className="font-display font-bold text-2xl md:text-3xl mt-1">{product.name}</h1>
        <p className="spec-num text-3xl font-semibold text-accent mt-4">
          ₪{product.price.toLocaleString()}
        </p>

        {product.description && (
          <p className="text-muted mt-4 leading-relaxed">{product.description}</p>
        )}

        {specs.length > 0 && (
          <div className="mt-6 bg-ink text-white rounded-card font-mono text-sm sim-corner">
            <div className="px-4 py-2 border-b border-white/10 text-white/50 text-xs">SPEC_SHEET</div>
            <div className="p-4 space-y-2">
              {specs.map((s) => (
                <div key={s.label} className="flex justify-between">
                  <span className="text-white/50">{s.label}</span>
                  <span>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <AddToCartBox product={product} />
        </div>
      </div>
    </div>
  );
}
