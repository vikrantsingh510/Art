'use client';

import { useRef, useState } from 'react';
import { POC_ARTWORK, POC_ASSETS } from '@/lib/ar-poc-model-viewer';

export function PocPhotoPreview() {
  const objectUrlRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [offset, setOffset] = useState({ x: 50, y: 48 });
  const [scale, setScale] = useState(0.32);
  const [tilt, setTilt] = useState(8);
  const [dragging, setDragging] = useState(false);

  function onPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPhotoUrl(url);
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

  return (
    <div className="space-y-4 bg-stone text-on-surface p-6">
      <p className="notice">
        Photo preview — not live AR. The room photo stays on this device and is not uploaded.
        Production artwork pages still use the existing photo-preview fallback.
      </p>
      {!photoUrl ? (
        <label className="btn-secondary cursor-pointer inline-block">
          Choose a room photo
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="User-selected room" className="absolute inset-0 w-full h-full object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={POC_ASSETS.poster}
              alt={POC_ARTWORK.title}
              className="absolute shadow-lg"
              draggable={false}
              style={{
                left: `${offset.x}%`,
                top: `${offset.y}%`,
                width: `${scale * 100}%`,
                transform: `translate(-50%, -50%) perspective(800px) rotateX(${tilt}deg)`,
              }}
            />
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
  );
}
