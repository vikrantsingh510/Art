import Link from 'next/link';

export function Pagination({ page, limit, total, makeHref }) {
  const pageCount = Math.max(1, Math.ceil(Number(total || 0) / Number(limit || 20)));
  const current = Number(page || 1);
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center gap-4 pt-12" aria-label="Pagination">
      {current > 1 ? (
        <Link href={makeHref(current - 1)} className="text-link">Previous</Link>
      ) : (
        <span className="text-patina label-md">Previous</span>
      )}
      <p className="text-sm text-on-surface-variant">
        Page {current} of {pageCount}
      </p>
      {current < pageCount ? (
        <Link href={makeHref(current + 1)} className="text-link">Next</Link>
      ) : (
        <span className="text-patina label-md">Next</span>
      )}
    </nav>
  );
}
