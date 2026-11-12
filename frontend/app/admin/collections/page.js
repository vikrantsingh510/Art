import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { publicStorageUrl } from '@/lib/media';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Collections' };

export default async function AdminCollectionsPage() {
  const { token } = await requireAdmin();
  let collections = [];
  let loadError = null;
  try {
    const data = await api.adminCollections({ token });
    collections = Array.isArray(data) ? data : [];
  } catch (error) {
    loadError = error;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-sm text-patina">Editorial hangings</p>
          <h1 className="font-display text-4xl mt-2">Collections</h1>
        </div>
        <Button href="/admin/collections/new">Create collection</Button>
      </div>
      {loadError ? (
        <ErrorState error={loadError} retryHref="/admin/collections" />
      ) : collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          description="Create a hanging, add published works, then release it to the salon."
          action={<Button href="/admin/collections/new">Create collection</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="label-md text-patina border-b border-fillet">
                <th className="py-3">Cover</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Artworks</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => {
                const coverUrl = publicStorageUrl(collection.coverImagePath);
                return (
                  <tr key={collection.id} className="border-b border-fillet">
                    <td className="py-4">
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverUrl} alt="" className="h-14 w-20 object-cover bg-surface-container-low" />
                      ) : (
                        <div className="h-14 w-20 bg-surface-container-low" />
                      )}
                    </td>
                    <td>
                      <Link href={`/admin/collections/${collection.id}/edit`}>{collection.name}</Link>
                    </td>
                    <td>{collection.slug}</td>
                    <td>{collection.artworkCount ?? 0}</td>
                    <td>{collection.isPublished ? 'Published' : 'Draft'}</td>
                    <td>{formatDate(collection.updatedAt)}</td>
                    <td>
                      <Link href={`/admin/collections/${collection.id}/edit`} className="text-link">Edit</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
