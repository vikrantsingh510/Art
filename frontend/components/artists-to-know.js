import Image from 'next/image';
import Link from 'next/link';
import { ArtistEditorialLinks } from '@/components/artist-editorial-links';
import { artistCategoryLabel, artistExcerpt } from '@/lib/homepage-artists';
import { publicStorageUrl } from '@/lib/media';

function ArtistsToKnowCard({ artist }) {
  const portraitUrl = publicStorageUrl(artist.profileImagePath);
  const category = artistCategoryLabel(artist);
  const bio = artistExcerpt(artist.shortBio || artist.biography, 140);
  const showStory = Boolean(artist.biography || artist.shortBio);

  return (
    <article className="relative min-h-[28rem] md:min-h-[32rem] overflow-hidden bg-olive text-ivory">
      {portraitUrl ? (
        <Image
          src={portraitUrl}
          alt={artist.profileImageAlt || `Portrait of ${artist.name}`}
          fill
          unoptimized
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover object-[center_18%]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/25 to-transparent" />
      <div className="relative z-10 flex h-full min-h-[28rem] md:min-h-[32rem] flex-col justify-end p-6 md:p-8 space-y-3">
        {category ? <p className="label-sm text-bronze">{category}</p> : null}
        <h3 className="font-display text-[28px] md:text-[32px] leading-tight text-ivory">
          <Link href={`/artists/${artist.slug}`}>{artist.name}</Link>
        </h3>
        {bio ? (
          <p className="text-[14px] leading-6 text-ivory/80 max-w-sm">{bio}</p>
        ) : null}
        <ArtistEditorialLinks artist={artist} showStory={showStory} tone="light" />
      </div>
    </article>
  );
}

export function ArtistsToKnow({ artists }) {
  const items = Array.isArray(artists) ? artists : [];
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="artists-to-know-heading" className="bg-surface">
      <div className="page-shell py-16 md:py-24">
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16 items-end mb-10 md:mb-14">
          <div className="lg:col-span-7 space-y-3">
            <p className="label-sm text-bronze">Artists to know</p>
            <h2
              id="artists-to-know-heading"
              className="font-display text-3xl md:text-[40px] leading-tight tracking-[-0.015em] text-ink"
            >
              Meet the hands behind the work.
            </h2>
          </div>
          <p className="lg:col-span-5 lg:text-right text-[15px] leading-6 text-on-surface-variant max-w-md lg:ml-auto">
            Published painters currently catalogued in the salon. Each profile lists only works that are on view.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {items.map((artist) => (
            <ArtistsToKnowCard key={artist.id} artist={artist} />
          ))}
        </div>
      </div>
    </section>
  );
}
