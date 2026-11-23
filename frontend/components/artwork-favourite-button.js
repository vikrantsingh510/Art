'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiClientError } from '@/lib/api-client';
import { createBrowserArtApi } from '@/lib/browser-api';
import { pendingButtonProps } from '@/lib/pending-action';
import { requireSession } from '@/lib/require-browser-session';
import {
  isWishlistRemoveNotFound,
  rememberArtworkFavourite,
  resolveArtworkFavouriteSaved,
  wishlistFavouriteLabel,
  wishlistLoginPath,
} from '@/lib/wishlist-favourite';
import { ActionStatus } from './loading';
import { IconHeart } from './icons';

export function ArtworkFavouriteButton({ artworkId, saved: savedProp = false }) {
  const router = useRouter();
  const pathname = usePathname();
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
  const label = wishlistFavouriteLabel(saved);

  async function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    if (pending || !artworkId) {
      return;
    }

    setError('');
    const nextPath = pathname || '/';

    try {
      const session = await requireSession(router, nextPath);
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
          router.push(wishlistLoginPath(nextPath));
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
    <div className="absolute top-3 right-3 z-10">
      <button
        type="button"
        className={`artwork-favourite-button inline-flex h-12 w-12 items-center justify-center bg-transparent disabled:opacity-60${saved ? ' is-saved' : ''}`}
        aria-label={label}
        title={error || label}
        aria-pressed={saved}
        data-saved={saved ? 'true' : 'false'}
        onClick={toggle}
        onPointerDown={(event) => event.stopPropagation()}
        {...pendingButtonProps(pending)}
      >
        <IconHeart className="artwork-favourite-icon" filled={saved} />
      </button>
      <ActionStatus
        pending={pending}
        pendingLabel={saved ? 'Removing from wishlist' : 'Saving to wishlist'}
        error={error}
        variant="live"
      />
      {error ? (
        <p className="absolute right-0 top-[calc(100%+0.35rem)] w-40 bg-ivory/95 px-2 py-1 text-left text-[11px] leading-4 text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
