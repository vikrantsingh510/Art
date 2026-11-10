import { PageIntro } from '@/components/ui';

export const metadata = { title: 'Inquiry' };

export default function ContactPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Curatorial inquiry"
        title="Write to the atelier"
        description="There is no ticketing API in this release. Use email for private viewing requests and provenance questions."
      />
      <div className="page-shell pb-24">
      <div className="max-w-3xl space-y-6">
        <div className="notice">
          <p className="label-md text-patina">Salon correspondence</p>
          <p className="mt-2">
            <a className="text-link" href="mailto:atelier@maisondart.example">atelier@maisondart.example</a>
          </p>
          <p className="mt-4 text-sm text-on-surface-variant">
            New Delhi salon correspondence is handled by the principal curator. Submitting this page does not create an order, escrow, or shipment.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
