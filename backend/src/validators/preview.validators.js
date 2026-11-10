import { z } from 'zod';

export const previewCreateBody = z.object({
  storagePath: z.string().trim().min(1).max(1000),
  roomMetadata: z.any().optional().nullable(),
});

export default {
  previewCreateBody,
};
