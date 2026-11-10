import { ListRowSkeleton, Skeleton } from '@/components/loading';

export default function AdminCustomersLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-48" />
      </div>
      <ListRowSkeleton />
    </div>
  );
}
