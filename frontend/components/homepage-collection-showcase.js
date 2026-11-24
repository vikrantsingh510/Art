import Image from 'next/image';
import Link from 'next/link';
import { collectionCoverUrl } from '@/lib/collection-cover';

export function HomepageCollectionShowcase({ collections }) {
  const items = Array.isArray(collections) ? collections : [];
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="homepage-collection-grid"
      data-count={String(items.length)}
    >
      {items.map((collection) => {
        const coverUrl = collectionCoverUrl(collection.coverImagePath, collection.updatedAt);
        const description = collection.description || 'View the published hanging.';
        return (
          <Link
            key={collection.id}
            href={`/collections/${collection.id}`}
            className="homepage-collection-panel"
            aria-label={`Explore collection ${collection.name}`}
          >
            <span className="homepage-collection-media">
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 768px) 70vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <span className="homepage-collection-fallback" aria-hidden="true" />
              )}
            </span>
            <span className="homepage-collection-veil" aria-hidden="true" />
            <span className="homepage-collection-veil-boost" aria-hidden="true" />
            <span className="homepage-collection-copy">
              <span className="label-sm text-ivory/80">Collection</span>
              <span className="homepage-collection-title font-display">{collection.name}</span>
              <span className="homepage-collection-description">{description}</span>
              <span className="homepage-collection-cta">
                Explore Collection
                <span className="homepage-collection-cta-arrow" aria-hidden="true">→</span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
