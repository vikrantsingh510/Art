import { z } from 'zod';
import { paginationQuery } from './common.js';

const artworkStatus = z.enum(['draft', 'published', 'reserved', 'sold', 'archived']);

export const artworkCreateBody = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(20_000).optional().nullable(),
  story: z.string().trim().max(20_000).optional().nullable(),
  technique: z.string().trim().max(150).optional().nullable(),
  medium: z.string().trim().max(150).optional().nullable(),
  material: z.string().trim().max(150).optional().nullable(),
  artistName: z.string().trim().min(1).max(150),
  yearCreated: z.number().int().min(1000).max(9999).optional().nullable(),
  width: z.string().or(z.number()).optional().nullable(),
  height: z.string().or(z.number()).optional().nullable(),
  depth: z.string().or(z.number()).optional().nullable(),
  dimensionUnit: z.string().trim().max(10).optional().nullable(),
  pricePaise: z.number().int().min(0),
  currency: z.string().length(3).default('INR'),
  inventoryQuantity: z.number().int().min(0).default(1),
  status: artworkStatus.default('draft'),
  isFeatured: z.boolean().default(false),
  categoryIds: z.array(z.string().uuid()).default([]),
  collectionIds: z.array(z.string().uuid()).default([]),
});

export const artworkUpdateBody = artworkCreateBody.partial();

export const artworkListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  status: artworkStatus.optional(),
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  minPricePaise: z.coerce.number().int().min(0).optional(),
  maxPricePaise: z.coerce.number().int().min(0).optional(),
  featured: z.enum(['true', 'false']).optional(),
});

export const artworkImageBody = z.object({
  storagePath: z.string().trim().min(1).max(1000),
  altText: z.string().trim().max(500).optional().nullable(),
  displayOrder: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
});

export const artworkMediaBody = z.object({
  mediaType: z.enum(['video', 'certificate', 'document']),
  storageBucket: z.string().trim().min(1).max(100),
  storagePath: z.string().trim().min(1).max(1000),
  originalFilename: z.string().trim().max(255).optional().nullable(),
  mimeType: z.string().trim().max(100).optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  accessLevel: z.enum(['public', 'private']),
  displayOrder: z.number().int().min(0).default(0),
}).superRefine((value, ctx) => {
  if (['certificate', 'document'].includes(value.mediaType) && value.accessLevel !== 'private') {
    ctx.addIssue({
      code: 'custom',
      message: 'Certificates and documents must be private',
      path: ['accessLevel'],
    });
  }
});

export default {
  artworkCreateBody,
  artworkUpdateBody,
  artworkListQuery,
  artworkImageBody,
  artworkMediaBody,
};
