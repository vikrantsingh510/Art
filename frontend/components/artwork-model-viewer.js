'use client';

import '@google/model-viewer';
import { useEffect, useRef, useState } from 'react';
import {
  MODEL_VIEWER_AR_MODES,
  SCENE_VIEWER_BOUNCE_COPY,
  isSceneViewerBounceHash,
  modelViewerStatusCopy,
  shouldShowArLaunchButton,
} from '@/lib/ar-poc-model-viewer';
import { activateArtworkAr, arLaunchFailureCopy } from '@/lib/ar-assets/launch';

export function ArtworkModelViewer({
  src,
  iosSrc,
  poster,
  alt,
  arAvailable,
  onArAvailable,
  launchLabel = 'View on your wall',
  unavailableCopy = null,
}) {
  const viewerRef = useRef(null);
  const [loadState, setLoadState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [arNote, setArNote] = useState('');
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    function onHashChange() {
      if (isSceneViewerBounceHash(window.location.hash)) {
        setArNote(SCENE_VIEWER_BOUNCE_COPY);
      }
    }

    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) {
      return undefined;
    }

    function reportAr() {
      onArAvailable?.(Boolean(el.canActivateAR));
    }

    function markReady() {
      setLoadState('ready');
      setErrorMessage('');
      setProgress(100);
      if (typeof el.dismissPoster === 'function') {
        el.dismissPoster();
      }
      reportAr();
    }

    function onLoad() {
      markReady();
    }

    function onError(event) {
      const reason = event?.detail?.type || event?.detail || 'unknown';
      setLoadState('error');
      setErrorMessage(`The 3D painting could not be loaded (${String(reason)}).`);
      onArAvailable?.(false);
    }

    function onProgress(event) {
      const total = Number(event?.detail?.totalProgress);
      if (!Number.isFinite(total)) {
        return;
      }
      setProgress(Math.round(total * 100));
      if (total >= 1 && el.loaded) {
        markReady();
      }
    }

    function onArStatus(event) {
      reportAr();
      const status = event?.detail?.status;
      if (status === 'failed') {
        setArNote(SCENE_VIEWER_BOUNCE_COPY);
      }
      if (status === 'session-started') {
        setArNote('');
      }
    }

    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);
    el.addEventListener('progress', onProgress);
    el.addEventListener('ar-status', onArStatus);

    if (el.loaded) {
      markReady();
    }

    return () => {
      el.removeEventListener('load', onLoad);
      el.removeEventListener('error', onError);
      el.removeEventListener('progress', onProgress);
      el.removeEventListener('ar-status', onArStatus);
    };
  }, [onArAvailable, src, iosSrc]);

  async function launchAr() {
    const el = viewerRef.current;
    if (launching) {
      return;
    }
    if (!el || !shouldShowArLaunchButton(arAvailable) || typeof el.activateAR !== 'function') {
      setArNote(arLaunchFailureCopy(new Error('AR is not available in this browser yet.')));
      return;
    }
    setArNote('');
    setLaunching(true);
    try {
      await activateArtworkAr(el, { canActivateAR: arAvailable });
    } catch (error) {
      setArNote(arLaunchFailureCopy(error));
    } finally {
      setLaunching(false);
    }
  }

  const showArButton = shouldShowArLaunchButton(arAvailable);
  const statusCopy = modelViewerStatusCopy(loadState, progress, errorMessage);

  return (
    <div className="space-y-3">
      <model-viewer
        ref={viewerRef}
        src={src}
        ios-src={iosSrc}
        poster={poster || undefined}
        alt={alt}
        ar
        ar-modes={MODEL_VIEWER_AR_MODES}
        ar-placement="wall"
        ar-scale="fixed"
        camera-controls
        touch-action="pan-y"
        shadow-intensity="0"
        environment-image="neutral"
        camera-orbit="0deg 75deg 105%"
        reveal="auto"
        loading="lazy"
        className="w-full bg-stone"
        style={{ height: 'min(32rem, 70vh)', display: 'block' }}
      >
        <div slot="progress-bar" hidden style={{ display: 'none', pointerEvents: 'none' }} />
        <div slot="ar-button" hidden style={{ display: 'none' }} />
      </model-viewer>
      {loadState === 'loading' ? (
        <p className="text-sm text-on-surface-variant" role="status">{statusCopy}</p>
      ) : null}
      {loadState === 'error' ? (
        <p className="notice notice-error" role="alert">{statusCopy}</p>
      ) : null}
      {loadState === 'ready' ? (
        <p className="text-sm text-on-surface-variant" role="status">{statusCopy}</p>
      ) : null}
      {arNote ? (
        <p className="notice" role="status">{arNote}</p>
      ) : null}
      {showArButton ? (
        <button
          className="btn-primary w-full"
          type="button"
          data-ar-launch="model-viewer"
          onClick={launchAr}
          disabled={launching}
        >
          {launchLabel}
        </button>
      ) : unavailableCopy ? (
        <p className="text-sm text-on-surface-variant" data-ar-launch="unavailable">
          {unavailableCopy}
        </p>
      ) : null}
    </div>
  );
}
