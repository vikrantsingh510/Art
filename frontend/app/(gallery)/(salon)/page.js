import Image from 'next/image';
import Link from 'next/link';
import { ArtistInFocus } from '@/components/artist-in-focus';
import { ArtistsToKnow } from '@/components/artists-to-know';
import { ArtworkCard } from '@/components/artwork-card';
import { ErrorState, EmptyState } from '@/components/states';
import { Button } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { selectHomepageArtworks } from '@/lib/homepage-artworks';
import { selectHomepageArtists } from '@/lib/homepage-artists';

export const metadata = {
  title: 'Exhibition',
};

async function loadPublishedArtists() {
  try {
    const data = await api.listArtists({ limit: 8 });
    const { featured, known } = selectHomepageArtists(data?.items || []);
    if (!featured?.slug) {
      return { featured: null, known };
    }
    try {
      const detail = await api.getArtist(featured.slug);
      return { featured: detail, known };
    } catch {
      return { featured, known };
    }
  } catch {
    return { featured: null, known: [] };
  }
}

async function loadHome() {
  try {
    const [featured, latest, categories, collections, artists] = await Promise.all([
      api.listArtworks({ featured: 'true', limit: 8 }),
      api.listArtworks({ limit: 8 }),
      api.listCategories(),
      api.listCollections(),
      loadPublishedArtists(),
    ]);
    return {
      artworks: selectHomepageArtworks(featured?.items, latest?.items, { limit: 8 }),
      total: latest?.total || 0,
      categories: Array.isArray(categories) ? categories : [],
      collections: Array.isArray(collections) ? collections : [],
      featuredArtist: artists.featured,
      knownArtists: artists.known,
      error: null,
    };
  } catch (error) {
    return {
      artworks: [],
      total: 0,
      categories: [],
      collections: [],
      featuredArtist: null,
      knownArtists: [],
      error: error instanceof ApiClientError ? error : new ApiClientError(error.message),
    };
  }
}

export default async function HomePage() {
  const { artworks, total, categories, collections, featuredArtist, knownArtists, error } = await loadHome();

  return (
    <div>
      <section className="hero-frame relative w-full -mt-[7.5rem] min-h-[34rem] md:min-h-[52rem] flex flex-col justify-end bg-surface-container-low overflow-hidden">
        <Image
          src="/images/hero-salon.png"
          alt="Museum gallery exhibition of large-scale original textured paintings"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center brightness-[0.92] contrast-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface/80 via-surface/20 to-transparent" />
        <div className="relative z-10 page-shell pt-44 pb-16">
          <div className="max-w-3xl space-y-5">
            <p className="inline-flex items-center gap-3 bg-surface/90 px-3.5 py-1.5 label-sm text-on-surface-variant">
              <span className="w-1.5 h-1.5 bg-secondary" />
              Current Curation / Vérité Salon
            </p>
            <h1 className="font-display text-[38px] md:text-[56px] leading-[1.15] tracking-[-0.02em] text-ink">
              Art That Transcends<br />Space &amp; Silence
            </h1>
            <p className="max-w-xl text-[15px] md:text-lg leading-7 text-on-surface-variant">
              A private sanctuary of authentic, hand-painted original works. Every piece is an irreplaceable singular creation accompanied by verified provenance.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/explore">Explore current exhibition</Button>
              <Button href="/about" variant="secondary">Discover our philosophy</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-20 grid md:grid-cols-2 gap-16">
        <div>
          <p className="label-md text-patina">The Maison manifesto</p>
          <h2 className="font-display text-4xl leading-tight mt-4">Solitary devotion, uncompromised permanence.</h2>
        </div>
        <div className="space-y-6 text-[15px] leading-7 text-on-surface-variant">
          <p>
            In an era inundated with ephemeral digital reproductions, Maison d&apos;Art stands as an architectural haven for raw pigment, hand-hewn organic textiles, and the unmistakable tactile truth of original brushwork.
          </p>
          <p>
            Every creation displayed in our salon is an irreproducible dialogue between painter and surface—finished with archival varnishes and sealed for generational permanence.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div>
              <p className="font-display text-3xl">100%</p>
              <p className="label-sm text-patina mt-2">Singular originals</p>
            </div>
            <div>
              <p className="font-display text-3xl">1 of 1</p>
              <p className="label-sm text-patina mt-2">No reproductions</p>
            </div>
            <div>
              <p className="font-display text-3xl">INR</p>
              <p className="label-sm text-patina mt-2">Atelier-direct</p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="label-md text-patina">Archival salon catalogue</p>
            <h2 className="font-display text-3xl md:text-4xl mt-2">Selected singular acquisitions</h2>
          </div>
          <Button href="/explore" variant="secondary">View all works {total ? `(${total})` : ''}</Button>
        </div>
        {error ? (
          <ErrorState error={error} retryHref="/" />
        ) : artworks.length === 0 ? (
          <EmptyState
            title="The salon is between hangings"
            description="No published artworks are available yet. When the atelier releases a work, it will appear here."
            action={<Button href="/contact" variant="secondary">Make an inquiry</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {artworks.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        )}
      </section>

      <ArtistInFocus artist={featuredArtist} />
      <ArtistsToKnow artists={knownArtists} />

      <section className="bg-stone py-20">
        <div className="page-shell">
          <p className="label-md text-patina">Taxonomy of form</p>
          <h2 className="font-display text-3xl md:text-4xl mt-2 mb-10">Explore by medium &amp; series</h2>
          {categories.length === 0 && collections.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Categories and collections will appear when the atelier publishes them.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {categories.map((category, index) => (
                <Link key={category.id} href={`/explore?categoryId=${category.id}`} className="border-t border-fillet pt-4">
                  <p className="label-sm text-patina">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="font-display text-2xl mt-2">{category.name}</h3>
                  <p className="text-sm text-on-surface-variant mt-2">{category.description || 'Open this series in the archive.'}</p>
                </Link>
              ))}
              {collections.map((collection) => (
                <Link key={collection.id} href={`/collections/${collection.id}`} className="border-t border-fillet pt-4">
                  <p className="label-sm text-patina">Collection</p>
                  <h3 className="font-display text-2xl mt-2">{collection.name}</h3>
                  <p className="text-sm text-on-surface-variant mt-2">{collection.description || 'View the published hanging.'}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
