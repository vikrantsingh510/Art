import Link from 'next/link';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/states';
import { Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Customers' };

export default async function AdminCustomersPage({ searchParams }) {
  const params = await searchParams;
  const { token } = await requireAdmin();
  const page = params.page || '1';
  const data = await api.adminCustomers({ page, limit: 20 }, { token });
  const localQ = (params.localQ || '').toLowerCase();
  const items = (data.items || []).filter((profile) => {
    if (!localQ) {
      return true;
    }
    return `${profile.fullName || ''} ${profile.phone || ''}`.toLowerCase().includes(localQ);
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">Collector register</p>
        <h1 className="font-display text-4xl mt-2">Customers</h1>
      </div>
      <Notice>
        Server-side search (`q`) is stripped by the HTTP validator. The box below only filters the current page, not the full register.
      </Notice>
      <form className="max-w-sm" action="/admin/customers">
        <input type="hidden" name="page" value={page} />
        <input className="field-input" name="localQ" defaultValue={params.localQ || ''} placeholder="Filter this page" />
      </form>
      {items.length === 0 ? (
        <EmptyState title="No customers on this page" />
      ) : (
        <ul className="divide-y divide-fillet border-y border-fillet">
          {items.map((profile) => (
            <li key={profile.id} className="py-4 flex justify-between gap-4">
              <div>
                <Link href={`/admin/customers/${profile.id}`}>{profile.fullName || 'Unnamed collector'}</Link>
                <p className="text-xs text-patina mt-1">{profile.phone || 'No phone'} · {formatDate(profile.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={data.page}
        limit={data.limit}
        total={data.total}
        makeHref={(next) => `/admin/customers?page=${next}`}
      />
    </div>
  );
}
