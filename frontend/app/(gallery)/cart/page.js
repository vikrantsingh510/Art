import Link from 'next/link';
import { RemoveCartItemButton } from '@/components/cart-actions';
import { EmptyState } from '@/components/states';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { formatInrFromPaise } from '@/lib/money';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Collector bag' };

export default async function CartPage() {
  const { token } = await requireUser();
  const cart = await api.getCart({ token });
  const items = cart?.items || [];
  const total = items.reduce((sum, item) => sum + Number(item.artwork?.pricePaise || 0), 0);

  return (
    <div className="page-shell py-12 space-y-8">
      <h1 className="font-display text-4xl">Collector bag</h1>
      <Notice>
        Quantity is one per original. Checkout reserves inventory for 15 minutes without taking payment. Wishlist is a separate list and is not checked out.
      </Notice>
      {items.length === 0 ? (
        <EmptyState
          title="The bag is empty"
          action={<Button href="/explore" variant="secondary">Explore works</Button>}
        />
      ) : (
        <ul className="space-y-6">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-fillet pb-6">
              <div>
                <p className="font-display text-2xl italic">
                  {item.artwork ? (
                    <Link href={`/artwork/${item.artwork.id}`}>{item.artwork.title}</Link>
                  ) : 'Unavailable work'}
                </p>
                <p className="text-sm text-on-surface-variant">{item.artwork?.artistName}</p>
                <p className="mt-2">{item.artwork ? formatInrFromPaise(item.artwork.pricePaise) : '—'}</p>
                <p className="text-xs text-patina mt-1">Qty 1 · quantity editing is not supported</p>
              </div>
              {item.artworkId ? <RemoveCartItemButton artworkId={item.artworkId} /> : null}
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-lg">Reservation total {formatInrFromPaise(total)}</p>
          <Button href="/checkout">Continue to reservation</Button>
        </div>
      ) : null}
    </div>
  );
}
