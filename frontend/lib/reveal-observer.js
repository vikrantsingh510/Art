export const REVEAL_STAGGER_LIMIT = 3;
export const REVEAL_STAGGER_MS = 60;

let observer = null;

function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia
    && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return rect.top < (globalThis.innerHeight || 0) * 0.85 && rect.bottom > 40;
}

function getObserver() {
  if (typeof globalThis.IntersectionObserver !== 'function') {
    return null;
  }
  if (!observer) {
    observer = new globalThis.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px',
    });
  }
  return observer;
}

export function resetRevealObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

export function clampRevealStagger(value) {
  const count = Number(value) || 0;
  if (count < 1) {
    return 0;
  }
  return Math.min(Math.floor(count), REVEAL_STAGGER_LIMIT);
}

export function observeReveal(element) {
  if (!element) {
    return undefined;
  }

  if (prefersReducedMotion() || typeof globalThis.IntersectionObserver !== 'function') {
    element.classList.add('is-revealed');
    return undefined;
  }

  if (isElementInViewport(element)) {
    element.classList.add('is-revealed');
    return undefined;
  }

  element.classList.add('reveal-ready');
  const shared = getObserver();
  if (!shared) {
    element.classList.add('is-revealed');
    return undefined;
  }

  shared.observe(element);
  return () => {
    shared.unobserve(element);
  };
}
