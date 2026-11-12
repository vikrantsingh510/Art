import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['customer', 'admin']);

export const artworkStatusEnum = pgEnum('artwork_status', [
  'draft',
  'published',
  'reserved',
  'sold',
  'archived',
]);

export const blogStatusEnum = pgEnum('blog_status', [
  'draft',
  'published',
]);

export const artistStatusEnum = pgEnum('artist_status', [
  'draft',
  'published',
]);

export const mediaTypeEnum = pgEnum('media_type', [
  'video',
  'certificate',
  'document',
]);

export const mediaAccessLevelEnum = pgEnum('media_access_level', [
  'public',
  'private',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refund_pending',
  'refunded',
]);

export const reservationStatusEnum = pgEnum('reservation_status', [
  'active',
  'converted',
  'released',
  'expired',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'created',
  'authorized',
  'captured',
  'failed',
]);

export const refundStatusEnum = pgEnum('refund_status', [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
]);

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'pending',
  'packed',
  'shipped',
  'delivered',
  'returned',
]);

export const webhookProcessingStatusEnum = pgEnum('webhook_processing_status', [
  'received',
  'processing',
  'processed',
  'failed',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'processing',
  'sent',
  'failed',
]);
