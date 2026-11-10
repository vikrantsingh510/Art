import { z } from 'zod';

export const shipmentCreateBody = z.object({
  courierName: z.string().trim().max(100).optional().nullable(),
  trackingNumber: z.string().trim().max(150).optional().nullable(),
  trackingUrl: z.string().trim().url().max(1000).optional().nullable(),
  status: z.enum(['pending', 'packed', 'shipped', 'delivered', 'returned']).default('pending'),
});

export const shipmentUpdateBody = shipmentCreateBody.partial();

export const refundCreateBody = z.object({
  amountPaise: z.number().int().positive().optional(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

export const analyticsQuery = z.object({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

export default {
  shipmentCreateBody,
  shipmentUpdateBody,
  refundCreateBody,
  analyticsQuery,
};
