import { PageIntro } from '@/components/ui';

export const metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <PageIntro title="Terms" description="Acquisition on this storefront is a reservation request, not a completed sale.">
      <div className="max-w-xl space-y-4 text-sm leading-6 text-on-surface-variant">
        <p>Checkout creates a pending_payment order and a short inventory reservation. Payment capture is not enabled.</p>
        <p>Each original is unique. The collector bag holds one of each work and is the same list as the wishlist.</p>
        <p>Admin access is granted only by a database role, never by a browser flag.</p>
      </div>
    </PageIntro>
  );
}
