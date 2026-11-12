import { JournalCard } from '@/components/journal-card';
import { EmptyState, ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { journalCanonical } from '@/lib/journal-origin';

export async function generateMetadata() {
  const canonical = await journalCanonical('/journal');
  return {
    title: 'Journal',
    description: 'Atelier notes, hanging essays, and the stories behind Maison d’Art originals.',
    alternates: { canonical },
    openGraph: {
      title: 'Journal',
      description: 'Atelier notes, hanging essays, and the stories behind Maison d’Art originals.',
      url: canonical,
      type: 'website',
    },
  };
}

export default async function JournalPage() {
  let data = { items: [] };
  let error = null;
  try {
    data = await api.listBlogs({ limit: 24 });
  } catch (caught) {
    error = caught instanceof ApiClientError ? caught : new ApiClientError(caught.message);
  }

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div>
      <header className="page-shell pt-12 md:pt-20 pb-10 space-y-4">
        <p className="label-sm text-patina">Atelier notes</p>
        <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">Journal</h1>
        <p className="max-w-xl text-[15px] leading-6 text-on-surface-variant">
          Essays and studio notes published alongside the collection. Related works appear only while they remain on view.
        </p>
      </header>
      <div className="page-shell pb-20">
        {error ? <ErrorState error={error} retryHref="/journal" /> : null}
        {!error && items.length === 0 ? (
          <EmptyState title="No journal entries yet" description="When an essay is published, it will appear here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {items.map((blog) => (
              <JournalCard key={blog.id} blog={blog} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
