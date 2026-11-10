import { OrderListSkeleton, Skeleton } from '@/components/loading';

export default function OrdersLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-40" />
      <OrderListSkeleton />
    </div>
  );
}
