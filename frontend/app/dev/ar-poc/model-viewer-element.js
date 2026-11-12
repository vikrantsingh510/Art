'use client';

import { ArtworkModelViewer } from '@/components/artwork-model-viewer';

export function ModelViewerElement(props) {
  return (
    <ArtworkModelViewer
      launchLabel="Place on wall"
      unavailableCopy="Place on wall is hidden until Model Viewer reports AR capability."
      {...props}
    />
  );
}
