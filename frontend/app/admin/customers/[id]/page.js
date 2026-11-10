import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ErrorState } from '@/components/states';
import { Notice } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { formatDate, orderStatusLabel } from '@/lib/format';
import { formatInrFromPaise } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Customer' };

export default async function AdminCustomerDetailPage({ params }) {
  const { id } = await params;
  const { token } = await requireAdmin();

  let data;
  try {
    data = await api.adminCustomer(id, { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">{(data.roles || []).join(', ')}</p>
        <h1 className="font-display text-4xl mt-2">{data.profile?.fullName || 'Collector'}</h1>
        <p className="text-sm text-on-surface-variant mt-2">{data.profile?.phone || 'No phone on file'}</p>
      </div>
      <Notice>Profile editing is not available. Orders listed here belong to this collector.</Notice>
      <section>
        <h2 className="font-display text-2xl mb-4">Orders</h2>
        {(data.orders || []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No orders.</p>
        ) : (
          <ul className="space-y-3">
            {data.orders.map((order) => (
              <li key={order.id} className="flex justify-between gap-4 border-b border-fillet pb-3">
                <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                <span className="text-sm">{orderStatusLabel(order.status)} · {formatInrFromPaise(order.totalPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-patina">Joined {formatDate(data.profile?.createdAt)}</p>
    </div>
  );
}
