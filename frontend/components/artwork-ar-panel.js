'use client';

import { useCallback, useEffect, useState } from 'react';
import { shouldMountModelViewer, shouldShowViewOnWall } from '@/lib/ar-assets/storefront';

export function ArtworkArPanel({ ar, title, posterUrl }) {
  const [Viewer, setViewer] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [arAvailable, setArAvailable] = useState(false);

  const ready = shouldMountModelViewer(ar?.ready, ar?.glbUrl, ar?.usdzUrl);

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    let cancelled = false;
    import('./artwork-model-viewer.js')
      .then((mod) => {
        if (!cancelled) {
          setViewer(() => mod.ArtworkModelViewer);
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
  }, [ready]);

  const onArAvailable = useCallback((available) => {
    setArAvailable(Boolean(available));
  }, []);

  if (!ready) {
    return null;
  }

  const wallVisible = shouldShowViewOnWall(true, arAvailable);

  return (
    <section className="space-y-3 border-t border-fillet pt-6" data-ar-panel="ready">
      <p className="label-sm text-patina">True-to-scale preview</p>
      <p className="text-sm text-on-surface-variant">
        Actual size {ar.physicalLabel}. Interactive 3D is viewing only; camera zoom does not change metres.
        {wallVisible
          ? ' View on your wall places this size on a vertical surface.'
          : ' View on your wall appears on devices that can start AR.'}
      </p>
      {loadError ? (
        <p className="notice notice-error" role="alert">{loadError}</p>
      ) : Viewer ? (
        <Viewer
          src={ar.glbUrl}
          iosSrc={ar.usdzUrl}
          poster={posterUrl || undefined}
          alt={title}
          arAvailable={arAvailable}
          onArAvailable={onArAvailable}
          launchLabel="View on your wall"
        />
      ) : (
        <p className="notice" role="status">Loading 3D viewer…</p>
      )}
      <p className="text-xs text-patina">
        Android Chrome uses WebXR first. iPhone Quick Look is prepared and not yet physically validated.
        Scene Viewer remains a secondary, unverified route.
      </p>
    </section>
  );
}
