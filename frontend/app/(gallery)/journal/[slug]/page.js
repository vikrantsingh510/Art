import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArtworkCard } from '@/components/artwork-card';
import { MarkdownBody } from '@/components/markdown-body';
import { ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { journalCanonical } from '@/lib/journal-origin';
import { publicStorageUrl } from '@/lib/media';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const canonical = await journalCanonical(`/journal/${slug}`);
  try {
    const blog = await api.getBlog(slug);
    const coverUrl = publicStorageUrl(blog.coverImagePath);
    const title = blog.seoTitle || blog.title;
    const description = blog.seoDescription || blog.excerpt || 'A Maison d’Art journal entry.';
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: 'article',
        publishedTime: blog.publishedAt || undefined,
        images: coverUrl ? [{ url: coverUrl, alt: blog.coverAltText || blog.title }] : undefined,
      },
    };
  } catch {
    return {
      title: 'Journal',
      alternates: { canonical },
    };
  }
}

export default async function JournalDetailPage({ params }) {
  const { slug } = await params;
  let blog;
  try {
    blog = await api.getBlog(slug);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return (
      <div className="page-shell py-16">
        <ErrorState error={error} retryHref={`/journal/${slug}`} />
      </div>
    );
  }

  const coverUrl = publicStorageUrl(blog.coverImagePath);
  const published = blog.publishedAt
    ? new Date(blog.publishedAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : null;

  return (
    <article>
      <header className="page-shell pt-12 md:pt-20 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5 space-y-4">
            <p className="label-sm text-patina">Journal</p>
            <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">{blog.title}</h1>
            {published ? <p className="label-sm text-patina">{published}</p> : null}
          </div>
          <div className="lg:col-span-7 space-y-6">
            {blog.excerpt ? (
              <p className="max-w-xl text-[15px] leading-6 text-on-surface-variant">{blog.excerpt}</p>
            ) : null}
            {coverUrl ? (
              <div className="relative aspect-[16/9] bg-surface-container-low">
                <Image
                  src={coverUrl}
                  alt={blog.coverAltText || blog.title}
                  fill
                  unoptimized
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className="page-shell pb-16">
        <MarkdownBody markdown={blog.body} />
      </div>
      {(blog.artworks || []).length > 0 ? (
        <section className="page-shell pb-20 space-y-8">
          <div>
            <p className="label-sm text-patina">On view</p>
            <h2 className="font-display text-3xl mt-2">Related artworks</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {blog.artworks.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
