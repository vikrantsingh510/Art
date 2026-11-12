import { CollectionGridSkeleton, Skeleton } from '@/components/loading';

export default function ArtistsLoading() {
  return (
    <div>
      <header className="page-shell pt-12 md:pt-20 pb-10 space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-48" />
      </header>
      <div className="page-shell pb-20">
        <CollectionGridSkeleton />
      </div>
    </div>
  );
}
