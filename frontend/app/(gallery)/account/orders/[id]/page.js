import { notFound } from 'next/navigation';
import { ErrorState } from '@/components/states';
import { Notice } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { formatDate, orderStatusLabel } from '@/lib/format';
import { formatInrFromPaise } from '@/lib/money';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Order' };

export default async function CustomerOrderDetailPage({ params }) {
  const { id } = await params;
  const { token } = await requireUser();

  let order;
  try {
    order = await api.getOrder(id, { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return <ErrorState error={error} retryHref={`/account/orders/${id}`} />;
  }

  const reservation = (order.reservations || []).find((item) => item.status === 'active');

  return (
    <div className="space-y-8">
      <div>
        <p className="label-md text-patina">{orderStatusLabel(order.status)}</p>
        <h1 className="font-display text-4xl mt-2">{order.orderNumber}</h1>
        <p className="text-sm text-on-surface-variant mt-2">Placed {formatDate(order.placedAt)}</p>
      </div>
      {order.status === 'pending_payment' ? (
        <Notice>
          This is a reservation request. Payment is not enabled, so the order is not paid, captured, or receipted. Inventory is held until {reservation ? formatDate(reservation.expiresAt) : 'the reservation window ends'}.
        </Notice>
      ) : (
        <Notice>Order state is reported by the API. This screen does not initiate refunds or shipments.</Notice>
      )}
      <ul className="space-y-3">
        {(order.items || []).map((item) => (
          <li key={item.id || item.artworkId} className="flex justify-between border-b border-fillet pb-3">
            <span>{item.artworkTitle}</span>
            <span>{formatInrFromPaise(item.totalPricePaise)} · qty {item.quantity}</span>
          </li>
        ))}
      </ul>
      <p className="text-lg">Total {formatInrFromPaise(order.totalPaise)}</p>
      {order.shippingAddressSnapshot ? (
        <div>
          <p className="label-md text-patina">Shipping snapshot</p>
          <p className="text-sm mt-2 whitespace-pre-wrap">
            {order.shippingAddressSnapshot.recipientName}
            {'\n'}
            {order.shippingAddressSnapshot.addressLine1}
            {order.shippingAddressSnapshot.addressLine2 ? `\n${order.shippingAddressSnapshot.addressLine2}` : ''}
            {'\n'}
            {order.shippingAddressSnapshot.city}, {order.shippingAddressSnapshot.state} {order.shippingAddressSnapshot.postalCode}
          </p>
        </div>
      ) : null}
    </div>
  );
}
