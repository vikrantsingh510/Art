import Link from 'next/link';
import { availabilityLabel, formatDimensions } from '@/lib/format';
import { loadArtworkFavouriteSaved } from '@/lib/gallery-entity-loaders';
import { formatInrFromPaise } from '@/lib/money';
import { ArtworkFavouriteButton } from './artwork-favourite-button';
import { ArtworkImage } from './artwork-image';

export async function ArtworkCard({ artwork, showFavourite = true }) {
  const saved = showFavourite ? await loadArtworkFavouriteSaved(artwork.id) : false;

  return (
    <article className="space-y-4">
      <div className="relative">
        <Link href={`/artwork/${artwork.id}`} className="block">
          <ArtworkImage artwork={artwork} fit="physical" hover={false} />
        </Link>
        {showFavourite ? (
          <ArtworkFavouriteButton artworkId={artwork.id} saved={saved} />
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="label-sm text-patina">{availabilityLabel(artwork)}</p>
        <h3 className="font-display text-[22px] italic leading-8">
          <Link href={`/artwork/${artwork.id}`}>{artwork.title}</Link>
        </h3>
        <p className="text-[15px] text-on-surface-variant">{artwork.artistName}</p>
        <hr className="hairline" />
        <p className="label-sm text-patina">
          {[artwork.medium, formatDimensions(artwork)].filter(Boolean).join(' · ')}
        </p>
        <p className="text-[15px] text-ink">{formatInrFromPaise(artwork.pricePaise)}</p>
      </div>
    </article>
  );
}
