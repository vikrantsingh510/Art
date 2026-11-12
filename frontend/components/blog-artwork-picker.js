'use client';

import { useEffect, useState } from 'react';
import { createBrowserArtApi } from '@/lib/browser-api';
import { Field } from './ui';

export function BlogArtworkPicker({ selected, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const selectedIds = new Set(selected.map((item) => item.id));

  useEffect(() => {
    const handle = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const client = await createBrowserArtApi();
        const data = await client.adminArtworks({
          status: 'published',
          q: query,
          limit: 12,
        });
        setResults(Array.isArray(data?.items) ? data.items : []);
      } catch (caught) {
        setResults([]);
        setError(caught.message || 'Published artworks could not be searched.');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function addArtwork(artwork) {
    if (selectedIds.has(artwork.id)) {
      return;
    }
    onChange([...selected, {
      id: artwork.id,
      title: artwork.title,
      artistName: artwork.artistName,
    }]);
  }

  function removeArtwork(artworkId) {
    onChange(selected.filter((item) => item.id !== artworkId));
  }

  function move(artworkId, direction) {
    const index = selected.findIndex((item) => item.id === artworkId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= selected.length) {
      return;
    }
    const copy = [...selected];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy);
  }

  return (
    <div className="space-y-6">
      <Field label="Related artworks" hint="Only published works can be newly associated. Sold or archived works drop from the public Journal page automatically." error={error}>
        <input
          className="field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search published artworks"
        />
      </Field>
      <p className="label-sm text-patina">{searching ? 'Searching' : 'Published catalogue'}</p>
      <ul className="space-y-2">
        {results.map((artwork) => (
          <li key={artwork.id} className="flex items-center justify-between gap-4 border-b border-fillet py-2">
            <div>
              <p>{artwork.title}</p>
              <p className="text-sm text-on-surface-variant">{artwork.artistName}</p>
            </div>
            <button className="text-link" type="button" onClick={() => addArtwork(artwork)} disabled={selectedIds.has(artwork.id)}>
              {selectedIds.has(artwork.id) ? 'Added' : 'Add'}
            </button>
          </li>
        ))}
      </ul>
      {selected.length > 0 ? (
        <ol className="space-y-2">
          {selected.map((artwork, index) => (
            <li key={artwork.id} className="flex items-center justify-between gap-4 border-b border-fillet py-2">
              <div>
                <p className="label-sm text-patina">Order {index + 1}</p>
                <p>{artwork.title}</p>
              </div>
              <div className="flex gap-3">
                <button className="text-link" type="button" onClick={() => move(artwork.id, -1)}>Up</button>
                <button className="text-link" type="button" onClick={() => move(artwork.id, 1)}>Down</button>
                <button className="text-link" type="button" onClick={() => removeArtwork(artwork.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-on-surface-variant">No related artworks selected.</p>
      )}
    </div>
  );
}
