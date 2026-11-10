export const metadata = { title: 'Our Philosophy' };

export default function AboutPage() {
  return (
    <div className="page-shell pt-12 md:pt-20 pb-24">
      <article className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-4">
          <p className="label-sm text-patina">Our philosophy</p>
          <h1 className="font-display text-4xl md:text-[40px] leading-tight text-ink">
            Art is the hero. The canvas is its monument.
          </h1>
          <p className="text-[15px] leading-6 text-on-surface-variant">
            Maison d&apos;Art is a single-owner salon for original handmade works. We do not operate a multi-seller marketplace or auctions.
          </p>
        </header>
        <p className="text-[15px] leading-7 text-on-surface-variant">
          We remove the artificial aura of transient celebrity to refocus contemplation on the visceral weight of raw impasto, hand-ground earth ochres, and the patient gravity of solitary human craft.
        </p>
        <p className="text-[15px] leading-7 text-on-surface-variant">
          Certificates and provenance documents remain atelier-controlled; the storefront does not mint public links to private files.
        </p>
        <section id="ar-preview" className="notice">
          Artwork pages include View in your space. Live placement uses WebXR on browsers that actually support immersive AR. iOS Safari and unsupported desktops use a labelled photo preview. Camera frames are not uploaded.
        </section>
      </article>
    </div>
  );
}
