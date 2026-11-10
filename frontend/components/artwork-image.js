'use client';

import { useState } from 'react';
import Image from 'next/image';
import { artworkImageUrl, primaryArtworkImage } from '@/lib/media';
import { ImagePlaceholder } from './loading';

export function ArtworkImage({ artwork, className = '', priority = false, sizes = '(min-width: 1024px) 33vw, 100vw' }) {
  const url = artworkImageUrl(artwork);
  const image = primaryArtworkImage(artwork);
  const alt = image?.altText || artwork?.title || 'Artwork';

  if (!url) {
    return <ImagePlaceholder className={className} label="Image not catalogued" />;
  }

  return (
    <CataloguedImage
      key={url}
      url={url}
      alt={alt}
      className={className}
      priority={priority}
      sizes={sizes}
    />
  );
}

function CataloguedImage({ url, alt, className, priority, sizes }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ImagePlaceholder className={className} label="Image not catalogued" />;
  }

  return (
    <div className={`artwork-image-frame aspect-[4/5] ${className}`}>
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        className={`object-contain artwork-image-fade ${ready ? 'is-ready artwork-image-hover' : ''}`}
      />
    </div>
  );
}
