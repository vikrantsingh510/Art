import { CheckoutForm } from '@/components/checkout-form';
import { EmptyState } from '@/components/states';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { loadCart } from '@/lib/gallery-entity-loaders';
import { formatInrFromPaise } from '@/lib/money';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const { token } = await requireUser();
  const [cart, addresses] = await Promise.all([
    loadCart(),
    api.listAddresses({ token }),
  ]);
  const items = cart?.items || [];

  return (
    <div className="page-shell py-12">
    <div className="max-w-3xl space-y-8">
      <h1 className="font-display text-4xl">Reservation checkout</h1>
      <Notice>
        This step creates a pending_payment order and a 15-minute inventory hold. Payment is not enabled. You will not receive a paid receipt, captured settlement, or shipment booking.
      </Notice>
      {items.length === 0 ? (
        <EmptyState title="Nothing to reserve" action={<Button href="/cart" variant="secondary">Return to bag</Button>} />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 border-b border-fillet pb-3">
                <span>{item.artwork?.title || 'Unavailable work'}</span>
                <span>{item.artwork ? formatInrFromPaise(item.artwork.pricePaise) : '—'}</span>
              </li>
            ))}
          </ul>
          <CheckoutForm addresses={addresses || []} />
        </>
      )}
    </div>
    </div>
  );
}
