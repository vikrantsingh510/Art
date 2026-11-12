import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="w-full bg-surface-container-low mt-20">
      <div className="page-shell pt-20 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
          <div className="md:col-span-5 space-y-4">
            <p className="font-display tracking-[0.16em] uppercase text-primary">Maison d&apos;Art</p>
            <p className="text-[15px] leading-6 text-on-surface-variant max-w-md">
              A sanctum for authentic contemporary and classical fine artworks. We curate original masterpieces with rigorous institutional provenance, archival certificates, and atelier-direct acquisition.
            </p>
          </div>
          <div className="md:col-span-3 space-y-3">
            <p className="label-md text-patina">Salon</p>
            <Link href="/explore" className="block text-sm">Explore Art</Link>
            <Link href="/collections" className="block text-sm">Collections</Link>
            <Link href="/journal" className="block text-sm">Journal</Link>
            <Link href="/about" className="block text-sm">Our Philosophy</Link>
            <Link href="/contact" className="block text-sm">Inquiry</Link>
          </div>
          <div className="md:col-span-4 space-y-3">
            <p className="label-md text-patina">Collectors</p>
            <Link href="/account" className="block text-sm">Collector dossier</Link>
            <Link href="/privacy" className="block text-sm">Privacy</Link>
            <Link href="/terms" className="block text-sm">Terms</Link>
            <p className="text-sm text-patina">View on your wall is offered only for AR-ready works, at catalogued size. Room-photo preview remains illustrative.</p>
          </div>
        </div>
        <hr className="hairline mb-6" />
        <p className="label-sm text-patina">© {new Date().getFullYear()} Maison d&apos;Art. Atelier-direct originals. Payment capture is not enabled in this release.</p>
      </div>
    </footer>
  );
}
