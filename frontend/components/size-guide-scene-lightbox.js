'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SizeGuideScenePreview } from './size-guide-scene-preview';

const SCENE_OPTION_LABELS = {
  sofa: 'Sofa',
  bed: 'Bed',
  wall: 'Wall',
};

export function SizeGuideSceneLightbox({
  comparison,
  comparisons = [comparison],
  imageUrl,
  imageAlt,
  loading = 'lazy',
}) {
  const scenes = comparisons.length ? comparisons : [comparison];
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(comparison.reference.id);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const active = scenes.find((item) => item.reference.id === activeId) || comparison;
  const { photo, overlay, scene, copy } = active;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const root = dialogRef.current;
      if (!root) {
        return;
      }
      const focusable = [...root.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function openScene() {
    setActiveId(comparison.reference.id);
    setOpen(true);
  }

  function selectScene(event, id) {
    event.preventDefault();
    event.stopPropagation();
    setActiveId(id);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="size-guide-scene-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Enlarge size comparison: ${comparison.copy.title}`}
        onClick={openScene}
      >
        <SizeGuideScenePreview
          photo={comparison.photo}
          overlay={comparison.overlay}
          scene={comparison.scene}
          imageUrl={imageUrl}
          imageAlt={imageAlt}
          loading={loading}
          sizes="(min-width: 1024px) 30vw, 100vw"
        />
      </button>

      {open ? createPortal(
        <div
          className="size-guide-lightbox-backdrop"
          data-size-guide-lightbox={photo.id}
          onClick={close}
        >
          <div
            ref={dialogRef}
            className="size-guide-lightbox-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{ '--scene-aspect': String(photo.aspect) }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              className="size-guide-lightbox-close"
              aria-label="Close size comparison"
              onClick={close}
            >
              Close
            </button>
            <h2 id={titleId} className="sr-only">{copy.title}</h2>
            <SizeGuideScenePreview
              key={photo.id}
              photo={photo}
              overlay={overlay}
              scene={scene}
              imageUrl={imageUrl}
              imageAlt={imageAlt}
              sizes="92vw"
              className="size-guide-scene-lightbox"
            />
            {scenes.length > 1 ? (
              <div className="size-guide-lightbox-scenes" role="tablist" aria-label="Size comparison scenes">
                {scenes.map((item) => {
                  const selected = item.reference.id === active.reference.id;
                  const label = SCENE_OPTION_LABELS[item.reference.id] || item.copy.title;
                  return (
                    <button
                      key={item.reference.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={item.copy.title}
                      className={`size-guide-lightbox-scene${selected ? ' is-active' : ''}`}
                      onClick={(event) => selectScene(event, item.reference.id)}
                    >
                      <span className="size-guide-lightbox-thumb">
                        <SizeGuideScenePreview
                          photo={item.photo}
                          overlay={item.overlay}
                          scene={item.scene}
                          sizes="180px"
                          framed={false}
                          showOverlay={false}
                          className="size-guide-lightbox-thumb-preview"
                        />
                      </span>
                      <span className="size-guide-lightbox-scene-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
