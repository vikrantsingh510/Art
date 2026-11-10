import Link from 'next/link';
import { Notice } from '@/components/ui';
import { ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { formatInrFromPaise } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Dashboard' };

export default async function AdminDashboardPage() {
  const { token } = await requireAdmin();
  let metrics = {};
  let artworks = { items: [], total: 0 };
  let customers = { total: 0 };
  let loadError = null;
  try {
    [metrics, artworks, customers] = await Promise.all([
      api.adminMetrics({}, { token }),
      api.adminArtworks({ limit: 8 }, { token }),
      api.adminCustomers({ limit: 8 }, { token }),
    ]);
  } catch (error) {
    loadError = error;
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="label-sm text-patina">Salon registry</p>
        <h1 className="font-display text-4xl mt-2">Executive dashboard</h1>
        <p className="text-on-surface-variant mt-3">Real catalogue counts and captured-payment metrics. Live escrow charts are not shown because payments are deferred.</p>
      </div>
      <Notice>
        Gross acquisitions use captured payments only. Until Razorpay is enabled, captured revenue may be ₹0. Percentage deltas from the Stitch mock are not fabricated.
      </Notice>
      {loadError ? <ErrorState error={loadError} retryHref="/admin" /> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Metric label="Gross captured" value={formatInrFromPaise(metrics.capturedPaymentPaise)} hint="Captured payments in window" />
        <Metric label="Net revenue" value={formatInrFromPaise(metrics.netRevenuePaise)} hint="Captured minus succeeded refunds" />
        <Metric label="Orders placed" value={String(metrics.orderCount || 0)} hint={`${metrics.confirmedOrderCount || 0} confirmed`} />
        <Metric label="Published lots" value={String(artworks.total || 0)} hint="From artwork catalogue" />
      </div>
      <section>
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-display text-2xl">Recent catalogue</h2>
          <Link href="/admin/artworks" className="text-link">Open collection</Link>
        </div>
        <ul className="divide-y divide-fillet border-y border-fillet">
          {(artworks.items || []).map((artwork) => (
            <li key={artwork.id} className="py-4 flex justify-between gap-4">
              <Link href={`/admin/artworks/${artwork.id}/edit`}>{artwork.title}</Link>
              <span className="label-sm text-patina">{artwork.status}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-display text-2xl">Collectors</h2>
          <Link href="/admin/customers" className="text-link">Open register</Link>
        </div>
        <p className="text-sm text-on-surface-variant">{customers.total || 0} profiles in the current page window.</p>
      </section>
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <article className="border border-fillet p-5 bg-stone">
      <p className="label-md text-patina">{label}</p>
      <p className="font-display text-3xl mt-3">{value}</p>
      <p className="text-xs text-patina mt-2">{hint}</p>
    </article>
  );
}
