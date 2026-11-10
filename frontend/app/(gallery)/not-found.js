import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-6 md:px-16 py-24 text-center">
      <p className="label-md text-patina">404</p>
      <h1 className="font-display text-4xl mt-4">This gallery wall is empty</h1>
      <p className="mt-4 text-on-surface-variant">The page or artwork could not be found.</p>
      <div className="mt-8 flex justify-center">
        <Button href="/explore">Return to the collection</Button>
      </div>
    </div>
  );
}
