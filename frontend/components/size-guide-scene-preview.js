import Image from 'next/image';

export function SizeGuideScenePreview({
  photo,
  overlay,
  scene,
  imageUrl,
  imageAlt,
  sizes,
  loading = 'lazy',
  className = '',
  framed = true,
  showOverlay = true,
}) {
  return (
    <div
      className={`size-guide-scene ${className}`.trim()}
      data-size-guide-scene={photo.id}
      data-size-guide-photo={photo.file}
      data-artwork-aspect={overlay ? String(overlay.aspect) : undefined}
      data-furniture-aspect={scene ? String(scene.furniture.aspect) : undefined}
      style={framed ? { aspectRatio: String(photo.aspect) } : undefined}
    >
      <Image
        src={photo.src}
        alt={showOverlay ? photo.alt : ''}
        fill
        unoptimized
        loading={loading}
        sizes={sizes}
        className="size-guide-photo"
      />
      {showOverlay && overlay ? (
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
              loading={loading}
              sizes={sizes}
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-olive/80" aria-hidden="true" />
          )}
        </div>
      ) : null}
    </div>
  );
}
