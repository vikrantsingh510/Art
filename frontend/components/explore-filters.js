'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { pendingButtonProps } from '@/lib/pending-action';
import {
  PRICE_BANDS,
  clearedExploreQuery,
  exploreFilterChips,
  exploreHasActiveFilters,
  exploreHref,
  parseExploreQuery,
} from '@/lib/explore-query';
import { ButtonLoader } from './loading';

export function ExploreFilters({ categories }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = parseExploreQuery(Object.fromEntries(searchParams.entries()));
  const currentHref = exploreHref(current, current.page);
  const [requestedHref, setRequestedHref] = useState(null);
  const pending = Boolean(requestedHref && requestedHref !== currentHref);
  const chips = exploreFilterChips(current, { categories });
  const filtersActive = exploreHasActiveFilters(current);

  function update(next) {
    const merged = { ...current, ...next, page: next.page || 1 };
    const href = exploreHref(merged, merged.page);
    if (href === currentHref) {
      return;
    }
    setRequestedHref(href);
    router.push(href);
  }

  function clearAll() {
    update(clearedExploreQuery(current));
  }

  return (
    <form
      key={currentHref}
      className="explore-filters space-y-6 border border-fillet bg-stone p-6"
      aria-label="Catalogue filters"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 lg:items-end">
        <label className="sm:col-span-2 lg:col-span-4">
          <span className="label-md text-patina">Search</span>
          <input
            className="field-input"
            name="q"
            defaultValue={current.q || ''}
            placeholder="Title, artist, monograph"
            autoComplete="off"
            disabled={pending}
          />
        </label>
        <label className="lg:col-span-3">
          <span className="label-md text-patina">Category</span>
          <select className="field-input" name="categoryId" defaultValue={current.categoryId || ''} disabled={pending}>
            <option value="">All published series</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="lg:col-span-3">
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
        <div className="sm:col-span-2 lg:col-span-2 flex items-end">
          <button className="btn-primary w-full" type="submit" {...pendingButtonProps(pending)}>
            {pending ? <ButtonLoader label="Applying…" /> : 'Apply filters'}
          </button>
        </div>
      </div>

      {filtersActive ? (
        <div className="flex flex-wrap items-center gap-4">
          {chips.length > 0 ? (
            <ul className="flex flex-wrap gap-3" aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.id}>
                  <button
                    type="button"
                    className="explore-filter-chip"
                    aria-label={`Remove ${chip.group} filter ${chip.label}`}
                    disabled={pending}
                    onClick={() => update({ ...chip.clear, page: 1 })}
                  >
                    <span className="label-md text-patina">{chip.group}</span>
                    <span className="text-sm text-ink">{chip.label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="text-link"
            type="button"
            onClick={clearAll}
            disabled={pending}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function ExploreFiltersFallback() {
  return (
    <div className="explore-filters grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 border border-fillet bg-stone p-6" aria-hidden="true">
      <div className="sm:col-span-2 lg:col-span-4">
        <p className="label-md text-patina">Search</p>
      </div>
      <div className="lg:col-span-3">
        <p className="label-md text-patina">Category</p>
      </div>
      <div className="lg:col-span-3">
        <p className="label-md text-patina">Acquisition value</p>
      </div>
      <div className="sm:col-span-2 lg:col-span-2">
        <p className="label-md text-patina">Apply filters</p>
      </div>
    </div>
  );
}
