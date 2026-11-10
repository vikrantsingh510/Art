import { FormSkeleton, Skeleton } from '@/components/loading';

export default function CheckoutLoading() {
  return (
    <div className="page-shell py-12">
      <div className="max-w-3xl space-y-8">
      <Skeleton className="h-10 w-64" />
      <FormSkeleton fields={4} />
      </div>
    </div>
  );
}
