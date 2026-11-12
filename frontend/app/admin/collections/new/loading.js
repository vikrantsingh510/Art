import { Skeleton } from '@/components/loading';

export default function AdminNewCollectionLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
