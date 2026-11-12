import Image from 'next/image';
import { formatDimensions } from '@/lib/format';
import { artworkImageUrl, primaryArtworkImage } from '@/lib/media';
import {
  sizeGuideAxisLabel,
  sizeGuideComparisons,
  sizeGuideDimensionFields,
} from '@/lib/size-guide-scene';
import { SizeGuideDimensionDiagram, SizeGuideFurniture } from './size-guide-furniture';

export function ArtworkSizeGuide({ artwork }) {
  const comparisons = sizeGuideComparisons(artwork);
  const dimensions = formatDimensions(artwork);
  const fields = sizeGuideDimensionFields(artwork);
  const axisLabel = sizeGuideAxisLabel(fields);

  if (!comparisons.length || !dimensions) {
    return null;
  }

  const image = primaryArtworkImage(artwork);
  const imageUrl = artworkImageUrl(artwork, image);
  const imageAlt = image?.altText || artwork?.title || 'Artwork';
  const widthField = fields.find((field) => field.id === 'width');
  const heightField = fields.find((field) => field.id === 'height');

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

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center border-y border-fillet py-8">
        <SizeGuideDimensionDiagram width={widthField?.value} height={heightField?.value} />
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {fields.map((field) => (
            <div key={field.id} data-size-guide-field={field.id}>
              <dt className="label-sm text-patina">{field.label}</dt>
              <dd className="font-display text-2xl text-olive mt-2">{field.display}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ul className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {comparisons.map(({ reference, scene, copy }) => (
          <li key={reference.id} className="space-y-4 min-w-0">
            <div
              className="size-guide-scene"
              data-size-guide-scene={reference.id}
              data-artwork-aspect={String(scene.artwork.aspect)}
              data-furniture-aspect={String(scene.furniture.aspect)}
              style={{ aspectRatio: String(scene.sceneAspect) }}
            >
              <div
                className="size-guide-furniture"
                style={{
                  width: `${scene.furniture.widthPct}%`,
                  height: `${scene.furniture.heightPct}%`,
                  left: `${scene.furniture.leftPct}%`,
                  bottom: `${scene.furniture.bottomPct}%`,
                }}
              >
                <SizeGuideFurniture id={reference.id} />
              </div>
              <div
                className="size-guide-artwork"
                style={{
                  width: `${scene.artwork.widthPct}%`,
                  height: `${scene.artwork.heightPct}%`,
                  left: `${scene.artwork.leftPct}%`,
                  bottom: `${scene.artwork.bottomPct}%`,
                }}
              >
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={imageAlt}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 22vw, 80vw"
                    className="object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 bg-olive/80" aria-hidden="true" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="label-md text-bronze">{copy.title}</p>
              <p className="text-xs text-patina leading-5">
                {copy.furnitureLabel}
                {' · '}
                <span data-size-guide-reference={reference.id}>{copy.furnitureSize}</span>
              </p>
              <p className="text-sm text-on-surface-variant leading-6">{copy.body}</p>
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
