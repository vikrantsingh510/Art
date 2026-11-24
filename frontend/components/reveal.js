'use client';

import { useLayoutEffect, useRef } from 'react';
import { clampRevealStagger, observeReveal } from '@/lib/reveal-observer';

export function Reveal({ children, className = '', stagger = 0 }) {
  const nodeRef = useRef(null);
  const delayCount = clampRevealStagger(stagger);
  const classes = className ? `reveal ${className}` : 'reveal';

  useLayoutEffect(() => observeReveal(nodeRef.current), []);

  return (
    <div
      ref={nodeRef}
      className={classes}
      data-reveal-stagger={delayCount || undefined}
    >
      {children}
    </div>
  );
}
