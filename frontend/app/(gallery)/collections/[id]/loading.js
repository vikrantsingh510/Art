import { ArtworkGridSkeleton, Skeleton } from '@/components/loading';

export default function CollectionDetailLoading() {
  return (
    <div>
      <header className="page-shell pt-12 md:pt-20 pb-10 space-y-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <div className="page-shell pb-20">
        <ArtworkGridSkeleton />
      </div>
    </div>
  );
}
