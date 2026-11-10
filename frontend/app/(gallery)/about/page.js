import { PageIntro } from '@/components/ui';

export const metadata = { title: 'Our Philosophy' };

export default function AboutPage() {
  return (
    <div>
      <PageIntro
        eyebrow="Our philosophy"
        title="Art is the hero. The canvas is its monument."
        description="Maison d'Art is a single-owner salon for original handmade works. We do not operate a multi-seller marketplace or auctions."
      />
      <div className="page-shell pb-24">
      <div className="max-w-3xl space-y-8 text-[15px] leading-7 text-on-surface-variant">
        <p>
          We remove the artificial aura of transient celebrity to refocus contemplation on the visceral weight of raw impasto, hand-ground earth ochres, and the patient gravity of solitary human craft.
        </p>
        <p>
          Certificates and provenance documents remain atelier-controlled; the storefront does not mint public links to private files.
        </p>
        <section id="ar-preview" className="notice">
          Artwork pages include View in your space. Live placement uses WebXR on browsers that actually support immersive AR. iOS Safari and unsupported desktops use a labelled photo preview. Camera frames are not uploaded.
        </section>
      </div>
      </div>
    </div>
  );
}
