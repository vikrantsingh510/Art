import Link from 'next/link';
import Image from 'next/image';
import { publicStorageUrl } from '@/lib/media';
import { ImagePlaceholder } from './loading';

export function ArtistCard({ artist }) {
  const portraitUrl = publicStorageUrl(artist.profileImagePath);

  return (
    <article className="border-t border-fillet pt-6 space-y-4">
      <Link href={`/artists/${artist.slug}`} className="block space-y-4">
        {portraitUrl ? (
          <div className="relative aspect-[4/5] max-w-sm bg-surface-container-low">
            <Image
              src={portraitUrl}
              alt={artist.profileImageAlt || artist.name}
              fill
              unoptimized
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <ImagePlaceholder className="max-w-sm" label="No portrait" />
        )}
        <h2 className="font-display text-3xl italic leading-tight">{artist.name}</h2>
        {artist.shortBio ? (
          <p className="text-[15px] leading-6 text-on-surface-variant">{artist.shortBio}</p>
        ) : null}
        <p className="label-sm text-bronze">View the artist</p>
      </Link>
    </article>
  );
}
