import Image from 'next/image';
import Link from 'next/link';
import { ArtistInFocus } from '@/components/artist-in-focus';
import { ArtistsToKnow } from '@/components/artists-to-know';
import { ArtworkCard } from '@/components/artwork-card';
import { HomepageFaq } from '@/components/homepage-faq';
import { Reveal } from '@/components/reveal';
import { ErrorState, EmptyState } from '@/components/states';
import { Button } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { loadArtistBySlug, loadHomepageFaq, loadHomepageFeaturedArtist, loadHomepageHero } from '@/lib/gallery-entity-loaders';
import { collectionCoverUrl } from '@/lib/collection-cover';
import { selectHomepageArtworks } from '@/lib/homepage-artworks';
import { hydrateHomepageFeaturedArtist, selectHomepageArtists } from '@/lib/homepage-artists';
import { shouldRenderHomepageFaq } from '@/lib/homepage-faq';

export const metadata = {
  title: 'Exhibition',
};

async function loadHome() {
  try {
    const [featuredLots, latest, categories, collections, artistList, pinnedArtist] = await Promise.all([
      api.listArtworks({ featured: 'true', limit: 8 }),
      api.listArtworks({ limit: 8 }),
      api.listCategories(),
      api.listCollections(),
      api.listArtists({ limit: 8 }),
      loadHomepageFeaturedArtist(),
    ]);
    const { featured, known } = selectHomepageArtists(artistList?.items || [], {
      featuredArtist: pinnedArtist,
    });
    const featuredArtist = await hydrateHomepageFeaturedArtist(
      featured,
      pinnedArtist,
      loadArtistBySlug,
    );
    return {
      artworks: selectHomepageArtworks(featuredLots?.items, latest?.items, { limit: 8 }),
      total: latest?.total || 0,
      categories: Array.isArray(categories) ? categories : [],
      collections: Array.isArray(collections) ? collections : [],
      featuredArtist,
      knownArtists: known,
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
  const [{ artworks, total, categories, collections, featuredArtist, knownArtists, error }, hero, faq] = await Promise.all([
    loadHome(),
    loadHomepageHero(),
    loadHomepageFaq(),
  ]);

  return (
    <div>
      <section className="hero-frame relative w-full -mt-[7.5rem] min-h-[34rem] md:min-h-[52rem] flex flex-col justify-end bg-surface-container-low overflow-hidden">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          priority
          sizes="100vw"
          {...(hero.unoptimized ? { unoptimized: true } : {})}
          className="object-cover object-center brightness-[0.92] contrast-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface/80 via-surface/20 to-transparent" />
        <div className="relative z-10 page-shell pt-44 pb-16">
          <div className="hero-copy max-w-3xl space-y-5">
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

      <section className="page-shell py-20">
        <Reveal className="grid md:grid-cols-2 gap-16" stagger={2}>
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
        </Reveal>
      </section>

      <section className="page-shell pb-20">
        <Reveal stagger={2}>
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
        </Reveal>
      </section>

      <ArtistInFocus artist={featuredArtist} />
      <ArtistsToKnow artists={knownArtists} />

      <section className="bg-stone py-20">
        <div className="page-shell">
          <Reveal stagger={2}>
          <div className="mb-10">
            <p className="label-md text-patina">Taxonomy of form</p>
            <h2 className="font-display text-3xl md:text-4xl mt-2">Explore by medium &amp; series</h2>
          </div>
          {categories.length === 0 && collections.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Categories and collections will appear when the atelier publishes them.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {categories.map((category, index) => (
                <Link key={category.id} href={`/explore?categoryId=${category.id}`} className="editorial-card-link border-t border-fillet pt-4">
                  <p className="label-sm text-patina">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="editorial-card-title font-display text-2xl mt-2">{category.name}</h3>
                  <p className="text-sm text-on-surface-variant mt-2">{category.description || 'Open this series in the archive.'}</p>
                </Link>
              ))}
              {collections.map((collection) => {
                const coverUrl = collectionCoverUrl(collection.coverImagePath, collection.updatedAt);
                return (
                  <Link key={collection.id} href={`/collections/${collection.id}`} className="editorial-card-link border-t border-fillet pt-4">
                    {coverUrl ? (
                      <div className="editorial-image-hover relative aspect-[16/9] mb-4 overflow-hidden bg-surface-container-low">
                        <Image
                          src={coverUrl}
                          alt={collection.name}
                          fill
                          unoptimized
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <p className="label-sm text-patina">Collection</p>
                    <h3 className="editorial-card-title font-display text-2xl mt-2">{collection.name}</h3>
                    <p className="text-sm text-on-surface-variant mt-2">{collection.description || 'View the published hanging.'}</p>
                  </Link>
                );
              })}
            </div>
          )}
          </Reveal>
        </div>
      </section>

      {shouldRenderHomepageFaq(faq) ? (
        <Reveal>
          <HomepageFaq faq={faq} />
        </Reveal>
      ) : null}
    </div>
  );
}
