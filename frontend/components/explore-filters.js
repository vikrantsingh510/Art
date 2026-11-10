'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { pendingButtonProps } from '@/lib/pending-action';
import { exploreHref, parseExploreQuery, PRICE_BANDS } from '@/lib/explore-query';
import { ButtonLoader } from './loading';

export function ExploreFilters({ categories }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = parseExploreQuery(Object.fromEntries(searchParams.entries()));
  const currentHref = exploreHref(current, current.page);
  const [requestedHref, setRequestedHref] = useState(null);
  const pending = Boolean(requestedHref && requestedHref !== currentHref);

  function update(next) {
    const merged = { ...current, ...next, page: next.page || 1 };
    const href = exploreHref(merged, merged.page);
    if (href === currentHref) {
      return;
    }
    setRequestedHref(href);
    router.push(href);
  }

  return (
    <form
      key={currentHref}
      className="grid grid-cols-1 md:grid-cols-12 gap-6 border border-fillet bg-stone p-6"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) {
          return;
        }
        const form = new FormData(event.currentTarget);
        update({
          q: form.get('q') || '',
          categoryId: form.get('categoryId') || '',
          minPricePaise: form.get('minPricePaise') || '',
          maxPricePaise: form.get('maxPricePaise') || '',
          page: 1,
        });
      }}
    >
      <label className="md:col-span-4">
        <span className="label-md text-patina">Search</span>
        <input className="field-input" name="q" defaultValue={current.q || ''} placeholder="Title, artist, monograph" />
      </label>
      <label className="md:col-span-3">
        <span className="label-md text-patina">Category</span>
        <select className="field-input" name="categoryId" defaultValue={current.categoryId || ''} disabled={pending}>
          <option value="">All published series</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label className="md:col-span-3">
        <span className="label-md text-patina">Acquisition value</span>
        <select
          className="field-input"
          defaultValue={`${current.minPricePaise || ''}:${current.maxPricePaise || ''}`}
          disabled={pending}
          onChange={(event) => {
            const [minPricePaise, maxPricePaise] = event.target.value.split(':');
            const form = event.currentTarget.form;
            form.minPricePaise.value = minPricePaise || '';
            form.maxPricePaise.value = maxPricePaise || '';
          }}
        >
          <option value=":">All valuations</option>
          {PRICE_BANDS.map((band) => (
            <option key={band.label} value={`${band.minPricePaise || ''}:${band.maxPricePaise || ''}`}>
              {band.label}
            </option>
          ))}
        </select>
        <input type="hidden" name="minPricePaise" defaultValue={current.minPricePaise || ''} />
        <input type="hidden" name="maxPricePaise" defaultValue={current.maxPricePaise || ''} />
      </label>
      <div className="md:col-span-2 flex items-end">
        <button className="btn-primary w-full" type="submit" {...pendingButtonProps(pending)}>
          {pending ? <ButtonLoader label="Applying…" /> : 'Apply'}
        </button>
      </div>
      <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-3">
        {['Medium', 'Scale', 'Movement'].map((label) => (
          <div key={label} className="border border-fillet px-4 py-3 opacity-60">
            <p className="label-md text-patina">{label}</p>
            <p className="text-xs text-on-surface-variant mt-1">Unavailable — the catalog API does not filter by {label.toLowerCase()}.</p>
          </div>
        ))}
      </div>
    </form>
  );
}

export function ExploreFiltersFallback() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 border border-fillet bg-stone p-6" aria-hidden="true">
      <div className="md:col-span-12">
        <p className="label-md text-patina">Search, category and valuation</p>
      </div>
    </div>
  );
}
