'use client';

import { useState } from 'react';
import Image from 'next/image';
import { previewAspectRatio } from '@/lib/ar-assets/storefront';
import { artworkImageUrl, primaryArtworkImage } from '@/lib/media';
import { ImagePlaceholder } from './loading';

export function ArtworkImage({
  artwork,
  image = null,
  className = '',
  variant = 'frame',
  fit = 'salon',
  priority = false,
  sizes = '(min-width: 1024px) 33vw, 100vw',
}) {
  const chosen = image || primaryArtworkImage(artwork);
  const url = artworkImageUrl(artwork, chosen);
  const alt = chosen?.altText || artwork?.title || 'Artwork';

  if (!url) {
    return <ImagePlaceholder className={className} label="Image not catalogued" />;
  }

  return (
    <CataloguedImage
      key={url}
      url={url}
      alt={alt}
      className={className}
      variant={variant}
      fit={fit}
      artwork={artwork}
      priority={priority}
      sizes={sizes}
    />
  );
}

function CataloguedImage({ url, alt, className, variant, fit, artwork, priority, sizes }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const aspect = fit === 'physical' ? previewAspectRatio(artwork) : { width: 4, height: 5, source: 'salon' };
  const frameStyle = {
    aspectRatio: `${aspect.width} / ${aspect.height}`,
    '--artwork-aspect': String(aspect.width / aspect.height),
  };

  if (failed) {
    return <ImagePlaceholder className={className} label="Image not catalogued" />;
  }

  return (
    <div
      className={`artwork-image-frame ${variant === 'lightbox' ? 'artwork-lightbox-frame' : ''} ${className}`}
      style={frameStyle}
      data-image-fit={aspect.source}
    >
      {/* Public Storage originals bypass /_next/image. The optimizer's 7s
          upstream timeout hides catalogued files that admin already shows. */}
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        className={`object-contain artwork-image-fade ${ready ? 'is-ready artwork-image-hover' : ''}`}
      />
    </div>
  );
}
