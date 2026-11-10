import Link from 'next/link';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const { user } = await requireUser();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Welcome</h1>
      <p className="text-on-surface-variant">
        {user.isAdmin ? 'You have curatorial console access.' : 'You are signed in as a collector.'}
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/account/orders" className="border border-fillet p-6">
          <p className="label-md text-patina">Orders</p>
          <p className="font-display text-2xl mt-2">Reservation history</p>
        </Link>
        <Link href="/cart" className="border border-fillet p-6">
          <p className="label-md text-patina">Bag</p>
          <p className="font-display text-2xl mt-2">Works ready to reserve</p>
        </Link>
        <Link href="/account/wishlist" className="border border-fillet p-6">
          <p className="label-md text-patina">Wishlist</p>
          <p className="font-display text-2xl mt-2">Saved without holding stock</p>
        </Link>
      </div>
    </div>
  );
}
