'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/lib/api-client';
import { createBrowserArtApi } from '@/lib/browser-api';
import { isSupabaseConfigured } from '@/lib/env';
import { pendingButtonProps } from '@/lib/pending-action';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { ActionStatus, ButtonLoader } from './loading';

async function requireSession(router, nextPath) {
  if (!isSupabaseConfigured()) {
    throw new Error('Authentication is not configured in this environment.');
  }
  const supabase = createBrowserSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    router.push(`/auth/login?next=${encodeURIComponent(nextPath)}`);
    return null;
  }
  return session;
}

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

export function AddToWishlistButton({ artworkId, nextPath }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      await client.addWishlistItem(artworkId);
      setMessage('Saved to wishlist. This does not reserve inventory or add the work to your bag.');
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
      <button className="btn-secondary w-full" type="button" {...pendingButtonProps(pending)} onClick={add}>
        {pending ? <ButtonLoader label="Saving…" /> : 'Save to wishlist'}
      </button>
      <ActionStatus pending={pending} pendingLabel="Saving to wishlist" message={message} error={error} />
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
