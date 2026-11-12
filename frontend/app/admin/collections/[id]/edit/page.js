import { notFound } from 'next/navigation';
import { CollectionForm } from '@/components/collection-form';
import { ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Edit collection' };

export default async function EditCollectionPage({ params }) {
  const { id } = await params;
  const { token } = await requireAdmin();

  let collection;
  try {
    collection = await api.adminCollection(id, { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">{collection.isPublished ? 'Published' : 'Draft'}</p>
        <h1 className="font-display text-4xl mt-2">Edit {collection.name}</h1>
      </div>
      <CollectionForm mode="edit" collection={collection} />
    </div>
  );
}
