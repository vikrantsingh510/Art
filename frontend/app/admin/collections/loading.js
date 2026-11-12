import { Skeleton, TableSkeleton } from '@/components/loading';

export default function AdminCollectionsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-64" />
      </div>
      <TableSkeleton columns={7} rows={8} headers={['Cover', 'Name', 'Slug', 'Artworks', 'Status', 'Updated', '']} />
    </div>
  );
}
