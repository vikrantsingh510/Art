import Image from 'next/image';

export function SizeGuideScenePreview({
  photo,
  overlay,
  scene,
  imageUrl,
  imageAlt,
  sizes,
  className = '',
}) {
  return (
    <div
      className={`size-guide-scene ${className}`.trim()}
      data-size-guide-scene={photo.id}
      data-size-guide-photo={photo.file}
      data-artwork-aspect={String(overlay.aspect)}
      data-furniture-aspect={scene ? String(scene.furniture.aspect) : undefined}
      style={{ aspectRatio: String(photo.aspect) }}
    >
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        unoptimized
        sizes={sizes}
        className="size-guide-photo"
      />
      <div
        className="size-guide-artwork"
        style={{
          width: `${overlay.widthPct}%`,
          height: `${overlay.heightPct}%`,
          left: `${overlay.leftPct}%`,
          bottom: `${overlay.bottomPct}%`,
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            unoptimized
            sizes={sizes}
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-olive/80" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
