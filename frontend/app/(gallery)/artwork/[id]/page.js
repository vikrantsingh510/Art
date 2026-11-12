import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArViewer } from '@/components/ar-viewer';
import { ArtworkArPanel } from '@/components/artwork-ar-panel';
import { ArtworkGallery } from '@/components/artwork-gallery';
import { ArtworkSizeGuide } from '@/components/artwork-size-guide';
import { AddToCartButton, AddToWishlistButton } from '@/components/collection-actions';
import { ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { resolveArtworkArAssets } from '@/lib/ar-assets/storefront-storage';
import { availabilityLabel, formatDimensions } from '@/lib/format';
import { canonicalFor } from '@/lib/journal-origin';
import { artworkImageUrl, publicMediaItems, privateMediaItems } from '@/lib/media';
import { formatInrFromPaise } from '@/lib/money';
import { getAccessToken } from '@/lib/session';
import { buildWhatsappEnquiryHref, DEFAULT_WHATSAPP_BUTTON_LABEL } from '@/lib/whatsapp-enquiry';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const token = await getAccessToken();
    const artwork = await api.getArtwork(id, { token });
    return { title: artwork.title };
  } catch {
    return { title: 'Artwork' };
  }
}

export default async function ArtworkDetailPage({ params }) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const token = await getAccessToken();
  let artwork;
  try {
    artwork = await api.getArtwork(id, { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return (
      <div className="page-shell py-16">
        <ErrorState error={error} retryHref={`/artwork/${id}`} />
      </div>
    );
  }

  const publicMedia = publicMediaItems(artwork);
  const privateMedia = privateMediaItems(artwork);
  const dimensions = formatDimensions(artwork);
  const ar = await resolveArtworkArAssets(artwork);
  const posterUrl = artworkImageUrl(artwork);
  let enquiry = { enabled: false };
  try {
    enquiry = await api.getWhatsappEnquiry();
  } catch {
    enquiry = { enabled: false };
  }
  const pageUrl = await canonicalFor(`/artwork/${artwork.id}`);
  const whatsappHref = enquiry?.enabled
    ? buildWhatsappEnquiryHref({
      e164: enquiry.e164,
      title: artwork.title,
      id: artwork.id,
      url: pageUrl,
    })
    : null;

  return (
    <div className="page-shell py-10 md:py-16">
      <p className="label-sm text-patina mb-8">
        <Link href="/explore" className="text-link">The permanent collection</Link>
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-6">
          <ArtworkGallery key={artwork.id} artwork={artwork} />
          {dimensions ? (
            <p className="text-sm text-patina">
              Actual size {dimensions}. The on-screen photograph is illustrative and is not centimetre-accurate.
            </p>
          ) : (
            <p className="text-sm text-patina">
              The on-screen photograph is illustrative. Catalogued width, height and unit are required before size can be stated.
            </p>
          )}
          <ArtworkSizeGuide artwork={artwork} />
        </div>
        <aside className="lg:col-span-5 space-y-6">
          <p className="label-sm text-patina">{availabilityLabel(artwork)}</p>
          <h1 className="font-display text-4xl md:text-5xl italic leading-tight">{artwork.title}</h1>
          {artwork.artist?.slug ? (
            <p className="text-lg text-on-surface-variant">
              <Link href={`/artists/${artwork.artist.slug}`} className="text-link">{artwork.artist.name || artwork.artistName}</Link>
            </p>
          ) : (
            <p className="text-lg text-on-surface-variant">{artwork.artistName}</p>
          )}
          <p className="font-display text-3xl">{formatInrFromPaise(artwork.pricePaise)}</p>
          <p className="text-sm text-patina">INR. Displayed from server paise. Acquisition does not include live payment in this release.</p>
          <AddToCartButton artworkId={artwork.id} purchasable={artwork.isPurchasable} nextPath={`/artwork/${artwork.id}`} />
          <AddToWishlistButton artworkId={artwork.id} nextPath={`/artwork/${artwork.id}`} />
          {ar.ready ? (
            <ArtworkArPanel ar={ar} title={artwork.title} posterUrl={posterUrl} />
          ) : null}
          <ArViewer artwork={artwork} imageUrl={posterUrl} />
          {whatsappHref ? (
            <a
              className="btn-primary w-full"
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {enquiry.buttonLabel || DEFAULT_WHATSAPP_BUTTON_LABEL}
            </a>
          ) : null}
          <dl className="space-y-4 border-t border-fillet pt-6">
            <Spec label="Medium" value={artwork.medium} />
            <Spec label="Material" value={artwork.material} />
            <Spec label="Technique" value={artwork.technique} />
            <Spec label="Dimensions" value={dimensions} />
            <Spec label="Year" value={artwork.yearCreated} />
            <Spec label="Availability" value={`${artwork.availableQuantity ?? '—'} available`} />
          </dl>
        </aside>
      </div>

      {(artwork.story || artwork.description) ? (
        <section className="max-w-3xl mt-20 space-y-4">
          <p className="label-md text-patina">Curatorial monograph</p>
          <h2 className="font-display text-3xl">The artwork’s story</h2>
          <p className="text-[15px] leading-7 whitespace-pre-wrap">{artwork.story || artwork.description}</p>
        </section>
      ) : null}

      {publicMedia.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-2xl mb-4">Public media</h2>
          <ul className="space-y-2 text-sm">
            {publicMedia.map((item) => (
              <li key={item.id}>{item.mediaType} · {item.originalFilename || item.storagePath}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {privateMedia.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl mb-4">Private documents</h2>
          <p className="notice">
            Certificate and document records exist, but signed download URLs are not available from the API. Files are not exposed in the browser.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Spec({ label, value }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex justify-between gap-6 border-b border-fillet pb-3">
      <dt className="label-md text-patina">{label}</dt>
      <dd className="text-sm text-right">{value}</dd>
    </div>
  );
}
