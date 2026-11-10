'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from './ui';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function OrderLookupForm() {
  const router = useRouter();
  const [error, setError] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get('orderId') || '').trim();
    if (!UUID.test(id)) {
      setError('Enter a valid order UUID from a real reservation.');
      return;
    }
    router.push(`/admin/orders/${id}`);
  }

  return (
    <form className="space-y-4 max-w-xl" onSubmit={onSubmit}>
      <Field label="Open order by UUID" hint="Only works for orders that already exist.">
        <input className="field-input" name="orderId" placeholder="00000000-0000-4000-8000-000000000000" />
      </Field>
      {error ? <p className="notice notice-error">{error}</p> : null}
      <button className="btn-secondary" type="submit">Open docket</button>
    </form>
  );
}
