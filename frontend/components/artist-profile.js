import Image from 'next/image';
import Link from 'next/link';
import { MarkdownBody } from '@/components/markdown-body';
import { Button } from '@/components/ui';
import { availabilityLabel, formatDimensions } from '@/lib/format';
import { artworkStorefrontImageUrl, primaryArtworkImage, publicStorageUrl } from '@/lib/media';
import { formatInrFromPaise } from '@/lib/money';

function practiceCards(artist) {
  return [
    artist.artisticStyle ? { label: 'Artistic style', value: artist.artisticStyle } : null,
    artist.medium ? { label: 'Preferred medium', value: artist.medium } : null,
    artist.location ? { label: 'Studio location', value: artist.location } : null,
  ].filter(Boolean);
}

function FeaturedWork({ artwork }) {
  const image = primaryArtworkImage(artwork);
  const imageUrl = artworkStorefrontImageUrl(artwork, image);
  const dimensions = formatDimensions(artwork);
  const available = availabilityLabel(artwork);

  return (
    <div className="bg-surface border border-fillet p-6 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <Link href={`/artwork/${artwork.id}`} className="lg:col-span-7 bg-surface-container relative overflow-hidden block min-w-0">
          <div className="relative aspect-[16/11] w-full">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={image?.altText || artwork.title}
                fill
                unoptimized
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-contain artwork-image-hover"
              />
            ) : (
              <div className="absolute inset-0 bg-surface-container-low" />
            )}
          </div>
        </Link>
        <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-6 min-w-0">
          <div>
            <p className="label-sm text-bronze mb-2">{available}</p>
            <h3 className="font-display text-[28px] italic leading-9 text-ink mb-3">
              <Link href={`/artwork/${artwork.id}`}>{artwork.title}</Link>
            </h3>
            {artwork.story ? (
              <p className="text-[15px] leading-6 text-on-surface-variant mb-6 line-clamp-3">{artwork.story}</p>
            ) : null}
            <div className="space-y-2 py-4 border-y border-fillet text-sm">
              {artwork.medium ? (
                <div className="flex justify-between gap-4 py-1">
                  <span className="text-outline">Medium</span>
                  <span className="text-ink text-right">{artwork.medium}</span>
                </div>
              ) : null}
              {dimensions ? (
                <div className="flex justify-between gap-4 py-1">
                  <span className="text-outline">Dimensions</span>
                  <span className="text-ink text-right">{dimensions}</span>
                </div>
              ) : null}
              {artwork.yearCreated ? (
                <div className="flex justify-between gap-4 py-1">
                  <span className="text-outline">Year</span>
                  <span className="text-ink text-right">{artwork.yearCreated}</span>
                </div>
              ) : null}
            </div>
            <div className="pt-6">
              <p className="label-sm text-outline">Salon valuation</p>
              <p className="font-display text-[22px] text-ink mt-1">{formatInrFromPaise(artwork.pricePaise)}</p>
            </div>
          </div>
          <Button href={`/artwork/${artwork.id}`} className="w-full sm:w-auto">
            View this work
          </Button>
        </div>
      </div>
    </div>
  );
}

function ArtistWorkTile({ artwork }) {
  const image = primaryArtworkImage(artwork);
  const imageUrl = artworkStorefrontImageUrl(artwork, image);
  const dimensions = formatDimensions(artwork);
  const available = availabilityLabel(artwork);
  const meta = [artwork.medium, dimensions].filter(Boolean).join(' · ');

  return (
    <article className="bg-surface border border-fillet flex flex-col justify-between min-w-0">
      <div>
        <Link href={`/artwork/${artwork.id}`} className="block relative aspect-[4/3] bg-surface-container overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={image?.altText || artwork.title}
              fill
              unoptimized
              sizes="(min-width: 1024px) 30vw, 100vw"
              className="object-contain artwork-image-hover"
            />
          ) : null}
          <span className="absolute top-3 right-3 bg-surface/90 label-sm text-ink uppercase tracking-widest px-2.5 py-1">
            {available}
          </span>
        </Link>
        <div className="p-6 space-y-2">
          {dimensions ? (
            <p className="label-sm text-outline uppercase tracking-wider">{dimensions}</p>
          ) : null}
          <h3 className="font-display text-[22px] italic leading-8 text-ink">
            <Link href={`/artwork/${artwork.id}`}>{artwork.title}</Link>
          </h3>
          {meta ? <p className="text-[13px] leading-5 text-on-surface-variant">{meta}</p> : null}
          <div className="pt-4 border-t border-fillet flex justify-between items-baseline gap-3">
            <span className="label-sm text-outline">Valuation</span>
            <span className="font-display text-[18px] text-ink">{formatInrFromPaise(artwork.pricePaise)}</span>
          </div>
        </div>
      </div>
      <div className="px-6 pb-6 pt-2">
        <Button href={`/artwork/${artwork.id}`} variant="secondary" className="w-full">
          Inspect artwork
        </Button>
      </div>
    </article>
  );
}

function PeerArtist({ artist }) {
  const portraitUrl = publicStorageUrl(artist.profileImagePath);
  return (
    <Link
      href={`/artists/${artist.slug}`}
      className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 md:p-5 md:bg-surface md:border md:border-fillet md:hover:border-bronze transition-colors duration-300 min-w-0"
    >
      <div className="relative aspect-square md:w-16 md:h-16 md:aspect-auto shrink-0 bg-surface-container overflow-hidden">
        {portraitUrl ? (
          <Image
            src={portraitUrl}
            alt={artist.profileImageAlt || artist.name}
            fill
            unoptimized
            sizes="(min-width: 768px) 64px, 30vw"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        {artist.artisticStyle ? (
          <p className="hidden md:block label-sm text-outline mb-1 truncate">{artist.artisticStyle}</p>
        ) : null}
        <h3 className="font-display text-[15px] md:text-lg text-ink truncate">{artist.name}</h3>
        {artist.location ? (
          <p className="label-sm text-patina mt-1 truncate">{artist.location}</p>
        ) : artist.medium ? (
          <p className="hidden md:block text-[12px] text-on-surface-variant mt-1 truncate">{artist.medium}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function ArtistProfile({ artist, peers = [] }) {
  const portraitUrl = publicStorageUrl(artist.profileImagePath);
  const works = Array.isArray(artist.artworks) ? artist.artworks : [];
  const featured = works[0] || null;
  const remaining = works.slice(1);
  const cards = practiceCards(artist);
  const caption = artist.profileImageAlt || null;
  const availableCount = works.filter((work) => work.isPurchasable).length;
  const acquiredCount = works.filter((work) => work.status === 'sold').length;

  return (
    <article className="overflow-x-hidden">
      <div className="page-shell pt-6 pb-8">
        <nav aria-label="Breadcrumbs" className="label-sm text-patina flex flex-wrap items-center gap-2 uppercase tracking-[0.16em]">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span className="text-outline-variant">/</span>
          <Link href="/artists" className="hover:text-ink">Artists</Link>
          <span className="text-outline-variant">/</span>
          <span className="text-ink">{artist.name}</span>
        </nav>
      </div>

      <header className="page-shell pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          <div className="lg:col-span-5 min-w-0">
            {portraitUrl ? (
              <div className="bg-surface-container-low p-0 lg:p-4 lg:border lg:border-outline-variant/40">
                <div className="relative aspect-[4/5] lg:aspect-[3/4] overflow-hidden bg-surface-container">
                  <Image
                    src={portraitUrl}
                    alt={caption || artist.name}
                    fill
                    unoptimized
                    priority
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover artwork-image-hover"
                  />
                </div>
                {caption ? (
                  <p className="hidden lg:block mt-4 label-sm text-patina uppercase tracking-wider">{caption}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between pt-2 lg:pl-4 min-w-0">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="h-px w-8 bg-bronze" />
                <p className="label-sm text-bronze">Artist profile</p>
              </div>
              <h1 className="font-display text-[30px] md:text-[40px] lg:text-[48px] leading-tight text-ink mb-3">
                {artist.name}
              </h1>
              {artist.location ? (
                <p className="label-md text-on-surface uppercase tracking-[0.16em] mb-6">{artist.location}</p>
              ) : null}
              {artist.shortBio ? (
                <p className="text-[18px] leading-[30px] font-light text-on-surface mb-8 max-w-2xl">
                  {artist.shortBio}
                </p>
              ) : null}
              {cards.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 lg:gap-4 py-0 lg:py-6 lg:border-y lg:border-fillet mb-8 lg:bg-surface-container-low/40 lg:px-4">
                  {cards.map((card) => (
                    <div key={card.label} className="space-y-1 bg-surface-container-low lg:bg-transparent p-3 lg:p-0">
                      <p className="label-sm text-patina">{card.label}</p>
                      <p className="text-[13px] lg:text-[15px] text-ink">{card.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                {works.length > 0 ? (
                  <Button href="#works" className="w-full sm:w-auto">
                    Explore published works ({works.length})
                  </Button>
                ) : null}
                {artist.biography ? (
                  <Button href="#story" variant="secondary" className="w-full sm:w-auto">
                    Read artist’s story
                  </Button>
                ) : null}
              </div>
              <p>
                <Link href="/contact" className="text-link">
                  Curatorial inquiry
                </Link>
              </p>
            </div>
          </div>
        </div>
      </header>

      {artist.biography ? (
        <section id="story" className="w-full bg-surface-container-low py-20 border-y border-fillet scroll-mt-28">
          <div className="page-shell">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-px w-6 bg-bronze" />
                  <p className="label-sm text-bronze">Monograph</p>
                </div>
                <h2 className="font-display text-[30px] md:text-[40px] leading-tight text-ink">
                  The story behind the work.
                </h2>
              </div>
              <div className="lg:col-span-7 artist-story-body min-w-0">
                <MarkdownBody markdown={artist.biography} />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div id="story" className="scroll-mt-28" />
      )}

      {cards.length > 0 ? (
        <section className="page-shell py-20">
          <div className="mb-8">
            <p className="label-sm text-bronze mb-2">Technical discipline</p>
            <h2 className="font-display text-[28px] leading-9 text-ink">Inside the artist’s practice</h2>
          </div>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${cards.length > 2 ? 'lg:grid-cols-3' : ''} gap-4`}>
            {cards.map((card) => (
              <div key={card.label} className="p-6 bg-surface-container border border-fillet">
                <p className="label-sm text-patina mb-1">{card.label}</p>
                <h3 className="font-display text-[22px] leading-8 text-ink">{card.value}</h3>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section id="works" className="w-full bg-surface-container-low/60 py-20 border-t border-fillet scroll-mt-28">
        <div className="page-shell space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl min-w-0">
              <div className="flex items-center gap-3">
                <span className="h-px w-6 bg-bronze" />
                <p className="label-sm text-bronze">On view</p>
              </div>
              <h2 className="font-display text-[30px] md:text-[40px] leading-tight text-ink">Selected works</h2>
              <p className="text-[15px] leading-6 text-on-surface-variant">
                Original paintings catalogued for {artist.name}. Only published lots appear here.
              </p>
            </div>
            {works.length > 0 ? (
              <div className="flex flex-wrap items-center gap-4 label-sm text-on-surface-variant uppercase tracking-widest">
                {availableCount > 0 ? <span>{availableCount} available</span> : null}
                {acquiredCount > 0 ? <span>{acquiredCount} acquired</span> : null}
              </div>
            ) : null}
          </div>
          {works.length > 0 ? (
            <div className="space-y-8">
              {featured ? <FeaturedWork artwork={featured} /> : null}
              {remaining.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
                  {remaining.map((artwork) => (
                    <ArtistWorkTile key={artwork.id} artwork={artwork} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">No published works are currently associated with this artist.</p>
          )}
        </div>
      </section>

      <section className="w-full bg-surface-container-low py-20 border-t border-fillet">
        <div className="page-shell">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-12">
            <p className="label-sm text-bronze">Curatorial continuity</p>
            <h2 className="font-display text-[30px] md:text-[40px] leading-tight text-ink">Discover more original art.</h2>
            <p className="text-[15px] leading-6 text-on-surface-variant">
              Continue through the salon’s published artists and the permanent collection.
            </p>
          </div>
          {peers.length > 0 ? (
            <div className="grid grid-cols-3 gap-2.5 md:gap-6 mb-12">
              {peers.map((peer) => (
                <PeerArtist key={peer.id} artist={peer} />
              ))}
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button href="/explore" className="w-full sm:w-auto">Explore art</Button>
            <Button href="/artists" variant="secondary" className="w-full sm:w-auto">View all artists</Button>
          </div>
        </div>
      </section>
    </article>
  );
}
