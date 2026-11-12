import { ArtworkGridSkeleton, Skeleton } from '@/components/loading';

export default function JournalDetailLoading() {
  return (
    <div>
      <header className="page-shell pt-12 md:pt-20 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5 space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-72" />
          </div>
          <div className="lg:col-span-7">
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        </div>
      </header>
      <div className="page-shell pb-20">
        <ArtworkGridSkeleton />
      </div>
    </div>
  );
}
