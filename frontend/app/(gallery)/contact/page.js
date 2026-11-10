export const metadata = { title: 'Inquiry' };

export default function ContactPage() {
  return (
    <div className="page-shell pt-12 md:pt-20 pb-24">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-4">
          <p className="label-sm text-patina">Curatorial inquiry</p>
          <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">Write to the atelier</h1>
          <p className="text-[15px] leading-6 text-on-surface-variant">
            There is no ticketing API in this release. Use email for private viewing requests and provenance questions.
          </p>
        </header>
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
  );
}
