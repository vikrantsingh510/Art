import { ArtworkForm } from '@/components/artwork-form';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Add artwork' };

export default async function NewArtworkPage() {
  const { token } = await requireAdmin();
  const [categories, collections, artists] = await Promise.all([
    api.adminCategories({ token }),
    api.adminCollections({ token }),
    api.adminArtists({ limit: 100 }, { token }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">Lot registration</p>
        <h1 className="font-display text-4xl mt-2">Catalog a new artwork</h1>
      </div>
      <ArtworkForm
        mode="create"
        categories={Array.isArray(categories) ? categories : []}
        collections={Array.isArray(collections) ? collections : []}
        artists={Array.isArray(artists?.items) ? artists.items : []}
      />
    </div>
  );
}
