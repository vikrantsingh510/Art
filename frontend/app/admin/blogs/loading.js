import { Skeleton, TableSkeleton } from '@/components/loading';

export default function AdminBlogsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-64" />
      </div>
      <TableSkeleton columns={5} rows={8} headers={['Title', 'Slug', 'Status', 'Published', '']} />
    </div>
  );
}
