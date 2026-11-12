// צורות טעינה בכתום של האתר, במקום טקסט "טוען..."

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl border-2 border-orange-100 p-4 space-y-3" aria-hidden="true">
      <span className="skeleton h-40 sm:h-52 rounded-2xl" />
      <span className="skeleton h-3 rounded w-4/5" />
      <span className="skeleton h-3 rounded w-2/5" />
      <span className="skeleton h-8 rounded-xl" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 ${className}`} role="status" aria-label="טוען מוצרים">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl" role="status" aria-label="טוען את המוצר">
      <span className="skeleton h-10 rounded-2xl" />
      <div className="bg-white rounded-3xl border border-orange-100 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <span className="skeleton h-[min(92vw,26rem)] sm:h-96 rounded-2xl" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="skeleton w-16 h-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <span className="skeleton h-5 w-24 rounded-full" />
          <span className="skeleton h-8 w-4/5 rounded-lg" />
          <span className="skeleton h-9 w-32 rounded-lg" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="skeleton w-9 h-9 rounded-xl" />
            ))}
          </div>
          <span className="skeleton h-12 rounded-2xl" />
          <span className="skeleton h-14 rounded-2xl" />
          <span className="skeleton h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <span className="skeleton h-8 w-56 rounded-lg" />
      <ProductGridSkeleton />
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="טוען">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-orange-100 p-4 flex items-center gap-3">
          <span className="skeleton w-12 h-12 rounded-xl shrink-0" />
          <span className="flex-1 space-y-2">
            <span className="skeleton h-3 w-3/5 rounded" />
            <span className="skeleton h-3 w-2/5 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}
