import { CollectionForm } from '@/components/collection-form';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'New collection' };

export default async function NewCollectionPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">Editorial hanging</p>
        <h1 className="font-display text-4xl mt-2">Create collection</h1>
      </div>
      <CollectionForm mode="create" />
    </div>
  );
}
