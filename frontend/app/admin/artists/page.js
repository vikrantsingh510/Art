import Link from 'next/link';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Artists' };

export default async function AdminArtistsPage({ searchParams }) {
  const params = await searchParams;
  const { token } = await requireAdmin();
  const page = params.page || '1';
  const status = params.status || '';
  const q = params.q || '';
  let data = { items: [], total: 0, page: 1, limit: 20 };
  let loadError = null;
  try {
    data = await api.adminArtists({ page, limit: 20, status, q }, { token });
  } catch (error) {
    loadError = error;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-sm text-patina">Atelier ledger</p>
          <h1 className="font-display text-4xl mt-2">Artists</h1>
        </div>
        <Button href="/admin/artists/new">Add artist</Button>
      </div>
      <form className="flex flex-wrap gap-4 items-end" action="/admin/artists">
        <label>
          <span className="label-md text-patina">Search</span>
          <input className="field-input" name="q" defaultValue={q} />
        </label>
        <label>
          <span className="label-md text-patina">Status</span>
          <select className="field-input" name="status" defaultValue={status}>
            <option value="">All</option>
            {['draft', 'published'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      {loadError ? (
        <ErrorState error={loadError} retryHref="/admin/artists" />
      ) : (data.items || []).length === 0 ? (
        <EmptyState title="No artists in this filter" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="label-md text-patina border-b border-fillet">
                <th className="py-3">Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((artist) => (
                <tr key={artist.id} className="border-b border-fillet">
                  <td className="py-4">
                    <Link href={`/admin/artists/${artist.id}/edit`}>{artist.name}</Link>
                  </td>
                  <td>{artist.slug}</td>
                  <td>{artist.status}</td>
                  <td>{artist.publishedAt ? new Date(artist.publishedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    {artist.status === 'published' ? (
                      <Link href={`/artists/${artist.slug}`} className="text-link">View</Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={data.page}
        limit={data.limit}
        total={data.total}
        makeHref={(next) => {
          const search = new URLSearchParams({ q, status, page: String(next) });
          return `/admin/artists?${search.toString()}`;
        }}
      />
    </div>
  );
}
