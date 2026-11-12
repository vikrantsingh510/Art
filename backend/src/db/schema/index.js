/**
 * Drizzle schema barrel — 28 tables (27 previous + app_settings).
 *
 * Identity provisioning:
 *   1. Supabase Auth creates `auth.users`.
 *   2. Express verifies the access token against `/auth/v1/user`.
 *   3. A trusted, idempotent server-side operation inserts `profiles`
 *      (same UUID), `user_roles(customer)`, and `wishlists`.
 *   4. Admin roles are assigned only by trusted admin/operations actions.
 *   5. There is no public admin registration API. `user_roles` is not
 *      client-writable.
 *
 * Availability and checkout:
 *   available_quantity = inventory_quantity - SUM(active reservation quantities)
 *   is_purchasable = artwork.status = published AND available_quantity >= requested
 *   Checkout locks artwork rows with SELECT … FOR UPDATE and inserts the
 *   pending-payment order, items and active reservations in one transaction.
 *   Reservation TTL is `RESERVATION_TTL_SECONDS` (default 900). Never expire a
 *   reservation while payment is authorised or unresolved. Captured payments
 *   are idempotent; inventory decrements once per successful order.
 *   A succeeded refund does not restock automatically.
 */

export {
  artistStatusEnum,
  artworkStatusEnum,
  blogStatusEnum,
  mediaAccessLevelEnum,
  mediaTypeEnum,
  notificationStatusEnum,
  orderStatusEnum,
  paymentStatusEnum,
  refundStatusEnum,
  reservationStatusEnum,
  shipmentStatusEnum,
  userRoleEnum,
  webhookProcessingStatusEnum,
} from './enums.js';
export { APP_SETTING_WHATSAPP_ENQUIRY, appSettings } from './app-settings.schema.js';
export { profiles } from './profiles.schema.js';
export { userRoles } from './user-roles.schema.js';
export { addresses } from './addresses.schema.js';
export { artists } from './artists.schema.js';
export { artworks } from './artworks.schema.js';
export { categories } from './categories.schema.js';
export { artworkCategories } from './artwork-categories.schema.js';
export { collections } from './collections.schema.js';
export { collectionArtworks } from './collection-artworks.schema.js';
export { blogs } from './blogs.schema.js';
export { blogArtworks } from './blog-artworks.schema.js';
export { artworkImages } from './artwork-images.schema.js';
export { artworkMedia } from './artwork-media.schema.js';
export { wishlists } from './wishlists.schema.js';
export { wishlistItems } from './wishlist-items.schema.js';
export { carts } from './carts.schema.js';
export { cartItems } from './cart-items.schema.js';
export { artworkPreviews } from './artwork-previews.schema.js';
export { orders } from './orders.schema.js';
export { orderItems } from './order-items.schema.js';
export { inventoryReservations } from './inventory-reservations.schema.js';
export { payments } from './payments.schema.js';
export { refunds } from './refunds.schema.js';
export { shipments } from './shipments.schema.js';
export { webhookEvents } from './webhook-events.schema.js';
export { notificationOutbox } from './notification-outbox.schema.js';
export { auditLogs } from './audit-logs.schema.js';
