import { Skeleton } from '@/components/loading';

export default function AdminEditCollectionLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-80" />
      </div>
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
