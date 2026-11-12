import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArtworkCard } from '@/components/artwork-card';
import { MarkdownBody } from '@/components/markdown-body';
import { ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { canonicalFor } from '@/lib/journal-origin';
import { publicStorageUrl } from '@/lib/media';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const canonical = await canonicalFor(`/artists/${slug}`);
  try {
    const artist = await api.getArtist(slug);
    const portraitUrl = publicStorageUrl(artist.profileImagePath);
    const title = artist.seoTitle || artist.name;
    const description = artist.seoDescription || artist.shortBio || 'An artist at Maison d’Art.';
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: 'profile',
        images: portraitUrl ? [{ url: portraitUrl, alt: artist.profileImageAlt || artist.name }] : undefined,
      },
    };
  } catch {
    return {
      title: 'Artists',
      alternates: { canonical },
    };
  }
}

export default async function ArtistDetailPage({ params }) {
  const { slug } = await params;
  let artist;
  try {
    artist = await api.getArtist(slug);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return (
      <div className="page-shell py-16">
        <ErrorState error={error} retryHref={`/artists/${slug}`} />
      </div>
    );
  }

  const portraitUrl = publicStorageUrl(artist.profileImagePath);

  return (
    <article>
      <header className="page-shell pt-12 md:pt-20 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5 space-y-4">
            <p className="label-sm text-patina">Artist</p>
            <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">{artist.name}</h1>
            {artist.location ? <p className="label-sm text-patina">{artist.location}</p> : null}
            {artist.artisticStyle || artist.medium ? (
              <p className="text-sm text-on-surface-variant">
                {[artist.artisticStyle, artist.medium].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          <div className="lg:col-span-7 space-y-6">
            {artist.shortBio ? (
              <p className="max-w-xl text-[15px] leading-6 text-on-surface-variant">{artist.shortBio}</p>
            ) : null}
            {portraitUrl ? (
              <div className="relative aspect-[4/5] max-w-md bg-surface-container-low">
                <Image
                  src={portraitUrl}
                  alt={artist.profileImageAlt || artist.name}
                  fill
                  unoptimized
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {artist.biography ? (
        <div id="story" className="page-shell pb-16 scroll-mt-28">
          <MarkdownBody markdown={artist.biography} />
        </div>
      ) : (
        <div id="story" className="scroll-mt-28" />
      )}
      <section id="works" className="page-shell pb-20 space-y-8 scroll-mt-28">
        <div>
          <p className="label-sm text-patina">On view</p>
          <h2 className="font-display text-3xl mt-2">Published works</h2>
        </div>
        {(artist.artworks || []).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {artist.artworks.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">No published works are currently associated with this artist.</p>
        )}
      </section>
    </article>
  );
}
