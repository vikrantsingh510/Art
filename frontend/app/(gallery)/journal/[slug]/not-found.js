import { Button } from '@/components/ui';

export default function JournalEntryNotFound() {
  return (
    <div className="page-shell py-24 text-center">
      <p className="label-md text-patina">404</p>
      <h1 className="font-display text-4xl mt-4">This journal entry is not on view</h1>
      <p className="mt-4 text-on-surface-variant">
        The essay is unpublished, was renamed, or no longer exists. Previous slugs are not redirected.
      </p>
      <div className="mt-8 flex justify-center">
        <Button href="/journal" variant="secondary">Return to Journal</Button>
      </div>
    </div>
  );
}
