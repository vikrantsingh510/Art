import { ArtworkGridSkeleton, Skeleton } from '@/components/loading';

export default function ArtistDetailLoading() {
  return (
    <div>
      <header className="page-shell pt-6 pb-20">
        <Skeleton className="h-3 w-48 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-5">
            <Skeleton className="aspect-[4/5] lg:aspect-[3/4] w-full" />
          </div>
          <div className="lg:col-span-7 space-y-4 pt-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-4 w-2/3 max-w-xl" />
          </div>
        </div>
      </header>
      <div className="page-shell pb-20">
        <ArtworkGridSkeleton />
      </div>
    </div>
  );
}
