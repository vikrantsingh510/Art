import { formatDimensions } from '@/lib/format';
import { artworkStorefrontImageUrl, primaryArtworkImage } from '@/lib/media';
import {
  sizeGuideAxisLabel,
  sizeGuideComparisons,
  sizeGuideDimensionFields,
} from '@/lib/size-guide-scene';
import { SizeGuideSceneLightbox } from './size-guide-scene-lightbox';

export function ArtworkSizeGuide({ artwork }) {
  const comparisons = sizeGuideComparisons(artwork);
  const dimensions = formatDimensions(artwork);
  const fields = sizeGuideDimensionFields(artwork);
  const axisLabel = sizeGuideAxisLabel(fields);

  if (!comparisons.length || !dimensions) {
    return null;
  }

  const image = primaryArtworkImage(artwork);
  const imageUrl = artworkStorefrontImageUrl(artwork, image);
  const imageAlt = image?.altText || artwork?.title || 'Artwork';

  return (
    <section className="size-guide space-y-10 overflow-x-hidden" data-size-guide="ready">
      <header className="space-y-4 max-w-2xl">
        <p className="label-sm text-bronze">Size guide</p>
        <h2 className="font-display text-[28px] md:text-[36px] leading-tight text-ink">
          See how this artwork fits your space.
        </h2>
        <p className="text-[15px] leading-7 text-on-surface-variant">
          Understand the actual size of this artwork through familiar furniture and room comparisons.
        </p>
        <div className="pt-2">
          <p className="font-display text-[32px] md:text-[40px] leading-none tracking-tight text-olive" data-size-guide-dimensions>
            {dimensions}
          </p>
          {axisLabel ? (
            <p className="label-sm text-patina mt-3">{axisLabel}</p>
          ) : null}
        </div>
      </header>

      <ul className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {comparisons.map((comparison, index) => (
          <li key={comparison.reference.id} className="space-y-4 min-w-0">
            <SizeGuideSceneLightbox
              comparison={comparison}
              comparisons={comparisons}
              imageUrl={imageUrl}
              imageAlt={imageAlt}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
            <div className="space-y-2">
              <p className="label-md text-bronze">{comparison.copy.title}</p>
              <p className="text-xs text-patina leading-5">
                {comparison.copy.furnitureLabel}
                {' · '}
                <span data-size-guide-reference={comparison.reference.id}>{comparison.copy.furnitureSize}</span>
              </p>
              <p className="text-sm text-on-surface-variant leading-6">{comparison.copy.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-patina leading-5 max-w-2xl">
        Furniture and wall sizes are representative. Comparisons are illustrative, not a measured room.
        Catalogued artwork dimensions are unchanged by this guide.
      </p>
    </section>
  );
}
