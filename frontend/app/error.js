'use client';

import { Button } from '@/components/ui';

export default function RootError({ error, reset }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="font-display text-4xl">Something interrupted the salon</h1>
      <p className="mt-4 text-on-surface-variant">{error?.message || 'An unexpected error occurred.'}</p>
      <div className="mt-8">
        <Button type="button" onClick={reset}>Retry</Button>
      </div>
    </div>
  );
}
