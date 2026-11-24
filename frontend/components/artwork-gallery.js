'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { previewAspectRatio } from '@/lib/ar-assets/storefront';
import { ARTWORK_LIGHTBOX_MS, shouldDeferLightboxExit } from '@/lib/artwork-lightbox';
import { galleryHasControls, orderedGalleryImages, swipeDirection, wrapGalleryIndex } from '@/lib/artwork-gallery';
import { ArtworkImage } from './artwork-image';

export function ArtworkGallery({ artwork }) {
  const images = orderedGalleryImages(artwork);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxExiting, setLightboxExiting] = useState(false);
  const pointerX = useRef(null);
  const exitTimer = useRef(null);
  const selectedIndex = images.length ? wrapGalleryIndex(index, images.length) : 0;
  const selected = images[selectedIndex] || null;
  const showControls = galleryHasControls(images);

  function go(offset) {
    setIndex((current) => wrapGalleryIndex(current + offset, images.length));
  }

  function openLightbox() {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    setLightboxExiting(false);
    setLightbox(true);
  }

  function closeLightbox() {
    if (!lightbox || lightboxExiting) {
      return;
    }
    if (!shouldDeferLightboxExit()) {
      setLightbox(false);
      setLightboxExiting(false);
      return;
    }
    setLightboxExiting(true);
    exitTimer.current = setTimeout(() => {
      setLightbox(false);
      setLightboxExiting(false);
      exitTimer.current = null;
    }, ARTWORK_LIGHTBOX_MS);
  }

  useEffect(() => () => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
    }
  }, []);

  useEffect(() => {
    if (!lightbox) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!shouldDeferLightboxExit()) {
          setLightbox(false);
          setLightboxExiting(false);
        } else {
          setLightboxExiting((exiting) => {
            if (exiting) {
              return exiting;
            }
            exitTimer.current = setTimeout(() => {
              setLightbox(false);
              setLightboxExiting(false);
              exitTimer.current = null;
            }, ARTWORK_LIGHTBOX_MS);
            return true;
          });
        }
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => wrapGalleryIndex(current + 1, images.length));
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => wrapGalleryIndex(current - 1, images.length));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightbox, images.length]);

  function onPointerDown(event) {
    pointerX.current = event.clientX;
  }

  function onPointerUp(event) {
    const start = pointerX.current;
    pointerX.current = null;
    if (start == null) {
      return;
    }
    const direction = swipeDirection(event.clientX - start);
    if (direction === 'next') {
      go(1);
    }
    if (direction === 'previous') {
      go(-1);
    }
  }

  const previewAspect = previewAspectRatio(artwork);

  if (images.length === 0) {
    return (
      <ArtworkImage
        artwork={artwork}
        variant="detail"
        fit="physical"
        priority
        sizes="(min-width: 768px) 55vw, 100vw"
      />
    );
  }

  return (
    <div
      className="space-y-4"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          go(1);
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(-1);
        }
      }}
    >
      <div
        className="relative"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <button
          type="button"
          className="block w-full text-left"
          onClick={openLightbox}
          aria-label="View artwork image full screen"
        >
          <div className="artwork-gallery-stage" key={selected.id}>
            <ArtworkImage
              artwork={artwork}
              image={selected}
              variant="detail"
              fit="physical"
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
            />
          </div>
        </button>
        {showControls ? (
          <>
            <button
              type="button"
              className="artwork-gallery-nav left-3"
              aria-label="Previous image"
              onClick={() => go(-1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="artwork-gallery-nav right-3"
              aria-label="Next image"
              onClick={() => go(1)}
            >
              Next
            </button>
          </>
        ) : null}
      </div>
      {showControls ? (
        <div className="grid grid-cols-5 gap-2" role="tablist" aria-label="Artwork images">
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={imageIndex === selectedIndex}
              className={`artwork-gallery-thumb${imageIndex === selectedIndex ? ' is-active' : ''}`}
              onClick={() => setIndex(imageIndex)}
            >
              <ArtworkImage
                artwork={artwork}
                image={image}
                sizes="120px"
                className="pointer-events-none"
              />
              <span className="sr-only">{image.altText || `Image ${imageIndex + 1}`}</span>
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? createPortal(
        <div
          className={`artwork-lightbox-backdrop fixed inset-0 z-[80] bg-charcoal/80 flex items-center justify-center p-4 overflow-y-auto cursor-pointer${lightboxExiting ? ' is-exiting' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Artwork image"
          onClick={closeLightbox}
        >
          <div
            className="artwork-lightbox-dialog mx-auto my-auto space-y-4 cursor-auto"
            style={{ '--artwork-aspect': String(previewAspect.width / previewAspect.height) }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <div className="flex justify-between items-start gap-4">
              <p className="label-sm text-bronze">
                {selectedIndex + 1} of {images.length}
              </p>
              <button className="btn-secondary min-h-11" type="button" onClick={closeLightbox}>
                Close
              </button>
            </div>
            <div className="artwork-gallery-stage" key={selected.id}>
              <ArtworkImage
                artwork={artwork}
                image={selected}
                variant="lightbox"
                fit="physical"
                sizes="90vw"
              />
            </div>
            {showControls ? (
              <div className="flex justify-between gap-3">
                <button className="btn-secondary min-h-11" type="button" onClick={() => go(-1)}>Previous</button>
                <button className="btn-secondary min-h-11" type="button" onClick={() => go(1)}>Next</button>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
