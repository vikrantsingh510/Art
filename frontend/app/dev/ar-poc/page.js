import { notFound } from 'next/navigation';
import {
  POC_ARTWORK,
  POC_PLANE,
  dimensionMismatchCopy,
} from '@/lib/ar-poc-model-viewer';
import { ArPocInteractive } from './poc-client';

export const metadata = { title: 'AR proof of concept' };

export default function ArPocPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface text-on-surface px-6 py-12 md:px-16">
      <p className="label-sm text-patina">Development only · Phase 1 AR proof of concept</p>
      <h1 className="font-display text-4xl mt-4">{POC_ARTWORK.title}</h1>
      <p className="mt-2 text-on-surface-variant">{POC_ARTWORK.artistName}</p>
      <p className="mt-4 text-sm max-w-3xl">{dimensionMismatchCopy(POC_PLANE)}</p>
      <p className="notice mt-6">
        Isolated Model Viewer route. Production artwork pages still use WebXR plus photo preview.
        Camera frames are not uploaded.
      </p>
      <ArPocInteractive />
    </main>
  );
}
