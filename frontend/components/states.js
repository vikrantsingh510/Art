import { PageLoader } from './loading';
import { Button } from './ui';

export function LoadingState({ label = 'Loading the salon archive…' }) {
  return <PageLoader label={label} />;
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="border border-fillet bg-stone px-6 py-12 text-center">
      <h2 className="font-display text-2xl italic text-ink">{title}</h2>
      {description ? <p className="mt-3 text-sm text-on-surface-variant">{description}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'The salon archive could not be reached', error, retryHref }) {
  return (
    <div className="border border-fillet bg-stone px-6 py-12">
      <h2 className="font-display text-2xl italic text-ink">{title}</h2>
      <p className="mt-3 text-sm text-on-surface-variant">
        {error?.message || 'Please retry in a moment. No placeholder inventory is shown.'}
      </p>
      {retryHref ? (
        <div className="mt-6">
          <Button href={retryHref} variant="secondary">Retry</Button>
        </div>
      ) : null}
    </div>
  );
}
