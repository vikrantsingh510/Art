import { Skeleton, TableSkeleton } from '@/components/loading';

export default function AdminOrdersLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-72" />
      </div>
      <TableSkeleton columns={7} rows={8} headers={['Order', 'Placed', 'Collector', 'Items', 'Total', 'Status', 'Payment']} />
    </div>
  );
}
