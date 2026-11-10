'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus } from './loading';
import { AddressForm } from './address-form';

export function AddressBook({ addresses }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');

  async function remove(address) {
    if (!window.confirm(`Delete the address for ${address.recipientName}? Past orders keep their original snapshot.`)) {
      return;
    }
    setPendingId(address.id);
    setError('');
    try {
      const client = await createBrowserArtApi();
      await client.deleteAddress(address.id);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPendingId(null);
    }
  }

  if (!addresses.length) {
    return <p className="text-sm text-on-surface-variant">No addresses saved yet.</p>;
  }

  return (
    <div className="space-y-4">
      <ActionStatus pending={Boolean(pendingId)} pendingLabel="Deleting address" error={error} />
      {addresses.map((address) => (
        <article key={address.id} className="border border-fillet p-5 space-y-4">
          {editingId === address.id ? (
            <AddressForm address={address} onCancel={() => setEditingId(null)} />
          ) : (
            <>
              <p className="font-medium">{address.recipientName}</p>
              <p className="text-sm text-on-surface-variant">
                {address.addressLine1}
                {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country} · {address.phone}
              </p>
              {address.isDefault ? <p className="label-sm text-bronze">Default</p> : null}
              <div className="flex flex-wrap gap-4">
                <button className="text-link" type="button" onClick={() => setEditingId(address.id)}>
                  Edit
                </button>
                <button
                  className="text-link"
                  type="button"
                  {...pendingButtonProps(pendingId === address.id)}
                  onClick={() => remove(address)}
                >
                  {pendingId === address.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
