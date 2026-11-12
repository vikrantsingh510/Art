import Image from 'next/image';
import Link from 'next/link';
import { ImagePlaceholder } from '@/components/loading';
import { EmptyState, ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { publicStorageUrl } from '@/lib/media';

export const metadata = { title: 'Collections' };

export default async function CollectionsPage() {
  let collections = [];
  let error = null;
  try {
    collections = await api.listCollections();
  } catch (caught) {
    error = caught instanceof ApiClientError ? caught : new ApiClientError(caught.message);
  }

  return (
    <div>
      <header className="page-shell pt-12 md:pt-20 pb-10 space-y-4">
        <p className="label-sm text-patina">Published hangings</p>
        <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">Collections</h1>
      </header>
      <div className="page-shell pb-20">
        {error ? <ErrorState error={error} retryHref="/collections" /> : null}
        {!error && collections.length === 0 ? (
          <EmptyState title="No published collections" description="When a hanging is released, it will appear here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {collections.map((collection) => {
              const coverUrl = publicStorageUrl(collection.coverImagePath);
              return (
                <Link key={collection.id} href={`/collections/${collection.id}`} className="border-t border-fillet pt-6 space-y-4">
                  {coverUrl ? (
                    <div className="relative aspect-[16/9] bg-surface-container-low">
                      <Image
                        src={coverUrl}
                        alt={collection.name}
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <ImagePlaceholder className="max-w-md" label="No cover" />
                  )}
                  <p className="label-sm text-patina">{collection.slug}</p>
                  <h2 className="font-display text-3xl italic leading-tight">{collection.name}</h2>
                  <p className="text-sm text-on-surface-variant">
                    {collection.description || 'View the published works in this hanging.'}
                  </p>
                  <p className="label-sm text-bronze">View the hanging</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
