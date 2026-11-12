import { ArtworkCard } from '@/components/artwork-card';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { exploreHasActiveFilters, exploreHref, parseExploreQuery } from '@/lib/explore-query';

export const metadata = {
  title: 'Explore Art',
};

export default async function ExplorePage({ searchParams }) {
  const params = parseExploreQuery(await searchParams);

  let artworks = { items: [], total: 0, page: 1, limit: 18 };
  let error = null;

  try {
    artworks = await api.listArtworks({
      q: params.q,
      categoryId: params.categoryId,
      collectionId: params.collectionId,
      minPricePaise: params.minPricePaise,
      maxPricePaise: params.maxPricePaise,
      featured: params.featured,
      page: params.page,
      limit: params.limit,
    });
  } catch (caught) {
    error = caught instanceof ApiClientError ? caught : new ApiClientError(caught.message);
  }

  if (error) {
    return <ErrorState error={error} retryHref="/explore" />;
  }

  if (artworks.items.length === 0) {
    return (
      <EmptyState
        title="No works match this hanging"
        description="Clear filters or inquire with the atelier. Results are never invented."
        action={exploreHasActiveFilters(params) ? (
          <Button href="/explore" variant="secondary">Clear all filters</Button>
        ) : null}
      />
    );
  }

  return (
    <>
      <p className="label-md text-patina">Showing {artworks.items.length} of {artworks.total} singular originals</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
        {artworks.items.map((artwork) => (
          <ArtworkCard key={artwork.id} artwork={artwork} />
        ))}
      </div>
      <Pagination
        page={artworks.page}
        limit={artworks.limit}
        total={artworks.total}
        makeHref={(page) => exploreHref(params, page)}
      />
    </>
  );
}
