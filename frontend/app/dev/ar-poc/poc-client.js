'use client';

import { useCallback, useEffect, useState } from 'react';
import { POC_ASSETS, POC_ARTWORK, POC_PLANE } from '@/lib/ar-poc-model-viewer';
import { PocPhotoPreview } from './poc-photo-preview';

export function ArPocInteractive() {
  const [Viewer, setViewer] = useState(null);
  const [arAvailable, setArAvailable] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('./model-viewer-element.js')
      .then((mod) => {
        if (!cancelled) {
          setViewer(() => mod.ModelViewerElement);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error?.message || 'Google Model Viewer failed to load.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onArAvailable = useCallback((available) => {
    setArAvailable(Boolean(available));
  }, []);

  return (
    <>
      <section className="mt-10 max-w-3xl space-y-4">
        <p className="label-md text-patina">Shared viewer · WebXR, Scene Viewer, Quick Look, 3D</p>
        {loadError ? (
          <p className="notice notice-error" role="alert">{loadError}</p>
        ) : Viewer ? (
          <Viewer
            src={POC_ASSETS.glb}
            iosSrc={POC_ASSETS.usdz}
            poster={POC_ASSETS.poster}
            alt={POC_ARTWORK.title}
            arAvailable={arAvailable}
            onArAvailable={onArAvailable}
          />
        ) : (
          <p className="notice" role="status">Loading 3D viewer…</p>
        )}
        <p className="text-sm text-on-surface-variant">
          AR modes: WebXR first (Chrome camera), then Scene Viewer, then Quick Look. Placement is wall.
          Scale is fixed at the generated plane ({POC_PLANE.widthCm} × {POC_PLANE.heightCm} cm).
          The Google app currently opens Scene Viewer and returns immediately, so Place on wall stays
          in Chrome AR.
          {arAvailable
            ? ' This browser can launch native AR.'
            : ' Native AR is not available here — use the 3D orbit and photo preview.'}
        </p>
      </section>

      <section className="mt-10 max-w-3xl space-y-4">
        <p className="label-md text-patina">Photo preview fallback</p>
        <PocPhotoPreview />
      </section>
    </>
  );
}
