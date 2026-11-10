import { notFound } from 'next/navigation';
import { ArtworkForm } from '@/components/artwork-form';
import { ErrorState } from '@/components/states';
import { Notice } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Edit artwork' };

export default async function EditArtworkPage({ params }) {
  const { id } = await params;
  const { token } = await requireAdmin();

  let artwork;
  try {
    artwork = await api.getArtwork(id, { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return <ErrorState error={error} />;
  }

  const [categories, collections] = await Promise.all([
    api.adminCategories({ token }),
    api.adminCollections({ token }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">{artwork.status}</p>
        <h1 className="font-display text-4xl mt-2">Edit {artwork.title}</h1>
      </div>
      <Notice>
        Up to five public images can be catalogued. Removing an image deletes its Storage object after the catalogue row is removed. Private media cannot be opened without signed URLs.
      </Notice>
      <ArtworkForm
        mode="edit"
        artwork={artwork}
        categories={Array.isArray(categories) ? categories : []}
        collections={Array.isArray(collections) ? collections : []}
      />
    </div>
  );
}
