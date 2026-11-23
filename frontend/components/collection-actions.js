'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/lib/api-client';
import { createBrowserArtApi } from '@/lib/browser-api';
import { pendingButtonProps } from '@/lib/pending-action';
import { requireSession } from '@/lib/require-browser-session';
import {
  isWishlistRemoveNotFound,
  rememberArtworkFavourite,
  resolveArtworkFavouriteSaved,
  wishlistDetailCtaLabel,
  wishlistLoginPath,
} from '@/lib/wishlist-favourite';
import { IconHeart } from './icons';
import { ActionStatus, ButtonLoader } from './loading';

export function AddToCartButton({ artworkId, purchasable, nextPath }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!purchasable) {
    return (
      <p className="notice">This work is not currently available for acquisition. Quantity cannot be requested.</p>
    );
  }

  async function add() {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const session = await requireSession(router, nextPath || `/artwork/${artworkId}`);
      if (!session) {
        return;
      }
      const client = await createBrowserArtApi();
      await client.addCartItem(artworkId);
      setMessage('Added to your collector bag. Wishlist is separate and was not changed.');
      router.refresh();
    } catch (caught) {
      if (caught?.status === 401) {
        router.push(`/auth/login?next=${encodeURIComponent(nextPath || `/artwork/${artworkId}`)}`);
        return;
      }
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button className="btn-primary w-full" type="button" {...pendingButtonProps(pending)} onClick={add}>
        {pending ? <ButtonLoader label="Adding…" /> : 'Add to bag'}
      </button>
      <p className="text-xs text-patina">Adds the unique original to your bag. Payment is not taken at this step.</p>
      <ActionStatus pending={pending} pendingLabel="Adding to bag" message={message} error={error} />
    </div>
  );
}

export function AddToWishlistButton({ artworkId, saved: savedProp = false, nextPath }) {
  const router = useRouter();
  const serverSaved = Boolean(savedProp);
  const [override, setOverride] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (override === null && serverSaved) {
    rememberArtworkFavourite(artworkId, true);
  }

  if (override !== null && override === serverSaved) {
    setOverride(null);
  }

  const saved = override ?? resolveArtworkFavouriteSaved(artworkId, serverSaved);
  const label = wishlistDetailCtaLabel(saved);
  const loginNext = nextPath || `/artwork/${artworkId}`;

  async function toggle() {
    if (pending || !artworkId) {
      return;
    }

    setError('');
    try {
      const session = await requireSession(router, loginNext);
      if (!session) {
        return;
      }

      const previousSaved = saved;
      const nextSaved = !previousSaved;
      setOverride(nextSaved);
      rememberArtworkFavourite(artworkId, nextSaved);
      setPending(true);

      try {
        const client = await createBrowserArtApi();
        if (nextSaved) {
          await client.addWishlistItem(artworkId);
        } else {
          try {
            await client.removeWishlistItem(artworkId);
          } catch (caught) {
            if (!isWishlistRemoveNotFound(caught)) {
              throw caught;
            }
          }
        }
        rememberArtworkFavourite(artworkId, nextSaved);
        router.refresh();
      } catch (caught) {
        setOverride(previousSaved);
        rememberArtworkFavourite(artworkId, previousSaved);
        if (caught?.status === 401) {
          router.push(wishlistLoginPath(loginNext));
          return;
        }
        setError(caught instanceof ApiClientError ? caught.message : caught.message);
      } finally {
        setPending(false);
      }
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    }
  }

  return (
    <div className="space-y-3">
      <button
        className="btn-secondary artwork-wishlist-cta w-full"
        type="button"
        aria-pressed={saved}
        data-saved={saved ? 'true' : 'false'}
        aria-label={label}
        {...pendingButtonProps(pending)}
        onClick={toggle}
      >
        {pending ? (
          <ButtonLoader label={saved ? 'Saving…' : 'Removing…'} />
        ) : (
          <>
            <IconHeart className="artwork-wishlist-cta-icon shrink-0" filled={saved} />
            {label}
          </>
        )}
      </button>
      <ActionStatus
        pending={pending}
        pendingLabel={saved ? 'Saving to wishlist' : 'Removing from wishlist'}
        error={error}
      />
    </div>
  );
}

export function RemoveCartItemButton({ artworkId }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setPending(true);
    setError('');
    try {
      const client = await createBrowserArtApi();
      await client.removeCartItem(artworkId);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button className="text-link" type="button" {...pendingButtonProps(pending)} onClick={remove}>
        {pending ? 'Removing…' : 'Remove from bag'}
      </button>
      <ActionStatus pending={pending} pendingLabel="Removing from bag" error={error} variant="inline" />
    </div>
  );
}

export function WishlistItemActions({ artworkId, purchasable }) {
  const router = useRouter();
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');

  async function run(action) {
    setPending(action);
    setError('');
    try {
      const client = await createBrowserArtApi();
      if (action === 'remove') {
        await client.removeWishlistItem(artworkId);
      } else {
        await client.moveWishlistItemToCart(artworkId);
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending('');
    }
  }

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {purchasable ? (
        <button className="text-link" type="button" {...pendingButtonProps(pending)} onClick={() => run('move')}>
          {pending === 'move' ? 'Moving…' : 'Move to bag'}
        </button>
      ) : (
        <span className="text-xs text-patina">Not available to acquire</span>
      )}
      <button className="text-link" type="button" {...pendingButtonProps(pending)} onClick={() => run('remove')}>
        {pending === 'remove' ? 'Removing…' : 'Remove'}
      </button>
      <ActionStatus
        pending={pending}
        pendingLabel={pending === 'remove' ? 'Removing from wishlist' : 'Moving to bag'}
        error={error}
        variant="inline"
      />
    </div>
  );
}
