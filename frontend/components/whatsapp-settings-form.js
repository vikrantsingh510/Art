'use client';

import { useState } from 'react';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

function fieldsFromSettings(settings) {
  return {
    enabled: Boolean(settings?.enabled),
    e164: settings?.e164 || '',
    buttonLabel: settings?.buttonLabel || '',
  };
}

export function WhatsappSettingsForm({ settings = null }) {
  const [fields, setFields] = useState(() => fieldsFromSettings(settings));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function updateField(name, value) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');

    try {
      const client = await createBrowserArtApi();
      const saved = await client.updateAdminWhatsappSettings({
        enabled: Boolean(fields.enabled),
        e164: fields.e164.trim() || null,
        buttonLabel: fields.buttonLabel.trim() || null,
      });
      setFields(fieldsFromSettings(saved));
      setMessage(saved.enabled
        ? 'WhatsApp enquiries are enabled on artwork pages.'
        : 'WhatsApp enquiries are hidden on artwork pages.');
    } catch (saveError) {
      setError(
        saveError instanceof ApiClientError
          ? saveError.message
          : 'Settings could not be saved.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-8 max-w-xl" onSubmit={handleSubmit}>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-3.5 w-3.5 accent-charcoal"
          checked={fields.enabled}
          onChange={(event) => updateField('enabled', event.target.checked)}
        />
        <span>
          <span className="label-md text-patina block">Enable WhatsApp enquiries</span>
          <span className="block text-sm text-on-surface-variant mt-1">
            When enabled, artwork pages show a Click-to-Chat button. The number is never shown when this is off.
          </span>
        </span>
      </label>

      <Field
        label="WhatsApp number"
        hint="E.164 format with country code, for example +9198XXXXXXXX. Do not use a personal profile phone unless that is the salon inbox."
      >
        <input
          className="field-input"
          name="e164"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+9198XXXXXXXX"
          value={fields.e164}
          onChange={(event) => updateField('e164', event.target.value)}
        />
      </Field>

      <Field
        label="Button label"
        hint="Optional. Empty uses Enquire on WhatsApp. At most 40 characters."
      >
        <input
          className="field-input"
          name="buttonLabel"
          maxLength={40}
          placeholder="Enquire on WhatsApp"
          value={fields.buttonLabel}
          onChange={(event) => updateField('buttonLabel', event.target.value)}
        />
      </Field>

      <ActionStatus pending={pending} pendingLabel="Saving settings" message={message} error={error} />

      <button className="btn-primary" type="submit" {...pendingButtonProps(pending)}>
        {pending ? <ButtonLoader label="Saving" /> : 'Save settings'}
      </button>
    </form>
  );
}
