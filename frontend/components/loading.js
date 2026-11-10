export function Skeleton({ className = '' }) {
  return <div className={`skeleton-block ${className}`} aria-hidden="true" />;
}

export function ImagePlaceholder({ className = '', label = null }) {
  return (
    <div className={`bg-surface-container-low ${className}`}>
      <div className="aspect-[4/5] flex items-end p-4">
        {label ? <p className="label-sm text-patina">{label}</p> : null}
      </div>
    </div>
  );
}

export function InlineLoader({ label = 'Loading' }) {
  return (
    <p className="label-md text-patina" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function ButtonLoader({ label }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="btn-pending-mark" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function ActionStatus({ pending, pendingLabel = 'Working', message, error, variant = 'notice' }) {
  const announcement = pending ? pendingLabel : (error || message || '');
  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      {variant === 'notice' && message ? <p className="notice">{message}</p> : null}
      {variant === 'notice' && error ? <p className="notice notice-error">{error}</p> : null}
      {variant === 'inline' && error ? <p className="text-xs text-error mt-2 w-full">{error}</p> : null}
    </>
  );
}

export function PageLoader({ label = 'Opening the salon…' }) {
  return (
    <div className="min-h-[40vh] bg-surface" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SectionSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-2/3 max-w-md" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={`h-3 ${index === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function ArtworkCardSkeleton() {
  return (
    <article className="space-y-4" aria-hidden="true">
      <ImagePlaceholder />
      <Skeleton className="h-2 w-20" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <hr className="hairline" />
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-4 w-24" />
    </article>
  );
}

export function ArtworkGridSkeleton({
  count = 6,
  className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16',
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-label="Loading artworks">
      {Array.from({ length: count }).map((_, index) => (
        <ArtworkCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function ArtworkDetailSkeleton() {
  return (
    <div className="page-shell py-10 md:py-16" role="status" aria-live="polite" aria-label="Loading artwork">
      <Skeleton className="h-3 w-40 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7">
          <ImagePlaceholder />
        </div>
        <aside className="lg:col-span-5 space-y-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-5/6" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-3 border-t border-fillet pt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </aside>
      </div>
    </div>
  );
}

export function CollectionCardSkeleton() {
  return (
    <div className="border-t border-fillet pt-6 space-y-3" aria-hidden="true">
      <Skeleton className="h-2 w-24" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function CollectionGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10" role="status" aria-live="polite" aria-label="Loading collections">
      {Array.from({ length: count }).map((_, index) => (
        <CollectionCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function HomeSalonSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading exhibition">
      <div className="hero-frame relative w-full -mt-[7.5rem] min-h-[34rem] md:min-h-[52rem] bg-surface-container-low" />
      <section className="page-shell py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-9 w-72" />
          </div>
        </div>
        <ArtworkGridSkeleton count={3} />
      </section>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-live="polite" aria-label="Loading dashboard">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="border border-fillet p-5 bg-stone space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40" />
          </article>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex justify-between border-b border-fillet py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ columns = 4, rows = 8, headers = null }) {
  const labels = headers || Array.from({ length: columns }).map(() => '');
  return (
    <div className="overflow-x-auto" role="status" aria-live="polite" aria-label="Loading records">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="label-md text-patina border-b border-fillet">
            {labels.map((label, index) => (
              <th key={index} className="py-3">{label || <Skeleton className="h-3 w-16" />}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-fillet">
              {labels.map((_, cellIndex) => (
                <td key={cellIndex} className="py-4">
                  <Skeleton className={`h-4 ${cellIndex === 0 ? 'w-40' : 'w-24'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListRowSkeleton({ count = 6 }) {
  return (
    <ul className="divide-y divide-fillet border-y border-fillet" role="status" aria-live="polite" aria-label="Loading list">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="py-4 flex justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OrderListSkeleton({ count = 4 }) {
  return (
    <ul className="space-y-4" role="status" aria-live="polite" aria-label="Loading orders">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="border border-fillet p-5 space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </li>
      ))}
    </ul>
  );
}

export function FormSkeleton({ fields = 6 }) {
  return (
    <div className="space-y-6 max-w-3xl" role="status" aria-live="polite" aria-label="Loading form">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-10 w-72" />
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-40" />
    </div>
  );
}

export function AccountPanelSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading account">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border border-fillet p-6 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div className="page-shell py-12 space-y-8" role="status" aria-live="polite" aria-label="Loading bag">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-16 w-full" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex justify-between gap-4 border-b border-fillet pb-6">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-8 max-w-4xl" role="status" aria-live="polite" aria-label="Loading details">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
