import Link from 'next/link';
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {collections.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.id}`} className="border-t border-fillet pt-6">
                <p className="label-sm text-patina">{collection.slug}</p>
                <h2 className="font-display text-3xl mt-2">{collection.name}</h2>
                <p className="text-sm text-on-surface-variant mt-3">{collection.description || 'View the published works in this hanging.'}</p>
                {publicStorageUrl(collection.coverImagePath) ? (
                  <p className="label-sm text-bronze mt-4">Cover catalogued</p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
