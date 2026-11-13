import { ArtworkCard } from '@/components/artwork-card';
import { WishlistItemActions } from '@/components/collection-actions';
import { EmptyState } from '@/components/states';
import { Button, Notice } from '@/components/ui';
import { loadWishlist } from '@/lib/gallery-entity-loaders';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Wishlist' };

export default async function WishlistPage() {
  await requireUser();
  const wishlist = await loadWishlist();
  const items = wishlist?.items || [];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">Wishlist</h1>
      <Notice>
        Saved works are independent from the collector bag. Wishlist never reserves inventory or starts checkout.
      </Notice>
      {items.length === 0 ? (
        <EmptyState
          title="No saved works"
          description="Save an original from an artwork page."
          action={<Button href="/explore" variant="secondary">Explore the collection</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {items.map((item) => (
            item.artwork ? (
              <div key={item.id} className="space-y-4">
                <ArtworkCard artwork={item.artwork} />
                <WishlistItemActions artworkId={item.artworkId} purchasable={item.artwork.isPurchasable} />
              </div>
            ) : (
              <p key={item.id} className="text-sm text-on-surface-variant">A saved work is no longer in the catalogue.</p>
            )
          ))}
        </div>
      )}
    </div>
  );
}
