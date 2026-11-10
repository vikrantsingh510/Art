import { CollectionGridSkeleton, Skeleton } from '@/components/loading';

export default function CollectionsLoading() {
  return (
    <div>
      <header className="max-w-7xl mx-auto px-6 md:px-16 pt-12 md:pt-20 pb-10 space-y-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <div className="max-w-7xl mx-auto px-6 md:px-16 pb-20">
        <CollectionGridSkeleton />
      </div>
    </div>
  );
}
