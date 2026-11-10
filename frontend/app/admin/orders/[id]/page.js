import { notFound } from 'next/navigation';
import { ErrorState } from '@/components/states';
import { Notice } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { formatDate, orderStatusLabel } from '@/lib/format';
import { formatInrFromPaise } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Order docket' };

export default async function AdminOrderDetailPage({ params }) {
  const { id } = await params;
  const { token } = await requireAdmin();

  let order;
  let shipments = [];
  try {
    order = await api.getOrder(id, { token });
    try {
      shipments = await api.adminOrderShipments(id, { token }) || [];
    } catch {
      shipments = [];
    }
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return <ErrorState error={error} retryHref={`/admin/orders/${id}`} />;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="label-sm text-patina">{orderStatusLabel(order.status)}</p>
        <h1 className="font-display text-4xl mt-2">{order.orderNumber}</h1>
        <p className="text-sm text-on-surface-variant mt-2">Placed {formatDate(order.placedAt)}</p>
      </div>
      {order.status === 'pending_payment' ? (
        <Notice>
          This docket is not marked paid. Stitch escrow, GPS transit and installation steps are not wired. Payment capture and shipment booking remain deferred.
        </Notice>
      ) : (
        <Notice>Shipment booking, refunds and delivery confirmation controls are not shown.</Notice>
      )}
      <p className="text-lg">Total {formatInrFromPaise(order.totalPaise)} {order.currency}</p>
      <ul className="space-y-3">
        {(order.items || []).map((item) => (
          <li key={item.id || item.artworkId} className="flex justify-between border-b border-fillet pb-3">
            <span>{item.artworkTitle}</span>
            <span>{formatInrFromPaise(item.totalPricePaise)}</span>
          </li>
        ))}
      </ul>
      {order.shippingAddressSnapshot ? (
        <section>
          <h2 className="font-display text-2xl mb-2">Patron snapshot</h2>
          <p className="text-sm whitespace-pre-wrap">
            {order.shippingAddressSnapshot.recipientName}
            {'\n'}
            {order.shippingAddressSnapshot.addressLine1}
            {'\n'}
            {order.shippingAddressSnapshot.city}, {order.shippingAddressSnapshot.state}
          </p>
        </section>
      ) : null}
      <section>
        <h2 className="font-display text-2xl mb-2">Shipments on file</h2>
        {shipments.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No shipment rows. Creating or updating shipments is disabled in this frontend.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {shipments.map((shipment) => (
              <li key={shipment.id}>{shipment.status} · {shipment.courierName || 'unassigned'} · {shipment.trackingNumber || 'no tracking'}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
