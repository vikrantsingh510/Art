'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

export function CheckoutForm({ addresses }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const hasAddresses = addresses.length > 0;

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const notes = String(form.get('notes') || '').trim() || null;
    const addressId = String(form.get('addressId') || '');
    let body;

    if (addressId) {
      body = { addressId, notes };
    } else {
      body = {
        notes,
        shippingAddress: {
          recipientName: String(form.get('recipientName') || '').trim(),
          phone: String(form.get('phone') || '').trim(),
          addressLine1: String(form.get('addressLine1') || '').trim(),
          addressLine2: String(form.get('addressLine2') || '').trim() || null,
          city: String(form.get('city') || '').trim(),
          state: String(form.get('state') || '').trim(),
          postalCode: String(form.get('postalCode') || '').trim(),
          country: String(form.get('country') || 'IN').trim(),
        },
      };
      const required = body.shippingAddress;
      if (!required.recipientName || !required.phone || !required.addressLine1 || !required.city || !required.state || !required.postalCode) {
        setError('Provide a saved address or a complete shipping address.');
        setPending(false);
        return;
      }
    }

    try {
      const client = await createBrowserArtApi();
      const order = await client.checkout(body);
      router.push(`/account/orders/${order.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
      setPending(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {hasAddresses ? (
        <Field label="Saved address" hint="Manage addresses in your dossier. Checkout uses this selection or a new address.">
          <select className="field-input" name="addressId" defaultValue={addresses.find((item) => item.isDefault)?.id || addresses[0].id}>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.recipientName} · {address.city}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">No saved address. Enter a shipping address for this reservation.</p>
          <Field label="Recipient"><input className="field-input" name="recipientName" required /></Field>
          <Field label="Phone"><input className="field-input" name="phone" required /></Field>
          <Field label="Address line 1"><input className="field-input" name="addressLine1" required /></Field>
          <Field label="City"><input className="field-input" name="city" required /></Field>
          <Field label="State"><input className="field-input" name="state" required /></Field>
          <Field label="Postal code"><input className="field-input" name="postalCode" required /></Field>
          <input type="hidden" name="country" value="IN" />
        </div>
      )}
      <Field label="Notes">
        <textarea className="field-input" name="notes" rows={3} maxLength={2000} />
      </Field>
      <ActionStatus pending={pending} pendingLabel="Placing reservation" error={error} />
      <button className="btn-primary" type="submit" {...pendingButtonProps(pending)}>
        {pending ? <ButtonLoader label="Reserving…" /> : 'Place reservation request'}
      </button>
    </form>
  );
}
