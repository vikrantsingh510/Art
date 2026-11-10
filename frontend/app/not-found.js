import { Button } from '@/components/ui';

export default function RootNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <p className="label-md text-patina">404</p>
        <h1 className="font-display text-4xl mt-4">Page not found</h1>
        <p className="mt-4 text-on-surface-variant">The requested salon path does not exist.</p>
        <div className="mt-8 flex justify-center">
          <Button href="/">Return to the exhibition</Button>
        </div>
      </div>
    </div>
  );
}
