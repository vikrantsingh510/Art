import { FormSkeleton, Skeleton } from '@/components/loading';

export default function CheckoutLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 md:px-16 py-12 space-y-8">
      <Skeleton className="h-10 w-64" />
      <FormSkeleton fields={4} />
    </div>
  );
}
