import { notFound } from 'next/navigation';
import { ArtistForm } from '@/components/artist-form';
import { ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Edit artist' };

export default async function EditArtistPage({ params }) {
  const { id } = await params;
  const { token } = await requireAdmin();

  let artist;
  try {
    artist = await api.adminArtist(id, { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">{artist.status}</p>
        <h1 className="font-display text-4xl mt-2">Edit {artist.name}</h1>
      </div>
      <ArtistForm mode="edit" artist={artist} />
    </div>
  );
}
