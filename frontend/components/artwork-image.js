import Image from 'next/image';
import { previewAspectRatio } from '@/lib/ar-assets/storefront';
import { artworkStorefrontImageUrl, primaryArtworkImage } from '@/lib/media';
import { ImagePlaceholder } from './loading';

export function ArtworkImage({
  artwork,
  image = null,
  className = '',
  variant = 'frame',
  fit = 'salon',
  priority = false,
  sizes = '(min-width: 1024px) 33vw, 100vw',
  onError = undefined,
}) {
  const chosen = image || primaryArtworkImage(artwork);
  const url = artworkStorefrontImageUrl(artwork, chosen);
  const alt = chosen?.altText || artwork?.title || 'Artwork';

  if (!url) {
    return <ImagePlaceholder className={className} label="Image not catalogued" />;
  }

  const aspect = fit === 'physical' ? previewAspectRatio(artwork) : { width: 4, height: 5, source: 'salon' };
  const frameStyle = {
    aspectRatio: `${aspect.width} / ${aspect.height}`,
    '--artwork-aspect': String(aspect.width / aspect.height),
  };

  return (
    <div
      className={`artwork-image-frame ${variant === 'lightbox' ? 'artwork-lightbox-frame' : ''} ${className}`}
      style={frameStyle}
      data-image-fit={aspect.source}
    >
      {/* Public storefront previews bypass /_next/image. Display derivatives
          are served by /media/display so the optimizer never fetches Storage. */}
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
        {...(onError ? { onError } : {})}
        className="object-contain artwork-image-fade artwork-image-hover"
      />
    </div>
  );
}
