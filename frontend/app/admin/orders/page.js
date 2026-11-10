import Link from 'next/link';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState } from '@/components/states';
import { Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { adminOrdersHref, parseAdminOrdersQuery } from '@/lib/admin-orders-query';
import { formatDate, orderStatusLabel } from '@/lib/format';
import { formatInrFromPaise } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Orders' };

const ORDER_STATUSES = [
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refund_pending',
  'refunded',
];

const PAYMENT_STATUSES = ['created', 'authorized', 'captured', 'failed'];

export default async function AdminOrdersPage({ searchParams }) {
  const params = parseAdminOrdersQuery(await searchParams);
  const { token } = await requireAdmin();
  let data = { items: [], total: 0, page: 1, limit: 20 };
  let loadError = null;
  try {
    data = await api.adminOrders(params, { token });
  } catch (error) {
    loadError = error;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">Salon ledger</p>
        <h1 className="font-display text-4xl mt-2">Acquisitions &amp; dispatches</h1>
      </div>
      <Notice>
        This register lists real orders. Payment capture, refunds and courier dispatch remain deferred and are not offered here.
      </Notice>
      <form className="grid md:grid-cols-2 xl:grid-cols-6 gap-4 items-end" action="/admin/orders">
        <label className="xl:col-span-2">
          <span className="label-md text-patina">Search</span>
          <input className="field-input" name="q" defaultValue={params.q} placeholder="Order number, UUID, name, phone" />
        </label>
        <label>
          <span className="label-md text-patina">Status</span>
          <select className="field-input" name="status" defaultValue={params.status}>
            <option value="">All</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>{orderStatusLabel(status)}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label-md text-patina">Payment</span>
          <select className="field-input" name="paymentStatus" defaultValue={params.paymentStatus}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label-md text-patina">From</span>
          <input className="field-input" type="date" name="from" defaultValue={params.from} />
        </label>
        <label>
          <span className="label-md text-patina">To</span>
          <input className="field-input" type="date" name="to" defaultValue={params.to} />
        </label>
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      {loadError ? <ErrorState error={loadError} retryHref="/admin/orders" /> : null}
      {!loadError && data.items.length === 0 ? (
        <EmptyState title="No orders match these filters" />
      ) : null}
      {data.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left">
            <thead>
              <tr className="border-b border-fillet label-sm text-patina">
                <th className="py-3 pr-4">Order</th>
                <th className="py-3 pr-4">Placed</th>
                <th className="py-3 pr-4">Collector</th>
                <th className="py-3 pr-4">Items</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((order) => (
                <tr key={order.id} className="border-b border-fillet align-top">
                  <td className="py-4 pr-4">
                    <Link href={`/admin/orders/${order.id}`} className="text-link">{order.orderNumber}</Link>
                    <p className="text-xs text-patina mt-1">{order.id}</p>
                  </td>
                  <td className="py-4 pr-4 text-sm">{formatDate(order.placedAt)}</td>
                  <td className="py-4 pr-4 text-sm">
                    {order.customerFullName || 'Unnamed'}
                    <p className="text-xs text-patina mt-1">{order.customerPhone || 'No phone'}</p>
                  </td>
                  <td className="py-4 pr-4">{order.itemCount}</td>
                  <td className="py-4 pr-4">{formatInrFromPaise(order.totalPaise)}</td>
                  <td className="py-4 pr-4 text-sm">
                    {orderStatusLabel(order.status)}
                    {order.reservationExpiresAt ? (
                      <p className="text-xs text-patina mt-1">Hold until {formatDate(order.reservationExpiresAt)}</p>
                    ) : null}
                  </td>
                  <td className="py-4 text-sm">{order.paymentStatus || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Pagination
        page={data.page}
        limit={data.limit}
        total={data.total}
        makeHref={(page) => adminOrdersHref(params, page)}
      />
    </div>
  );
}
