'use client';

import { useEffect, useState } from 'react';
import { createBrowserArtApi } from '@/lib/browser-api';
import { artworkImageUrl, publicStorageUrl } from '@/lib/media';
import { Field } from './ui';

export function CollectionArtworkPicker({ selected, onChange }) {
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
          q: query,
          limit: 12,
        });
        setResults(Array.isArray(data?.items) ? data.items : []);
      } catch (caught) {
        setResults([]);
        setError(caught.message || 'Artworks could not be searched.');
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
      status: artwork.status,
      storagePath: artwork.images?.[0]?.storagePath || null,
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
      <Field
        label="Hanging"
        hint="Search the catalogue, then use Up and Down to set display order. Public pages show published works only, in this order."
        error={error}
      >
        <input
          className="field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search artworks by title or artist"
        />
      </Field>
      <p className="label-sm text-patina">{searching ? 'Searching' : 'Catalogue'}</p>
      <ul className="space-y-2">
        {results.map((artwork) => (
          <li key={artwork.id} className="flex items-center justify-between gap-4 border-b border-fillet py-2">
            <div className="flex items-center gap-4 min-w-0">
              {artworkImageUrl(artwork) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artworkImageUrl(artwork)} alt="" className="h-12 w-10 object-cover bg-surface-container-low" />
              ) : (
                <div className="h-12 w-10 bg-surface-container-low" />
              )}
              <div className="min-w-0">
                <p className="truncate">{artwork.title}</p>
                <p className="text-sm text-on-surface-variant truncate">
                  {artwork.artistName} · {artwork.status} · {artwork.id}
                </p>
              </div>
            </div>
            <button className="text-link shrink-0" type="button" onClick={() => addArtwork(artwork)} disabled={selectedIds.has(artwork.id)}>
              {selectedIds.has(artwork.id) ? 'Added' : 'Add'}
            </button>
          </li>
        ))}
      </ul>
      {selected.length > 0 ? (
        <ol className="space-y-2">
          {selected.map((artwork, index) => {
            const thumbUrl = publicStorageUrl(artwork.storagePath);
            return (
            <li key={artwork.id} className="flex items-center justify-between gap-4 border-b border-fillet py-2">
              <div className="flex items-center gap-4 min-w-0">
                {thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl} alt="" className="h-12 w-10 object-cover bg-surface-container-low" />
                ) : (
                  <div className="h-12 w-10 bg-surface-container-low" />
                )}
                <div className="min-w-0">
                  <p className="label-sm text-patina">Order {index + 1}</p>
                  <p className="truncate">{artwork.title}</p>
                  <p className="text-sm text-on-surface-variant truncate">
                    {artwork.artistName || '—'} · {artwork.status || '—'} · {artwork.id}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button className="text-link" type="button" onClick={() => move(artwork.id, -1)}>Up</button>
                <button className="text-link" type="button" onClick={() => move(artwork.id, 1)}>Down</button>
                <button className="text-link" type="button" onClick={() => removeArtwork(artwork.id)}>Remove</button>
              </div>
            </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-on-surface-variant">No artworks in this hanging yet.</p>
      )}
    </div>
  );
}
