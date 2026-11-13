import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArtworkCard } from '@/components/artwork-card';
import { ImagePlaceholder } from '@/components/loading';
import { EmptyState, ErrorState } from '@/components/states';
import { PageIntro } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { loadCollectionById } from '@/lib/gallery-entity-loaders';
import { publicStorageUrl } from '@/lib/media';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const collection = await loadCollectionById(id);
    return { title: collection.name };
  } catch {
    return { title: 'Collection' };
  }
}

function sortByCollectionOrder(items, artworkIds) {
  const order = new Map((artworkIds || []).map((id, index) => [id, index]));
  return [...items].sort((left, right) => {
    const leftOrder = order.has(left.id) ? order.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right.id) ? order.get(right.id) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

export default async function CollectionDetailPage({ params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  let collection;
  let artworks = [];
  try {
    collection = await loadCollectionById(id);
    const list = await api.listArtworks({ collectionId: id, limit: 100 });
    artworks = sortByCollectionOrder(list.items || [], collection.artworkIds);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return (
      <div className="page-shell py-16">
        <ErrorState error={error} retryHref={`/collections/${id}`} />
      </div>
    );
  }

  const coverUrl = publicStorageUrl(collection.coverImagePath);

  return (
    <div>
      <PageIntro eyebrow="Published hanging" title={collection.name} description={collection.description} />
      <div className="page-shell pb-20 space-y-16">
        {coverUrl ? (
          <div className="relative aspect-[16/9] max-w-4xl bg-surface-container-low">
            <Image
              src={coverUrl}
              alt={collection.name}
              fill
              unoptimized
              sizes="(min-width: 1024px) 64vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <ImagePlaceholder className="max-w-md" label="No cover" />
        )}
        {artworks.length === 0 ? (
          <EmptyState title="This hanging has no published works yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {artworks.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
