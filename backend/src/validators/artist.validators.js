import { z } from 'zod';
import { paginationQuery } from './common.js';

export const artistSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens.');

export const artistSlugParam = z.object({
  slug: z.string().trim().min(1).max(255),
});

export const artistStatusSchema = z.enum(['draft', 'published']);

export const artistCreateBody = z.object({
  name: z.string().trim().min(1).max(150),
  slug: artistSlugSchema.optional(),
  shortBio: z.string().trim().max(2000).nullable().optional(),
  biography: z.string().max(100_000).nullable().optional(),
  profileImagePath: z.string().trim().min(1).max(500).nullable().optional(),
  profileImageAlt: z.string().trim().max(255).nullable().optional(),
  artisticStyle: z.string().trim().max(150).nullable().optional(),
  medium: z.string().trim().max(150).nullable().optional(),
  location: z.string().trim().max(150).nullable().optional(),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  status: artistStatusSchema.optional(),
});

export const artistUpdateBody = artistCreateBody.partial().extend({
  name: z.string().trim().min(1).max(150).optional(),
});

export const artistListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  status: artistStatusSchema.optional(),
});

export default {
  artistSlugParam,
  artistCreateBody,
  artistUpdateBody,
  artistListQuery,
};
