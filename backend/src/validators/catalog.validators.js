import { z } from 'zod';

export const categoryBody = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const collectionBody = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  coverImagePath: z.string().trim().max(1000).optional().nullable(),
  isPublished: z.boolean().default(false),
});

export const collectionArtworkBody = z.object({
  artworkId: z.string().uuid(),
  displayOrder: z.number().int().min(0).default(0),
});

export default {
  categoryBody,
  collectionBody,
  collectionArtworkBody,
};
