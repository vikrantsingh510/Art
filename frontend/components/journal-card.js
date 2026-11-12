import Link from 'next/link';
import Image from 'next/image';
import { publicStorageUrl } from '@/lib/media';
import { ImagePlaceholder } from './loading';

export function JournalCard({ blog }) {
  const coverUrl = publicStorageUrl(blog.coverImagePath);
  const published = blog.publishedAt
    ? new Date(blog.publishedAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : null;

  return (
    <article className="border-t border-fillet pt-6 space-y-4">
      <Link href={`/journal/${blog.slug}`} className="block space-y-4">
        {coverUrl ? (
          <div className="relative aspect-[16/9] bg-surface-container-low">
            <Image
              src={coverUrl}
              alt={blog.coverAltText || blog.title}
              fill
              unoptimized
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <ImagePlaceholder className="max-w-md" label="No cover" />
        )}
        {published ? <p className="label-sm text-patina">{published}</p> : null}
        <h2 className="font-display text-3xl italic leading-tight">{blog.title}</h2>
        {blog.excerpt ? (
          <p className="text-[15px] leading-6 text-on-surface-variant">{blog.excerpt}</p>
        ) : null}
        <p className="label-sm text-bronze">Read the entry</p>
      </Link>
    </article>
  );
}
