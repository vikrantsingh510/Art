import { z } from 'zod';
import { isoDate, paginationQuery } from './common.js';

export const orderStatusFilter = z.enum([
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refund_pending',
  'refunded',
]);

export const paymentStatusFilter = z.enum([
  'created',
  'authorized',
  'captured',
  'failed',
]);

export const adminOrdersQuery = paginationQuery.extend({
  q: z.string().trim().max(150).optional(),
  status: orderStatusFilter.optional(),
  paymentStatus: paymentStatusFilter.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  orderId: z.string().uuid().optional(),
});

export default {
  adminOrdersQuery,
  orderStatusFilter,
  paymentStatusFilter,
};
