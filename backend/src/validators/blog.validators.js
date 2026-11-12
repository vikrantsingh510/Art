import { z } from 'zod';
import { paginationQuery } from './common.js';

export const blogSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens.');

export const blogSlugParam = z.object({
  slug: z.string().trim().min(1).max(255),
});

export const blogStatusSchema = z.enum(['draft', 'published']);

export const blogCreateBody = z.object({
  title: z.string().trim().min(1).max(255),
  slug: blogSlugSchema.optional(),
  excerpt: z.string().trim().max(2000).nullable().optional(),
  body: z.string().max(100_000).optional(),
  coverImagePath: z.string().trim().min(1).max(500).nullable().optional(),
  coverAltText: z.string().trim().max(255).nullable().optional(),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  status: blogStatusSchema.optional(),
});

export const blogUpdateBody = blogCreateBody.partial().extend({
  title: z.string().trim().min(1).max(255).optional(),
});

export const blogArtworksBody = z.object({
  artworkIds: z.array(z.string().uuid()).max(50),
});

export const blogListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  status: blogStatusSchema.optional(),
});

export default {
  blogSlugParam,
  blogCreateBody,
  blogUpdateBody,
  blogArtworksBody,
  blogListQuery,
};
