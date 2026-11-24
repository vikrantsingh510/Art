'use client';

import Image from 'next/image';
import { bindArtworkImageReady } from '@/lib/artwork-image-ready';

export function ArtworkImageFade({
  alt,
  priority = false,
  onError = undefined,
  className = '',
  ...imageProps
}) {
  return (
    <Image
      {...imageProps}
      alt={alt}
      priority={priority}
      unoptimized
      ref={(node) => bindArtworkImageReady(node, { priority })}
      {...(onError ? { onError } : {})}
      className={className}
    />
  );
}
