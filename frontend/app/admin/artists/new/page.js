import { ArtistForm } from '@/components/artist-form';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'New artist' };

export default async function NewArtistPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">Atelier</p>
        <h1 className="font-display text-4xl mt-2">Add an artist</h1>
      </div>
      <ArtistForm mode="create" />
    </div>
  );
}
