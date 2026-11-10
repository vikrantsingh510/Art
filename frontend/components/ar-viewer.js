'use client';

import { useEffect, useRef, useState } from 'react';
import { artworkPhysicalSizeMetres } from '@/lib/dimensions';
import { detectArCapability, isImmersiveArSupported, stopMediaStream } from '@/lib/ar-capability';
import { createMvpProgram, createTexturedQuad, drawTexturedQuad, multiplyMat4 } from '@/lib/ar-webgl';

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Artwork image could not be loaded for placement.'));
    image.src = url;
  });
}

function createTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return texture;
}

function createQuadProgram(gl) {
  return createMvpProgram(gl);
}

export function ArViewer({ artwork, imageUrl }) {
  const size = artworkPhysicalSizeMetres(artwork);
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const sessionRef = useRef(null);
  const streamRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('chooser');
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [offset, setOffset] = useState({ x: 50, y: 48 });
  const [scale, setScale] = useState(0.32);
  const [tilt, setTilt] = useState(8);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);

  function cleanupMedia() {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (sessionRef.current) {
      sessionRef.current.end?.().catch(() => {});
      sessionRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function close() {
    cleanupMedia();
    setOpen(false);
    setMode('chooser');
    setMessage('');
    setPhotoUrl('');
    setDragging(false);
    setStarting(false);
  }

  function onBackdropPointerDown(event) {
    if (event.button !== 0 || dragging) {
      return;
    }
    if (event.target === event.currentTarget) {
      close();
    }
  }

  useEffect(() => () => cleanupMedia(), []);

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
  }, [open]);

  async function startLiveAr() {
    setMessage('');
    setStarting(true);
    const capability = detectArCapability();
    if (!size) {
      setStarting(false);
      setMode('missing-dimensions');
      return;
    }
    if (!capability.secure) {
      setStarting(false);
      setMode('unsupported');
      setMessage('Live AR needs a secure context (localhost or HTTPS).');
      return;
    }
    const supported = await isImmersiveArSupported();
    if (!supported) {
      setStarting(false);
      setMode('photo');
      setMessage('This browser does not support WebXR immersive AR. Use the photo preview instead. iOS Safari is not claimed as a live AR target.');
      return;
    }
    if (!imageUrl) {
      setStarting(false);
      setMode('unsupported');
      setMessage('A public artwork image is required to place the canvas.');
      return;
    }

    try {
      const image = await loadImage(imageUrl);
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'local-floor'],
        domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined,
      });
      sessionRef.current = session;
      const canvas = canvasRef.current;
      const gl = canvas.getContext('webgl', { xrCompatible: true });
      if (!gl) {
        throw new Error('WebGL is unavailable.');
      }
      const layer = new XRWebGLLayer(session, gl);
      await session.updateRenderState({ baseLayer: layer });
      const space = await session.requestReferenceSpace('local-floor').catch(() => session.requestReferenceSpace('local'));
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      const texture = createTexture(gl, image);
      const program = createQuadProgram(gl);
      const quad = createTexturedQuad(gl, size.widthM, size.heightM);
      let placed = null;

      session.addEventListener('end', () => {
        sessionRef.current = null;
        hitTestSource.cancel?.();
      });
      session.addEventListener('select', (event) => {
        const frame = event.frame;
        const hits = frame.getHitTestResults(hitTestSource);
        if (hits[0]) {
          placed = hits[0].getPose(space);
        }
      });

      setStarting(false);
      setMode('live');
      session.requestAnimationFrame(function onFrame(_time, frame) {
        if (!sessionRef.current) {
          return;
        }
        const pose = frame.getViewerPose(space);
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (pose && placed) {
          pose.views.forEach((view) => {
            const viewport = layer.getViewport(view);
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            const modelView = multiplyMat4(view.transform.inverse.matrix, placed.transform.matrix);
            const mvp = multiplyMat4(view.projectionMatrix, modelView);
            drawTexturedQuad(gl, program, quad, texture, mvp);
          });
        }
        session.requestAnimationFrame(onFrame);
      });
    } catch (error) {
      setStarting(false);
      if (error?.name === 'NotAllowedError') {
        setMode('denied');
        setMessage('Camera permission was denied. Live AR cannot start until permission is granted.');
        return;
      }
      setMode('photo');
      setMessage(error?.message || 'Live AR could not start. The photo preview does not use WebXR.');
    }
  }

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
    setMode('photo');
    setMessage('Photo preview — not live AR. The image stays on this device and is not uploaded.');
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
          View in your space
        </button>
        <p className="text-xs text-patina">
          Places this 2D painting at recorded scale. Live AR uses WebXR on supported Android Chrome devices. Other browsers get a labelled photo preview. Camera frames are not uploaded.
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-charcoal/80 text-on-primary overflow-auto flex justify-center cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-label="View in your space"
      onPointerDown={onBackdropPointerDown}
    >
      <div
        ref={overlayRef}
        className="w-full max-w-3xl m-4 md:my-10 md:mx-8 space-y-6 cursor-auto"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between gap-4 items-start">
          <div>
            <p className="label-sm text-bronze">Spatial viewing</p>
            <h2 className="font-display text-3xl mt-2">{artwork.title}</h2>
            {size ? (
              <p className="text-sm mt-2">
                Recorded size {Number(artwork.width)} × {Number(artwork.height)} {size.unit}
                {' '}({size.widthM.toFixed(2)} m × {size.heightM.toFixed(2)} m)
              </p>
            ) : (
              <p className="text-sm mt-2">Physical width and height are missing, so live scale cannot be verified.</p>
            )}
            <p className="text-xs text-bronze/80 mt-2">Click outside this panel or press Escape to close.</p>
          </div>
          <button className="btn-secondary shrink-0" type="button" onClick={close}>Exit</button>
        </div>

        {mode === 'chooser' ? (
          <div className="space-y-4 bg-stone text-on-surface p-6">
            <p>Live AR uses the camera to find a wall or floor, then places this canvas at its recorded size. Permission is requested only when you start live placement.</p>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={startLiveAr} disabled={!size || starting} aria-busy={starting}>
                {starting ? 'Starting camera…' : 'Start live AR'}
              </button>
              <label className="btn-secondary cursor-pointer">
                Choose a room photo
                <input className="sr-only" type="file" accept="image/*" onChange={onPhoto} />
              </label>
            </div>
            {!size ? <p className="notice notice-error">Add positive width, height and unit on the artwork before live AR can scale correctly.</p> : null}
          </div>
        ) : null}

        {mode === 'denied' || mode === 'unsupported' || mode === 'missing-dimensions' ? (
          <div className="space-y-4 bg-stone text-on-surface p-6">
            <p className="notice notice-error">{message || 'Live AR is unavailable on this device.'}</p>
            <label className="btn-secondary cursor-pointer inline-block">
              Use photo preview
              <input className="sr-only" type="file" accept="image/*" onChange={onPhoto} />
            </label>
          </div>
        ) : null}

        {mode === 'live' ? (
          <div className="space-y-3">
            <p className="notice">Live AR session. Tap a detected surface to place the painting. This is a 2D canvas, not a sculpture.</p>
            <button className="btn-secondary" type="button" onClick={() => { cleanupMedia(); setMode('chooser'); }}>Reset</button>
          </div>
        ) : null}

        {mode === 'photo' ? (
          <div className="space-y-4 bg-stone text-on-surface p-6">
            <p className="notice">{message || 'Photo preview — not live AR. Positioning is local to this browser tab.'}</p>
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
                      className="absolute shadow-lg"
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
        ) : null}

        <canvas ref={canvasRef} className={mode === 'live' ? 'w-full min-h-[50vh] bg-black' : 'hidden'} />
      </div>
    </div>
  );
}
