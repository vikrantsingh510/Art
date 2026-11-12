import { Button } from '@/components/ui';

export default function ArtistNotFound() {
  return (
    <div className="page-shell py-24 text-center">
      <p className="label-md text-patina">404</p>
      <h1 className="font-display text-4xl mt-4">This artist is not on view</h1>
      <p className="mt-4 text-on-surface-variant">
        The profile is unpublished, was renamed, or no longer exists.
      </p>
      <div className="mt-8 flex justify-center">
        <Button href="/artists" variant="secondary">Return to Artists</Button>
      </div>
    </div>
  );
}
