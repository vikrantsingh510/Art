'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

export function ProfileForm({ user }) {
  const router = useRouter();
  const profile = user?.profile || {};
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fullName, setFullName] = useState(user?.fullName || profile.fullName || '');
  const [phone, setPhone] = useState(profile.phone || '');

  function reset() {
    setFullName(user?.fullName || profile.fullName || '');
    setPhone(profile.phone || '');
    setEditing(false);
    setError('');
  }

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const client = await createBrowserArtApi();
      await client.updateMe({
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      setEditing(false);
      setSuccess('Profile saved.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : caught.message);
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-6">
        <dl className="space-y-4">
          <div className="border-b border-fillet pb-3">
            <dt className="label-md text-patina">Name</dt>
            <dd className="mt-1">{user?.fullName || profile.fullName || '—'}</dd>
          </div>
          <div className="border-b border-fillet pb-3">
            <dt className="label-md text-patina">Email</dt>
            <dd className="mt-1">{user?.email || '—'}</dd>
          </div>
          <div className="border-b border-fillet pb-3">
            <dt className="label-md text-patina">Phone</dt>
            <dd className="mt-1">{profile.phone || '—'}</dd>
          </div>
          <div className="border-b border-fillet pb-3">
            <dt className="label-md text-patina">Roles</dt>
            <dd className="mt-1">{(user?.roles || []).join(', ') || '—'}</dd>
          </div>
        </dl>
        <ActionStatus message={success} />
        <button className="btn-primary" type="button" onClick={() => { setEditing(true); setSuccess(''); }}>
          Edit profile
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field label="Name">
        <input className="field-input" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={150} />
      </Field>
      <Field label="Phone" hint="Email is managed by Google sign-in and cannot be changed here.">
        <input className="field-input" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} />
      </Field>
      <ActionStatus pending={pending} pendingLabel="Saving profile" error={error} />
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" type="submit" {...pendingButtonProps(pending)}>
          {pending ? <ButtonLoader label="Saving…" /> : 'Save'}
        </button>
        <button className="btn-secondary" type="button" disabled={pending} onClick={reset}>
          Cancel
        </button>
      </div>
    </form>
  );
}
