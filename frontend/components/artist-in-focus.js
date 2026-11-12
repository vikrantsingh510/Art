import Image from 'next/image';
import { ArtistEditorialLinks } from '@/components/artist-editorial-links';
import { artistFocusCopy } from '@/lib/homepage-artists';
import { publicStorageUrl } from '@/lib/media';

export function ArtistInFocus({ artist }) {
  if (!artist) {
    return null;
  }

  const portraitUrl = publicStorageUrl(artist.profileImagePath);
  const { headline, body } = artistFocusCopy(artist);
  const showStory = Boolean(artist.biography || artist.shortBio);

  return (
    <section aria-labelledby="artist-in-focus-heading" className="w-full">
      <div className="artist-in-focus-frame grid grid-cols-1 lg:grid-cols-2">
        <div className="artist-in-focus-portrait relative bg-charcoal overflow-hidden">
          {portraitUrl ? (
            <Image
              src={portraitUrl}
              alt={artist.profileImageAlt || `Portrait of ${artist.name}`}
              fill
              unoptimized
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-[center_20%]"
            />
          ) : (
            <div className="absolute inset-0 bg-charcoal" aria-hidden="true" />
          )}
        </div>
        <div className="artist-in-focus-copy bg-olive text-ivory">
          <div className="artist-in-focus-copy-inner">
            <p className="label-sm text-bronze">Artist in Focus · This month&apos;s discovery</p>
            {headline ? (
              <h2
                id="artist-in-focus-heading"
                className="font-display text-[28px] md:text-[34px] lg:text-[38px] leading-[1.2] tracking-[-0.015em] text-ivory"
              >
                {headline}
              </h2>
            ) : (
              <h2
                id="artist-in-focus-heading"
                className="font-display text-[28px] md:text-[34px] lg:text-[38px] leading-[1.2] tracking-[-0.015em] text-ivory"
              >
                {artist.name}
              </h2>
            )}
            {body ? (
              <p className="artist-in-focus-lede text-[15px] md:text-[16px] leading-7 text-ivory/75 font-light">
                {body}
              </p>
            ) : null}
            <div className="space-y-2 pt-2">
              {headline ? (
                <p className="font-display text-xl italic text-ivory">{artist.name}</p>
              ) : null}
              {artist.location ? (
                <p className="label-sm text-bronze">{artist.location}</p>
              ) : null}
            </div>
            <ArtistEditorialLinks artist={artist} showStory={showStory} tone="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}
