import { z } from 'zod';
import { HOMEPAGE_HERO_ALT_MAX_LENGTH } from '../lib/homepage-hero.js';

export const whatsappSettingsBody = z.object({
  enabled: z.boolean(),
  e164: z.string().trim().max(20).nullable().optional(),
  buttonLabel: z.string().trim().max(40).nullable().optional(),
});

export const homepageHeroSettingsBody = z.object({
  storagePath: z.union([z.string().trim().max(240), z.null()]),
  altText: z.string().trim().max(HOMEPAGE_HERO_ALT_MAX_LENGTH).nullable().optional(),
});

export const homepageFeaturedArtistSettingsBody = z.object({
  artistId: z.union([z.string().uuid(), z.null()]),
});

export default {
  whatsappSettingsBody,
  homepageHeroSettingsBody,
  homepageFeaturedArtistSettingsBody,
};
