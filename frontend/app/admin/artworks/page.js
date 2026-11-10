import Link from 'next/link';
import { ArchiveArtworkButton } from '@/components/archive-artwork-button';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { canShowArchiveAction } from '@/lib/artwork-archive';
import { formatInrFromPaise } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Artwork collection' };

export default async function AdminArtworksPage({ searchParams }) {
  const params = await searchParams;
  const { token } = await requireAdmin();
  const page = params.page || '1';
  const status = params.status || '';
  const q = params.q || '';
  let data = { items: [], total: 0, page: 1, limit: 20 };
  let loadError = null;
  try {
    data = await api.adminArtworks({ page, limit: 20, status, q }, { token });
  } catch (error) {
    loadError = error;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-sm text-patina">Inventory ledger</p>
          <h1 className="font-display text-4xl mt-2">Artwork collection</h1>
        </div>
        <Button href="/admin/artworks/new">Add new artwork</Button>
      </div>
      <form className="flex flex-wrap gap-4 items-end" action="/admin/artworks">
        <label>
          <span className="label-md text-patina">Search</span>
          <input className="field-input" name="q" defaultValue={q} />
        </label>
        <label>
          <span className="label-md text-patina">Status</span>
          <select className="field-input" name="status" defaultValue={status}>
            <option value="">All</option>
            {['draft', 'published', 'reserved', 'sold', 'archived'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      {loadError ? (
        <ErrorState error={loadError} retryHref="/admin/artworks" />
      ) : (data.items || []).length === 0 ? (
        <EmptyState title="No artworks in this filter" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="label-md text-patina border-b border-fillet">
                <th className="py-3">Artwork</th>
                <th>Artist</th>
                <th>Status</th>
                <th>Valuation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((artwork) => (
                <tr key={artwork.id} className="border-b border-fillet">
                  <td className="py-4">
                    <Link href={`/admin/artworks/${artwork.id}/edit`}>{artwork.title}</Link>
                  </td>
                  <td>{artwork.artistName}</td>
                  <td>{artwork.status}</td>
                  <td>{formatInrFromPaise(artwork.pricePaise)}</td>
                  <td>
                    {canShowArchiveAction(artwork) ? (
                      <ArchiveArtworkButton artworkId={artwork.id} title={artwork.title} />
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
          return `/admin/artworks?${search.toString()}`;
        }}
      />
    </div>
  );
}
