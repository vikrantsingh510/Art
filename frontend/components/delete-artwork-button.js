'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { artworkPermanentDeleteConfirm } from '@/lib/artwork-delete';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus } from './loading';

export function DeleteArtworkButton({ artworkId, title, redirectTo = '/admin/artworks' }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    const confirmed = window.confirm(artworkPermanentDeleteConfirm({ title, id: artworkId }));
    if (!confirmed) {
      return;
    }
    setPending(true);
    setError('');
    try {
      const client = await createBrowserArtApi();
      await client.deleteArtwork(artworkId);
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
      setPending(false);
    }
  }

  return (
    <div>
      <button className="text-link" type="button" {...pendingButtonProps(pending)} onClick={remove}>
        {pending ? 'Deleting…' : 'Delete permanently'}
      </button>
      <ActionStatus pending={pending} pendingLabel="Deleting artwork" error={error} variant="inline" />
    </div>
  );
}
