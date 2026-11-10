import { PageIntro } from '@/components/ui';

export const metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <div>
      <PageIntro title="Privacy" description="A concise notice for this storefront. It is not a substitute for counsel." />
      <div className="max-w-3xl mx-auto px-6 md:px-16 pb-24 space-y-4 text-sm leading-6 text-on-surface-variant">
        <p>Authentication is provided by Supabase Auth (Google). The Express API stores a profile record keyed to that identity.</p>
        <p>Artwork images that the atelier marks public may be requested from the public storage bucket. Private certificates are not given signed URLs in this release.</p>
        <p>Payment processors are not connected. Do not send card numbers through this site.</p>
      </div>
    </div>
  );
}
