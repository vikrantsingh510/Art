'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }) {
  const pathname = usePathname();
  const nodeRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return undefined;
    }
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }
    node.classList.remove('page-enter');
    void node.offsetWidth;
    node.classList.add('page-enter');
    return undefined;
  }, [pathname]);

  return (
    <div ref={nodeRef} className="page-enter">
      {children}
    </div>
  );
}
