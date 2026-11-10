# Feature expansion design (Milestone 0)

Date: 9 November 2026  
Scope: profile editing, address edit/delete, admin orders register, separate wishlist, live AR room placement.  
No payment, shipping dispatch, real email, or paid AR services.

## Current schema (verified)

Journal: `0000` … `0005_security_hardening.sql` (six applied-in-repo migrations). Next forward-only tag: `0006_feature_expansion`.

| Area | Actual state |
|---|---|
| Profiles | `full_name`, `phone`, `avatar_path`, `is_active`. `GET /auth/me` only. Phone is not unique. |
| Addresses | GET/POST. Unique partial index `addresses_one_default_per_user`. No PATCH/DELETE in Express. RLS already grants maison_app DELETE. Order `shipping_address_snapshot` is JSON and independent of live addresses. |
| Cart | **There is no cart table.** `wishlists` + `wishlist_items` back `GET/POST/DELETE /cart` and checkout clears `wishlist_items`. |
| Wishlist | Same rows as cart. Frontend `/account/wishlist` and `/cart` both call `/cart`. |
| Orders | Customer `GET /orders`, `GET /orders/:id` (owner or admin). **No `GET /admin/orders`.** Status enum: `pending_payment`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `refund_pending`, `refunded`. Payments exist but Razorpay is deferred. |
| Artworks | `width`, `height`, `depth`, `dimension_unit` (varchar, unconstrained). AR runtime is not implemented; `artwork_previews` is metadata only. |
| Auth | Bearer → Supabase `/auth/v1/user` → provision `profiles` + `customer` + `wishlists`. Admin from `user_roles` only. |

## Proposed schema / API

### 1. Profile — no table change except unique phone

- Canonical `PATCH /api/v1/auth/me`
- Editable: `fullName`, `phone` only. `.strict()` body. Email stays in Supabase Auth. Reject `role`, `isAdmin`, `userId`, `isActive`, `avatarPath`.
- Blank string → `null`. Phone unique where `phone IS NOT NULL`.
- Conflict → 409.

### 2. Addresses — no table change

- `PATCH /api/v1/addresses/:id`
- `DELETE /api/v1/addresses/:id`
- Owner from token. Cross-user → 404 (no disclosure).
- Default changes in a transaction. At most one default (existing unique index).
- Delete of the default: remaining address with latest `updated_at` becomes default; if none remain, there is no default.
- Never touch `orders.shipping_address_snapshot`.

### 3. Admin orders

- `GET /api/v1/admin/orders` behind `requireAuth` + `requireAdmin`
- Query (validator **keeps** `q`): `page`, `limit` (1–100), `q`, `status`, `paymentStatus`, `from`, `to`, `orderId`
- Sort: `placed_at DESC`, `id DESC`
- Compact row: `id`, `orderNumber`, `placedAt`, `status`, `itemCount`, `totalPaise`, `currency`, `customerId`, `customerFullName`, `customerPhone`, `paymentStatus` (latest payment or null), `reservationExpiresAt` (min active reservation). **No address snapshot.**
- Index: `orders_placed_at_idx` on `placed_at DESC`.

### 4. Separate cart and wishlist

New tables (mirror existing wishlist shape):

- `carts` — `id`, `user_id` UNIQUE → `profiles`, timestamps
- `cart_items` — unique `(cart_id, artwork_id)`, FK cascade

**Backfill decision (move, do not copy):** current `wishlist_items` **are the cart**. Migration copies each item into `cart_items`, then **deletes** `wishlist_items`. Wishlist starts empty. Cart contents used at checkout are preserved. Items are not duplicated into the true wishlist.

Provisioning also inserts an empty `carts` row (idempotent `ON CONFLICT (user_id) DO NOTHING`).

APIs:

| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | Cart only |
| POST | `/cart/items` | Purchasable only; 409 otherwise. No wishlist mutation |
| DELETE | `/cart/items/:artworkId` | Cart only |
| GET | `/wishlist` | Wishlist only |
| POST | `/wishlist/items` | Save even if not purchasable (sold/archived shown honestly). Never reserves inventory |
| DELETE | `/wishlist/items/:artworkId` | |
| POST | `/wishlist/items/:artworkId/move-to-cart` | Adds to cart if purchasable, then removes from wishlist. No reservation |

Checkout reads and clears **cart_items** only.

### 5. Dimensions / AR

Reuse `width`, `height`, `dimension_unit`. Migration:

- Normalize unit to `cm` / `in` / `mm`
- CHECK unit allowlist
- CHECK width/height/depth null or `> 0`

No new AR persistence. Camera frames stay in-memory. No paid SDK.

**Live path:** WebXR `immersive-ar` + `hit-test` (Android Chrome / devices that actually support it). Places a 2D textured quad scaled from physical width/height (converted to metres). Not a 3D sculpture.

**Fallback:** user-selected room photo, local overlay, position/scale/perspective controls, labelled “photo preview, not live AR”. iOS Safari has no WebXR AR; it uses the fallback.

## Migration sequence

1. Backup recommendation: `pg_dump` of `wishlists`, `wishlist_items`, `profiles`, `addresses`, `artworks`, `orders` before migrate.
2. `npm run db:migrate` from `backend/` with `MIGRATION_DATABASE_URL` (never `drizzle-kit push`).
3. File: `backend/src/db/migrations/0006_feature_expansion.sql`
4. Journal idx 6. Do not edit 0000–0005.

## Compatibility

- Existing `GET /cart` still works; storage changes from wishlist tables to cart tables after migrate.
- Frontend that treated wishlist as cart must be updated in the same release.
- Historical orders unchanged.

## Rollback / forward-fix

SQL migrations are forward-only. Rollback is a new `0007` if needed:

- Recreate `wishlist_items` from `cart_items` if the move must be undone, then drop `carts` / `cart_items` only after confirming no checkout depends on them.
- Drop phone unique index if uniqueness is too strict.
- Drop dimension CHECKs if legacy rows fail (normalize first).

Do not drop/truncate/recreate the database.

## Security

- Identity and admin from verified token + `user_roles`.
- Ownership in the service layer (`user_id = req.user.id`).
- Admin list omits shipping snapshots.
- RLS: enable on `carts` / `cart_items`; `maison_app` policies match wishlist (Express is the authorization layer).
- No service-role keys in the Next.js bundle.

## Tests

HTTP: 401/403/400/strict body. Service/unit: sanitization, default-address transition, phone unique mapping, admin query parsing, cart/wishlist independence, dimension conversion, AR capability detection. Optional live-DB tests skip when `/health/db` is not 200.
