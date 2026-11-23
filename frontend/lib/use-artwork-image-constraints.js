'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ARTWORK_IMAGES_BUCKET } from '@/lib/artwork-image-constraints';
import { ARTWORK_IMAGE_CONSTRAINTS_UNAVAILABLE_MESSAGE } from '@/lib/artwork-image-constraints-copy';

export function useArtworkImageConstraints() {
  const [constraints, setConstraints] = useState(null);
  const [constraintsError, setConstraintsError] = useState('');
  const [constraintsLoading, setConstraintsLoading] = useState(true);
  const inflightRef = useRef(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (inflightRef.current) {
      return inflightRef.current;
    }

    setConstraintsLoading(true);
    const request = (async () => {
      try {
        const client = await createBrowserArtApi();
        const data = await client.adminArtworkImageConstraints();
        if (cancelledRef.current) {
          return;
        }
        if (!data || data.bucket !== ARTWORK_IMAGES_BUCKET) {
          setConstraints(null);
          setConstraintsError(ARTWORK_IMAGE_CONSTRAINTS_UNAVAILABLE_MESSAGE);
          return;
        }
        setConstraints(data);
        setConstraintsError('');
      } catch {
        if (cancelledRef.current) {
          return;
        }
        setConstraints(null);
        setConstraintsError(ARTWORK_IMAGE_CONSTRAINTS_UNAVAILABLE_MESSAGE);
      } finally {
        inflightRef.current = null;
        if (!cancelledRef.current) {
          setConstraintsLoading(false);
        }
      }
    })();

    inflightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return {
    constraints,
    constraintsError,
    constraintsLoading,
    retryConstraints: load,
  };
}
