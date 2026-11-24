export function publishedArtists(items) {
  return (Array.isArray(items) ? items : []).filter((artist) => (
    artist
    && artist.id
    && artist.slug
    && artist.status !== 'draft'
  ));
}

export function selectHomepageArtists(items, { knowLimit = 3, featuredArtist = null } = {}) {
  const published = publishedArtists(items);
  const pinned = featuredArtist
    && featuredArtist.id
    && featuredArtist.status !== 'draft'
    ? featuredArtist
    : null;
  const withPortrait = published.filter((artist) => artist.profileImagePath);
  const featured = pinned || withPortrait[0] || published[0] || null;
  const known = published
    .filter((artist) => artist.id !== featured?.id)
    .slice(0, knowLimit);

  return { featured, known };
}

export function shouldHydrateHomepageFeaturedArtist(featured, pinnedArtist) {
  if (!featured?.slug || featured.status === 'draft') {
    return false;
  }
  if (
    pinnedArtist?.id
    && pinnedArtist.status !== 'draft'
    && String(pinnedArtist.id) === String(featured.id)
  ) {
    return false;
  }
  return true;
}

export async function hydrateHomepageFeaturedArtist(featured, pinnedArtist, loadBySlug) {
  if (!shouldHydrateHomepageFeaturedArtist(featured, pinnedArtist)) {
    return featured || null;
  }

  try {
    const detail = await loadBySlug(featured.slug);
    if (!detail || detail.status === 'draft') {
      return featured;
    }
    if (featured.id && detail.id && String(featured.id) !== String(detail.id)) {
      return featured;
    }
    return { ...featured, ...detail };
  } catch {
    return featured;
  }
}

export function artistPlainText(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function artistExcerpt(value, maxLength = 320) {
  const plain = artistPlainText(value);
  if (!plain) {
    return '';
  }
  if (plain.length <= maxLength) {
    return plain;
  }
  const sliced = plain.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  const clipped = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced;
  return `${clipped.trim()}…`;
}

export function artistFocusCopy(artist) {
  const shortBio = artistPlainText(artist?.shortBio);
  const biography = artistExcerpt(artist?.biography, 360);
  const body = biography && biography !== shortBio ? biography : '';

  return {
    headline: shortBio || null,
    body: body || (!shortBio && biography ? biography : null),
  };
}

export function artistCategoryLabel(artist) {
  return artist?.location || artist?.artisticStyle || artist?.medium || '';
}

export function artistWorksHref(artist) {
  return artist?.slug ? `/artists/${artist.slug}#works` : '/artists';
}

export function artistStoryHref(artist) {
  return artist?.slug ? `/artists/${artist.slug}#story` : '/artists';
}
