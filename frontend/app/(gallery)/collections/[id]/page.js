import { notFound } from 'next/navigation';
import { ArtworkCard } from '@/components/artwork-card';
import { EmptyState, ErrorState } from '@/components/states';
import { PageIntro } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const collection = await api.getCollection(id);
    return { title: collection.name };
  } catch {
    return { title: 'Collection' };
  }
}

export default async function CollectionDetailPage({ params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  let collection;
  let artworks = [];
  try {
    collection = await api.getCollection(id);
    const list = await api.listArtworks({ collectionId: id, limit: 50 });
    artworks = list.items || [];
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

  return (
    <div>
      <PageIntro eyebrow="Published hanging" title={collection.name} description={collection.description} />
      <div className="page-shell pb-20">
        {artworks.length === 0 ? (
          <EmptyState title="This hanging has no published works yet" />
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
