import Link from 'next/link';
import { EmptyState } from '@/components/states';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, orderStatusLabel } from '@/lib/format';
import { formatInrFromPaise } from '@/lib/money';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Orders' };

export default async function OrdersPage() {
  const { token } = await requireUser();
  const orders = await api.listOrders({ token });

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">Orders</h1>
      <Notice>
        Status values come from the API. pending_payment means a reservation exists, not that money was captured.
      </Notice>
      {(orders || []).length === 0 ? (
        <EmptyState title="No reservations yet" action={<Button href="/explore" variant="secondary">Explore works</Button>} />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="border border-fillet p-5">
              <Link href={`/account/orders/${order.id}`} className="font-display text-2xl">
                {order.orderNumber}
              </Link>
              <p className="text-sm text-on-surface-variant mt-2">
                {orderStatusLabel(order.status)} · {formatInrFromPaise(order.totalPaise)} · {formatDate(order.placedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
