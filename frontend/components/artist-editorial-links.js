import Link from 'next/link';
import { artistStoryHref, artistWorksHref } from '@/lib/homepage-artists';

export function ArtistEditorialLinks({ artist, showStory = true, tone = 'dark' }) {
  const worksHref = artistWorksHref(artist);
  const storyHref = artistStoryHref(artist);
  const className = tone === 'light'
    ? 'label-sm text-bronze underline underline-offset-[6px] decoration-bronze/70 hover:text-antique'
    : 'label-sm text-bronze underline underline-offset-[6px] decoration-bronze/80 hover:text-secondary-container';
  const worksLabel = tone === 'dark' ? "Explore artist's works" : "Explore artist's work";
  const storyLabel = tone === 'dark' ? "Read artist's story" : 'Read their story';

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
      <Link href={worksHref} className={className}>
        {worksLabel}
      </Link>
      {showStory ? (
        <Link href={storyHref} className={className}>
          {storyLabel}
        </Link>
      ) : null}
    </div>
  );
}
