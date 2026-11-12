import { ArtistCard } from '@/components/artist-card';
import { EmptyState, ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { canonicalFor } from '@/lib/journal-origin';

export async function generateMetadata() {
  const canonical = await canonicalFor('/artists');
  return {
    title: 'Artists',
    description: 'Atelier artists whose original works are catalogued at Maison d’Art.',
    alternates: { canonical },
    openGraph: {
      title: 'Artists',
      description: 'Atelier artists whose original works are catalogued at Maison d’Art.',
      url: canonical,
      type: 'website',
    },
  };
}

export default async function ArtistsPage() {
  let data = { items: [] };
  let error = null;
  try {
    data = await api.listArtists({ limit: 48 });
  } catch (caught) {
    error = caught instanceof ApiClientError ? caught : new ApiClientError(caught.message);
  }

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div>
      <header className="page-shell pt-12 md:pt-20 pb-10 space-y-4">
        <p className="label-sm text-patina">Atelier</p>
        <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">Artists</h1>
        <p className="max-w-xl text-[15px] leading-6 text-on-surface-variant">
          The painters whose original works are on view. Only published lots appear on each profile.
        </p>
      </header>
      <div className="page-shell pb-20">
        {error ? <ErrorState error={error} retryHref="/artists" /> : null}
        {!error && items.length === 0 ? (
          <EmptyState title="No artists on view" description="When an artist is published, they will appear here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {items.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
