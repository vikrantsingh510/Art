import { formatDimensions } from '@/lib/format';
import {
  SIZE_GUIDE_REFERENCES,
  sizeGuideArtworkCm,
  sizeGuideLayout,
} from '@/lib/ar-assets/storefront';

export function ArtworkSizeGuide({ artwork }) {
  const artworkCm = sizeGuideArtworkCm(artwork);
  const dimensions = formatDimensions(artwork);
  if (!artworkCm || !dimensions) {
    return null;
  }

  const comparisons = ['sofa', 'bed', 'wall'].map((id) => {
    const reference = SIZE_GUIDE_REFERENCES[id];
    return {
      reference,
      layout: sizeGuideLayout(artworkCm, reference),
    };
  }).filter((row) => row.layout);

  if (comparisons.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4" data-size-guide="ready">
      <div>
        <p className="label-sm text-patina">Size guide</p>
        <h2 className="font-display text-2xl mt-2">How large is this work?</h2>
        <p className="text-sm text-on-surface-variant mt-2">
          Actual size {dimensions}. Comparisons use stated furniture and wall sizes and are illustrative, not a measured room.
        </p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {comparisons.map(({ reference, layout }) => (
          <li key={reference.id} className="space-y-3 bg-stone/60 p-4">
            <div className="relative h-36 flex items-end justify-center gap-2 overflow-hidden">
              <span
                className="bg-fillet"
                style={{
                  height: `${layout.reference.heightPct}%`,
                  aspectRatio: String(layout.reference.aspect),
                }}
                aria-hidden="true"
              />
              <span
                className="bg-bronze/80"
                style={{
                  height: `${layout.artwork.heightPct}%`,
                  aspectRatio: String(layout.artwork.aspect),
                }}
                aria-hidden="true"
              />
            </div>
            <p className="label-md text-patina">{reference.label}</p>
            <p className="text-xs text-on-surface-variant leading-5">
              {reference.caption}. Artwork {dimensions}.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
