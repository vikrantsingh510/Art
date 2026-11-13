import { notFound } from 'next/navigation';
import { ArtistProfile } from '@/components/artist-profile';
import { ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { loadArtistBySlug } from '@/lib/gallery-entity-loaders';
import { canonicalFor } from '@/lib/journal-origin';
import { publicStorageUrl } from '@/lib/media';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const canonical = await canonicalFor(`/artists/${slug}`);
  try {
    const artist = await loadArtistBySlug(slug);
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
  let listed = { items: [] };
  try {
    [artist, listed] = await Promise.all([
      loadArtistBySlug(slug),
      api.listArtists({ limit: 8 }).catch(() => ({ items: [] })),
    ]);
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

  const peers = (listed?.items || []).filter((item) => item.slug !== artist.slug).slice(0, 3);

  return <ArtistProfile artist={artist} peers={peers} />;
}
