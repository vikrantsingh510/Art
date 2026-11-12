import { z } from 'zod';

export const categoryBody = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const collectionSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens.');

export const collectionBody = z.object({
  name: z.string().trim().min(1).max(150),
  slug: collectionSlugSchema.optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  coverImagePath: z.string().trim().max(1000).optional().nullable(),
  isPublished: z.boolean().default(false),
});

export const collectionUpdateBody = collectionBody.partial().extend({
  name: z.string().trim().min(1).max(150).optional(),
  isPublished: z.boolean().optional(),
});

export const collectionArtworkBody = z.object({
  artworkId: z.string().uuid(),
  displayOrder: z.number().int().min(0).default(0),
});

export const collectionArtworksBody = z.object({
  artworkIds: z.array(z.string().uuid()).max(100),
});

export default {
  categoryBody,
  collectionBody,
  collectionUpdateBody,
  collectionArtworkBody,
  collectionArtworksBody,
};
