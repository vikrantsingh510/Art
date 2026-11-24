'use client';

import { useState } from 'react';
import { createBrowserArtApi } from '@/lib/browser-api';
import { ApiClientError } from '@/lib/api-client';
import {
  HOMEPAGE_FAQ_ANSWER_MAX_LENGTH,
  HOMEPAGE_FAQ_HEADING_MAX_LENGTH,
  HOMEPAGE_FAQ_LIMIT_MAX,
  HOMEPAGE_FAQ_LIMIT_MIN,
  HOMEPAGE_FAQ_MAX_ITEMS,
  HOMEPAGE_FAQ_QUESTION_MAX_LENGTH,
  HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH,
  addHomepageFaqItem,
  clampHomepageFaqLimit,
  fieldsFromFaqSettings,
  homepageFaqPutBody,
  moveHomepageFaqItem,
  removeHomepageFaqItem,
  shouldConfirmHomepageFaqDelete,
  updateHomepageFaqItem,
} from '@/lib/homepage-faq';
import { pendingButtonProps } from '@/lib/pending-action';
import { ActionStatus, ButtonLoader } from './loading';
import { Field } from './ui';

export function HomepageFaqForm({ settings = null }) {
  const [fields, setFields] = useState(() => fieldsFromFaqSettings(settings));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const atItemLimit = fields.items.length >= HOMEPAGE_FAQ_MAX_ITEMS;

  function updateField(name, value) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function updateItem(index, patch) {
    setFields((current) => ({
      ...current,
      items: updateHomepageFaqItem(current.items, index, patch),
    }));
  }

  function handleAdd() {
    if (pending || atItemLimit) {
      return;
    }
    setFields((current) => ({
      ...current,
      items: addHomepageFaqItem(current.items, `${Date.now()}-${current.items.length}`),
    }));
    setMessage('');
  }

  function handleMove(index, offset) {
    if (pending) {
      return;
    }
    setFields((current) => ({
      ...current,
      items: moveHomepageFaqItem(current.items, index, offset),
    }));
  }

  function handleDelete(index) {
    if (pending) {
      return;
    }
    const item = fields.items[index];
    if (shouldConfirmHomepageFaqDelete(item)) {
      const confirmed = window.confirm('Delete this FAQ item? This change is saved only after you click Save changes.');
      if (!confirmed) {
        return;
      }
    }
    setFields((current) => ({
      ...current,
      items: removeHomepageFaqItem(current.items, index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    const body = homepageFaqPutBody(fields);
    try {
      const client = await createBrowserArtApi();
      const saved = await client.updateAdminHomepageFaqSettings(body);
      setFields(fieldsFromFaqSettings(saved));
      setMessage(saved?.enabled
        ? 'Homepage FAQ settings saved. Only enabled items appear on the salon, up to the display limit.'
        : 'Homepage FAQ section is hidden on the salon.');
    } catch (saveError) {
      setError(
        saveError instanceof ApiClientError
          ? saveError.message
          : 'FAQ settings could not be saved.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-8 max-w-3xl" onSubmit={handleSubmit}>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-3.5 w-3.5 accent-charcoal"
          checked={fields.enabled}
          disabled={pending}
          onChange={(event) => updateField('enabled', event.target.checked)}
        />
        <span>
          <span className="label-md text-patina block">Enable FAQ section</span>
          <span className="block text-sm text-on-surface-variant mt-1">
            When enabled, the homepage shows active questions in stored order, up to the display limit.
          </span>
        </span>
      </label>

      <Field
        label="Heading"
        hint={`Optional. At most ${HOMEPAGE_FAQ_HEADING_MAX_LENGTH} characters. Do not use HTML.`}
      >
        <input
          className="field-input"
          name="heading"
          maxLength={HOMEPAGE_FAQ_HEADING_MAX_LENGTH}
          placeholder="From the atelier"
          value={fields.heading}
          disabled={pending}
          onChange={(event) => updateField('heading', event.target.value)}
        />
        <span className="block text-xs text-patina">{fields.heading.length}/{HOMEPAGE_FAQ_HEADING_MAX_LENGTH}</span>
      </Field>

      <Field
        label="Subtitle"
        hint={`Optional supporting copy. At most ${HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH} characters.`}
      >
        <textarea
          className="field-input min-h-24"
          name="subtitle"
          maxLength={HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH}
          placeholder="Acquisition notes for collectors."
          value={fields.subtitle}
          disabled={pending}
          onChange={(event) => updateField('subtitle', event.target.value)}
        />
        <span className="block text-xs text-patina">{fields.subtitle.length}/{HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH}</span>
      </Field>

      <fieldset className="space-y-4">
        <legend className="label-md text-patina">Homepage display limit</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-3.5 w-3.5 accent-charcoal"
            checked={fields.showAll}
            disabled={pending}
            onChange={(event) => updateField('showAll', event.target.checked)}
          />
          <span>
            <span className="label-md text-patina block">Show all active FAQs</span>
            <span className="block text-sm text-on-surface-variant mt-1">
              When this is off, the salon shows the first selected number of active items in the current order.
            </span>
          </span>
        </label>
        {fields.showAll ? null : (
          <Field label="Number of active FAQs" hint={`Integer from ${HOMEPAGE_FAQ_LIMIT_MIN} to ${HOMEPAGE_FAQ_LIMIT_MAX}.`}>
            <input
              className="field-input max-w-32"
              name="homepageLimit"
              type="number"
              min={HOMEPAGE_FAQ_LIMIT_MIN}
              max={HOMEPAGE_FAQ_LIMIT_MAX}
              value={fields.homepageLimit}
              disabled={pending}
              onChange={(event) => updateField('homepageLimit', clampHomepageFaqLimit(event.target.value))}
            />
          </Field>
        )}
      </fieldset>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-md text-patina">FAQ items</p>
            <p className="text-sm text-on-surface-variant mt-1">
              {fields.items.length}/{HOMEPAGE_FAQ_MAX_ITEMS} items. Display order is top to bottom.
            </p>
          </div>
          <button
            className="btn-secondary"
            type="button"
            onClick={handleAdd}
            {...pendingButtonProps(pending || atItemLimit)}
          >
            Add FAQ
          </button>
        </div>

        {fields.items.length === 0 ? (
          <p className="text-sm text-on-surface-variant border-t border-fillet pt-4">
            No FAQ items yet. Add a question to appear on the homepage after you save.
          </p>
        ) : (
          <ol className="space-y-6">
            {fields.items.map((item, index) => (
              <li key={item.localKey} className="border-t border-fillet pt-6 space-y-4">
                <p className="label-sm text-patina">Item {index + 1}</p>
                <Field
                  label="Question"
                  hint={`At most ${HOMEPAGE_FAQ_QUESTION_MAX_LENGTH} characters. Do not use HTML.`}
                >
                  <input
                    className="field-input"
                    maxLength={HOMEPAGE_FAQ_QUESTION_MAX_LENGTH}
                    value={item.question}
                    disabled={pending}
                    onChange={(event) => updateItem(index, { question: event.target.value })}
                  />
                  <span className="block text-xs text-patina">{item.question.length}/{HOMEPAGE_FAQ_QUESTION_MAX_LENGTH}</span>
                </Field>
                <Field
                  label="Answer"
                  hint={`Plain text. At most ${HOMEPAGE_FAQ_ANSWER_MAX_LENGTH} characters.`}
                >
                  <textarea
                    className="field-input min-h-32"
                    maxLength={HOMEPAGE_FAQ_ANSWER_MAX_LENGTH}
                    value={item.answer}
                    disabled={pending}
                    onChange={(event) => updateItem(index, { answer: event.target.value })}
                  />
                  <span className="block text-xs text-patina">{item.answer.length}/{HOMEPAGE_FAQ_ANSWER_MAX_LENGTH}</span>
                </Field>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 accent-charcoal"
                    checked={item.enabled}
                    disabled={pending}
                    onChange={(event) => updateItem(index, { enabled: event.target.checked })}
                  />
                  <span>
                    <span className="label-md text-patina block">Enabled</span>
                    <span className="block text-sm text-on-surface-variant mt-1">
                      Disabled items stay in this list and do not appear on the homepage.
                    </span>
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    {...pendingButtonProps(pending || index === 0)}
                  >
                    Move up
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    {...pendingButtonProps(pending || index === fields.items.length - 1)}
                  >
                    Move down
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => handleDelete(index)}
                    {...pendingButtonProps(pending)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ActionStatus pending={pending} pendingLabel="Saving FAQ settings" message={message} error={error} />

      <button className="btn-primary" type="submit" {...pendingButtonProps(pending)}>
        {pending ? <ButtonLoader label="Saving" /> : 'Save changes'}
      </button>
    </form>
  );
}
