import { z } from 'zod';
import {
  HOMEPAGE_FAQ_ANSWER_MAX_LENGTH,
  HOMEPAGE_FAQ_HEADING_MAX_LENGTH,
  HOMEPAGE_FAQ_LIMIT_MAX,
  HOMEPAGE_FAQ_LIMIT_MIN,
  HOMEPAGE_FAQ_MAX_ITEMS,
  HOMEPAGE_FAQ_QUESTION_MAX_LENGTH,
  HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH,
} from '../lib/homepage-faq.js';
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

export const homepageFaqItemBody = z.object({
  id: z.union([z.string().uuid(), z.null()]).optional(),
  question: z.string().trim().min(1).max(HOMEPAGE_FAQ_QUESTION_MAX_LENGTH),
  answer: z.string().trim().min(1).max(HOMEPAGE_FAQ_ANSWER_MAX_LENGTH),
  enabled: z.boolean().optional(),
});

export const homepageFaqSettingsBody = z.object({
  enabled: z.boolean(),
  heading: z.string().trim().max(HOMEPAGE_FAQ_HEADING_MAX_LENGTH).nullable().optional(),
  subtitle: z.string().trim().max(HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH).nullable().optional(),
  homepageLimit: z.union([
    z.number().int().min(HOMEPAGE_FAQ_LIMIT_MIN).max(HOMEPAGE_FAQ_LIMIT_MAX),
    z.null(),
  ]).optional(),
  items: z.array(homepageFaqItemBody).max(HOMEPAGE_FAQ_MAX_ITEMS),
});

export default {
  whatsappSettingsBody,
  homepageHeroSettingsBody,
  homepageFeaturedArtistSettingsBody,
  homepageFaqSettingsBody,
};
