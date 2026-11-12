'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDimensions } from '@/lib/format';

export function ArViewer({ artwork, imageUrl }) {
  const objectUrlRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [offset, setOffset] = useState({ x: 50, y: 48 });
  const [scale, setScale] = useState(0.32);
  const [tilt, setTilt] = useState(8);
  const [dragging, setDragging] = useState(false);
  const dimensions = formatDimensions(artwork);

  const cleanupMedia = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    cleanupMedia();
    setOpen(false);
    setMessage('');
    setPhotoUrl('');
    setDragging(false);
  }, [cleanupMedia]);

  function onBackdropPointerDown(event) {
    if (event.button !== 0 || dragging) {
      return;
    }
    if (event.target === event.currentTarget) {
      close();
    }
  }

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  function onPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPhotoUrl(url);
    setMessage('Illustrative photo preview — not live AR and not centimetre-accurate. The image stays on this device and is not uploaded.');
  }

  function onPointerMove(event) {
    if (!dragging) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setOffset({
      x: Math.min(90, Math.max(10, x)),
      y: Math.min(90, Math.max(10, y)),
    });
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button className="btn-secondary w-full" type="button" onClick={() => setOpen(true)}>
          Preview in a room photo
        </button>
        <p className="text-xs text-patina">
          Illustrative overlay on a photo you choose. Not live AR and not a centimetre-accurate placement.
          {dimensions ? ` Actual size ${dimensions}.` : ''} The photo stays on this device.
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-charcoal/80 text-on-primary overflow-auto flex justify-center cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-label="Preview in a room photo"
      onPointerDown={onBackdropPointerDown}
    >
      <div
        className="w-full max-w-3xl m-4 md:my-10 md:mx-8 space-y-6 cursor-auto"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between gap-4 items-start">
          <div>
            <p className="label-sm text-bronze">Room photo preview</p>
            <h2 className="font-display text-3xl mt-2">{artwork.title}</h2>
            <p className="text-sm mt-2">
              {dimensions
                ? `Actual size ${dimensions}. This overlay is illustrative and is not centimetre-accurate.`
                : 'Physical dimensions are incomplete. This overlay is illustrative only.'}
            </p>
            <p className="text-xs text-bronze/80 mt-2">Click outside this panel or press Escape to close.</p>
          </div>
          <button className="btn-secondary shrink-0" type="button" onClick={close}>Exit</button>
        </div>

        <div className="space-y-4 bg-stone text-on-surface p-6">
          <p className="notice">{message || 'Choose a room photo. Positioning is local to this browser tab and is not live AR.'}</p>
          {!photoUrl ? (
            <label className="btn-secondary cursor-pointer inline-block">
              Select room photo
              <input className="sr-only" type="file" accept="image/*" onChange={onPhoto} />
            </label>
          ) : (
            <>
              <div
                className="relative overflow-hidden bg-black aspect-[4/3] cursor-move"
                onPointerDown={() => setDragging(true)}
                onPointerUp={() => setDragging(false)}
                onPointerLeave={() => setDragging(false)}
                onPointerMove={onPointerMove}
              >
                {/* eslint-disable @next/next/no-img-element -- local blob/object URLs cannot use next/image */}
                <img src={photoUrl} alt="User-selected room" className="absolute inset-0 w-full h-full object-cover" />
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={artwork.title}
                    className="absolute shadow-lg object-contain"
                    draggable={false}
                    style={{
                      left: `${offset.x}%`,
                      top: `${offset.y}%`,
                      width: `${scale * 100}%`,
                      transform: `translate(-50%, -50%) perspective(800px) rotateX(${tilt}deg)`,
                    }}
                  />
                ) : null}
                {/* eslint-enable @next/next/no-img-element */}
              </div>
              <label className="block text-sm">
                Scale
                <input className="w-full" type="range" min="0.08" max="0.8" step="0.01" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
              </label>
              <label className="block text-sm">
                Perspective
                <input className="w-full" type="range" min="0" max="28" step="1" value={tilt} onChange={(event) => setTilt(Number(event.target.value))} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="btn-secondary" type="button" onClick={() => { setOffset({ x: 50, y: 48 }); setScale(0.32); setTilt(8); }}>
                  Reset placement
                </button>
                <label className="btn-secondary cursor-pointer">
                  Replace photo
                  <input className="sr-only" type="file" accept="image/*" onChange={onPhoto} />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
