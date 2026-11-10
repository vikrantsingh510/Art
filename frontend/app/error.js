'use client';

import { Button } from '@/components/ui';

export default function RootError({ error, reset }) {
  return (
    <div className="page-shell py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
      <h1 className="font-display text-4xl lg:col-span-5">Something interrupted the salon</h1>
      <div className="lg:col-span-7 max-w-xl">
        <p className="text-on-surface-variant">{error?.message || 'An unexpected error occurred.'}</p>
        <div className="mt-8">
          <Button type="button" onClick={reset}>Retry</Button>
        </div>
      </div>
    </div>
  );
}
