import { FormSkeleton, ListRowSkeleton, Skeleton } from '@/components/loading';

export default function AddressesLoading() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-10 w-48" />
      <ListRowSkeleton count={2} />
      <FormSkeleton fields={5} />
    </div>
  );
}
