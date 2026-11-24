import { previewAspectRatio } from '@/lib/ar-assets/storefront';
import { artworkStorefrontImageUrl, primaryArtworkImage } from '@/lib/media';
import { ArtworkImageFade } from './artwork-image-fade';
import { ImagePlaceholder } from './loading';

export function ArtworkImage({
  artwork,
  image = null,
  className = '',
  variant = 'frame',
  fit = 'salon',
  hover = true,
  priority = false,
  sizes = '(min-width: 1024px) 33vw, 100vw',
  onError = undefined,
}) {
  const chosen = image || primaryArtworkImage(artwork);
  const url = artworkStorefrontImageUrl(artwork, chosen);
  const alt = chosen?.altText || artwork?.title || 'Artwork';
  const frameClass = [
    'artwork-image-frame',
    variant === 'lightbox' ? 'artwork-lightbox-frame' : '',
    variant === 'detail' ? 'artwork-detail-frame' : '',
    className,
  ].filter(Boolean).join(' ');

  const aspect = fit === 'physical' ? previewAspectRatio(artwork) : { width: 4, height: 5, source: 'salon' };
  const frameStyle = {
    aspectRatio: `${aspect.width} / ${aspect.height}`,
    '--artwork-aspect': String(aspect.width / aspect.height),
  };

  if (!url) {
    return (
      <ImagePlaceholder
        className={frameClass}
        label="Image not catalogued"
        aspectRatio={frameStyle.aspectRatio}
      />
    );
  }

  return (
    <div
      className={frameClass}
      style={frameStyle}
      data-image-fit={aspect.source}
    >
      {/* Public storefront previews bypass /_next/image. Display derivatives
          are served by /media/display so the optimizer never fetches Storage. */}
      <ArtworkImageFade
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
        onError={onError}
        className={`object-contain artwork-image-fade${priority ? ' is-ready' : ''}${hover ? ' artwork-image-hover' : ''}`}
      />
    </div>
  );
}
