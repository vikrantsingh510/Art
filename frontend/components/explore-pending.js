'use client';

import { createContext, useContext, useMemo, useRef, useState } from 'react';

const ExplorePendingContext = createContext({
  pending: false,
  setPending: () => {},
});

export function useExplorePending() {
  return useContext(ExplorePendingContext);
}

export function ExplorePendingProvider({ children }) {
  const [pending, setPending] = useState(false);
  const value = useMemo(() => ({ pending, setPending }), [pending]);

  return (
    <ExplorePendingContext.Provider value={value}>
      {children}
    </ExplorePendingContext.Provider>
  );
}

export function ExploreLoadingMarker() {
  return (
    <p className="sr-only" role="status" aria-live="polite" data-explore-loading="true">
      Updating the collection
    </p>
  );
}

export function isExploreLoadingChild(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  if (node.type === ExploreLoadingMarker) {
    return true;
  }
  return node.props?.['data-explore-loading'] === 'true';
}

export function ExploreResults({ children }) {
  const { pending: filterPending } = useExplorePending();
  const loading = isExploreLoadingChild(children);
  const displayedRef = useRef(children);
  /* eslint-disable react-hooks/refs -- keep last catalogue markup while the loading segment is showing */
  if (!loading) {
    displayedRef.current = children;
  }
  const displayed = displayedRef.current;
  /* eslint-enable react-hooks/refs */
  const pending = Boolean(filterPending || loading);
  const dimmed = pending && !isExploreLoadingChild(displayed);

  return (
    <div
      className={dimmed ? 'explore-results is-pending' : 'explore-results'}
      aria-busy={pending}
    >
      {displayed}
    </div>
  );
}
