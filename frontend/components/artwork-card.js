import Link from 'next/link';
import { availabilityLabel, formatDimensions } from '@/lib/format';
import { formatInrFromPaise } from '@/lib/money';
import { ArtworkImage } from './artwork-image';

export function ArtworkCard({ artwork }) {
  return (
    <article className="space-y-4">
      <Link href={`/artwork/${artwork.id}`} className="block">
        <ArtworkImage artwork={artwork} />
      </Link>
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
