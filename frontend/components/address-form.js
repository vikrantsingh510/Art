'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

function fieldsFromAddress(address) {
  return {
    recipientName: address?.recipientName || '',
    phone: address?.phone || '',
    addressLine1: address?.addressLine1 || '',
    addressLine2: address?.addressLine2 || '',
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postalCode || '',
    country: address?.country || 'IN',
    isDefault: Boolean(address?.isDefault),
  };
}

export function AddressForm({ address, onCancel }) {
  const router = useRouter();
  const isEdit = Boolean(address?.id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [values, setValues] = useState(fieldsFromAddress(address));

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    setSuccess('');
    const body = {
      recipientName: values.recipientName.trim(),
      phone: values.phone.trim(),
      addressLine1: values.addressLine1.trim(),
      addressLine2: values.addressLine2.trim() || null,
      city: values.city.trim(),
      state: values.state.trim(),
      postalCode: values.postalCode.trim(),
      country: values.country.trim() || 'IN',
      isDefault: values.isDefault,
    };

    if (!body.recipientName || !body.phone || !body.addressLine1 || !body.city || !body.state || !body.postalCode) {
      setError('Complete the required address fields.');
      setPending(false);
      return;
    }

    try {
      const client = await createBrowserArtApi();
      if (isEdit) {
        await client.updateAddress(address.id, body);
        setSuccess('Address updated.');
      } else {
        await client.createAddress(body);
        setValues(fieldsFromAddress(null));
        setSuccess('Address saved.');
      }
      router.refresh();
      if (isEdit && onCancel) {
        onCancel();
      }
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field label="Recipient">
        <input className="field-input" value={values.recipientName} onChange={(event) => setField('recipientName', event.target.value)} required maxLength={150} />
      </Field>
      <Field label="Phone">
        <input className="field-input" value={values.phone} onChange={(event) => setField('phone', event.target.value)} required minLength={5} maxLength={20} />
      </Field>
      <Field label="Address line 1">
        <input className="field-input" value={values.addressLine1} onChange={(event) => setField('addressLine1', event.target.value)} required maxLength={500} />
      </Field>
      <Field label="Address line 2">
        <input className="field-input" value={values.addressLine2} onChange={(event) => setField('addressLine2', event.target.value)} maxLength={500} />
      </Field>
      <div className="grid md:grid-cols-2 gap-5">
        <Field label="City">
          <input className="field-input" value={values.city} onChange={(event) => setField('city', event.target.value)} required maxLength={100} />
        </Field>
        <Field label="State">
          <input className="field-input" value={values.state} onChange={(event) => setField('state', event.target.value)} required maxLength={100} />
        </Field>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Postal code">
          <input className="field-input" value={values.postalCode} onChange={(event) => setField('postalCode', event.target.value)} required maxLength={15} />
        </Field>
        <Field label="Country">
          <input className="field-input" value={values.country} onChange={(event) => setField('country', event.target.value)} maxLength={100} />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-charcoal"
          checked={values.isDefault}
          onChange={(event) => setField('isDefault', event.target.checked)}
        />
        Set as default
      </label>
      <ActionStatus pending={pending} pendingLabel="Saving address" message={success} error={error} />
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" type="submit" {...pendingButtonProps(pending)}>
          {pending ? <ButtonLoader label="Saving…" /> : isEdit ? 'Save changes' : 'Save address'}
        </button>
        {isEdit ? (
          <button className="btn-secondary" type="button" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
