import { ArtworkGridSkeleton, Skeleton } from '@/components/loading';

export default function WishlistLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-40" />
      <ArtworkGridSkeleton count={4} className="grid grid-cols-1 md:grid-cols-2 gap-10" />
    </div>
  );
}
