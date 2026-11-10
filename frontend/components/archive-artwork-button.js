'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus } from './loading';

export function ArchiveArtworkButton({ artworkId, title }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function archive() {
    const confirmed = window.confirm(`Archive “${title}”? This sets status to archived; it does not hard-delete.`);
    if (!confirmed) {
      return;
    }
    setPending(true);
    setError('');
    try {
      const client = await createBrowserArtApi();
      await client.archiveArtwork(artworkId);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button className="text-link" type="button" {...pendingButtonProps(pending)} onClick={archive}>
        {pending ? 'Archiving…' : 'Archive'}
      </button>
      <ActionStatus pending={pending} pendingLabel="Archiving artwork" error={error} variant="inline" />
    </div>
  );
}
