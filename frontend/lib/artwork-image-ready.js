export function isArtworkImageCached(image) {
  return Boolean(image?.complete && image.naturalWidth > 0);
}

export function bindArtworkImageReady(image, { priority = false } = {}) {
  if (!image) {
    return undefined;
  }

  const markReady = () => {
    image.classList.remove('is-awaiting');
    image.classList.add('is-ready');
  };

  if (priority || isArtworkImageCached(image)) {
    markReady();
    return undefined;
  }

  image.classList.add('is-awaiting');
  image.addEventListener('load', markReady, { once: true });
  image.addEventListener('error', markReady, { once: true });

  return () => {
    image.removeEventListener('load', markReady);
    image.removeEventListener('error', markReady);
  };
}
