# Frontend API integration map (F0)

Verified against `backend/src/routes`, validators, controllers, and `backend/src/utils/ApiResponse.js` on 8 November 2026.  
No frontend application exists yet (`frontend/` contains only `.gitkeep`). Routes below are **proposed Next.js App Router paths**, not implemented files.

Base URL: `{NEXT_PUBLIC_API_BASE_URL}/api/v1`  
CORS allowlist: `FRONTEND_URL` (example `http://localhost:3000`).  
Auth: Supabase access token as `Authorization: Bearer <token>`. Never send `userId`, `role`, or `isAdmin` from the client as authority.

## Envelope

Success:

```json
{ "success": true, "status": "ok", "data": {} }
```

Optional `message`. Create endpoints typically use HTTP 201.

Error:

```json
{ "success": false, "error": { "message": "...", "details": [] } }
```

`details` is present for Zod validation failures (HTTP 400). Unexpected 500s return `Internal server error` with no stack.

Money is integer **paise**, currency **INR**. Artwork public list only returns `status = published`.

---

## Verified contracts (in-scope MVP)

### Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | `{ success, status, environment, timestamp }` (no `data` wrapper) |
| GET | `/health/db` | none | 200 or 503 |

### Auth / identity

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | `/auth/me` | Bearer | — | `{ id, email, fullName, roles, isAdmin, profile }` |
| PATCH | `/auth/me` | Bearer | `{ fullName?, phone? }` strict | Same identity object as GET. Blank → null. Phone unique → 409. Email/role/isAdmin/avatarPath rejected. |

First successful auth provisions `profiles` + `customer` role + wishlist + cart. Admin is never auto-assigned.

### Public catalog

| Method | Path | Auth | Query / body | Response `data` |
|---|---|---|---|---|
| GET | `/artworks` | none | `page`, `limit` (1–100, default 20), `q`, `categoryId`, `collectionId`, `minPricePaise`, `maxPricePaise`, `featured=true\|false` | `{ items, page, limit, total }` |
| GET | `/artworks/:id` | optional Bearer | UUID | Artwork object |
| GET | `/categories` | none | — | Active categories array |
| GET | `/collections` | none | — | Published collections array |
| GET | `/collections/:id` | none | UUID | Collection + `artworkIds` |

Artwork object (verified fields): `id`, `title`, `slug`, `description`, `story`, `technique`, `medium`, `material`, `artistName`, `yearCreated`, `width`, `height`, `depth`, `dimensionUnit`, `pricePaise`, `currency`, `inventoryQuantity`, `status`, `isFeatured`, `createdAt`, `updatedAt`, `reservedQuantity`, `availableQuantity`, `isPurchasable`, `images[]`, `media[]`, `categoryIds`, `collectionIds`.

Images/media store **storage paths**, not public URLs. `images[]` is ordered by `displayOrder` (then `id`). `isPrimary` marks the cover used by listing cards. At most five catalogue images are accepted. Public list omits private media. Authenticated purchaser or admin may receive private media metadata.

Public `GET /artworks` accepts `status` in validation but **always** filters `status = published`. Admin list uses `status` when provided. `featured=true` filters featured works; `featured=false` does not exclude them.

### Previews (metadata) and live AR (browser)

Live placement is a frontend WebXR/photo flow using artwork `width`/`height`/`dimensionUnit`. `artwork_previews` remains metadata-only and is not required for View in your space.

| Method | Path | Auth |
|---|---|---|
| GET | `/artworks/:artworkId/previews` | Bearer (owner; admin sees all) |
| POST | `/artworks/:artworkId/previews` | Bearer body `{ storagePath, roomMetadata? }` |
| GET | `/admin/previews/:id` | Bearer + admin |

### Cart and wishlist (separate tables)

`carts` / `cart_items` are independent from `wishlists` / `wishlist_items`. Checkout reads and clears the cart only. Wishlist never reserves inventory.

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/cart` | Bearer | — | `{ id, items, count }` |
| POST | `/cart/items` | Bearer | `{ artworkId }` | 201; 409 if not purchasable |
| DELETE | `/cart/items/:artworkId` | Bearer | — | 404 if missing |
| GET | `/wishlist` | Bearer | — | `{ id, items, count }` |
| POST | `/wishlist/items` | Bearer | `{ artworkId }` | Allowed for published/sold/archived; draft → 404 |
| DELETE | `/wishlist/items/:artworkId` | Bearer | — | 404 if missing |
| POST | `/wishlist/items/:artworkId/move-to-cart` | Bearer | — | Cart add if purchasable, then remove from wishlist |

No quantity field. One row per artwork per list.

### Addresses

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/addresses` | Bearer | — |
| POST | `/addresses` | Bearer | `{ recipientName, phone, addressLine1, addressLine2?, city, state, postalCode, country?, isDefault? }` |
| PATCH | `/addresses/:id` | Bearer | Partial of the create body. Owner only; cross-user 404. |
| DELETE | `/addresses/:id` | Bearer | Owner only. If the default is deleted, the latest remaining address becomes default. |

Order `shipping_address_snapshot` is never rewritten.

### Checkout and customer orders (no payment)

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| POST | `/checkout` | Bearer | `{ addressId }` **or** `{ shippingAddress }`, optional `notes`. Empty cart → 400. Unavailable artwork → 409. |
| GET | `/orders` | Bearer | Current user's orders |
| GET | `/orders/:id` | Bearer | Owner, or admin |

Checkout `data` includes order fields, `items[]`, `reservationExpiresAt`. Status is `pending_payment`. Do not display paid/captured.

### Admin catalog

All `/admin/*` require Bearer **and** database role `admin`.

| Method | Path | Body / query |
|---|---|---|
| GET | `/admin/ping` | `{ ok, userId }` |
| GET | `/admin/storage/artwork-images` | Live bucket limits: `fileSizeLimitBytes`, `allowedMimeTypes`. Source of truth for upload validation. |
| GET | `/admin/artworks` | Same list query as public, plus `status` |
| POST | `/admin/artworks` | See create body below |
| PATCH | `/admin/artworks/:id` | Partial create body |
| DELETE | `/admin/artworks/:id` | Archives (`status: archived`), does not hard-delete |
| POST | `/admin/artworks/:id/images` | `{ storagePath, altText?, displayOrder?, isPrimary?, mimeType?, fileSizeBytes? }`. Maximum five images. Path must start with `{artworkId}/`. MIME/size must match the live bucket; if bucket metadata cannot be loaded the register is `503` (or `404` if the bucket is missing), never skipped. |
| PATCH | `/admin/artworks/:id/images/order` | `{ imageIds: uuid[], primaryImageId? }` — `imageIds` must be every image exactly once. |
| DELETE | `/admin/artworks/:id/images/:imageId` | Removes the catalogue row after the browser has deleted the Storage object (`404` = already gone). If it was primary, the next image by `display_order` becomes primary. |
| POST | `/admin/artworks/:id/media` | `{ mediaType, storageBucket, storagePath, accessLevel, ... }` certificates/documents must be `private` |
| GET/POST/PATCH | `/admin/categories` | `{ name, slug?, description?, isActive? }` |
| GET/POST/PATCH | `/admin/collections` | `{ name, slug?, description?, coverImagePath?, isPublished? }` |
| POST | `/admin/collections/:id/artworks` | `{ artworkId, displayOrder? }` |

Artwork create required: `title`, `artistName`, `pricePaise`. Optional: slug, description, story, technique, medium, material, yearCreated, dimensions, currency, inventoryQuantity, status, isFeatured, categoryIds, collectionIds.

There is **no** multipart upload API. Frontend uploads to Supabase Storage, then posts `storagePath`.

### Admin customers and metrics

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/metrics` | Query `from`, `to`. Returns paise totals and `rules` |
| GET | `/admin/customers` | `page`, `limit` only. Service can filter `q`, but the HTTP validator strips it, so search is **not** a verified API. |
| GET | `/admin/customers/:id` | `{ profile, roles, orders }` |
| GET | `/admin/orders` | `page`, `limit`, `q`, `status`, `paymentStatus`, `from`, `to`, `orderId`. Compact rows; no address snapshot. |

Metrics: `capturedPaymentPaise`, `succeededRefundPaise`, `netRevenuePaise`, order counts. With payments deferred, captured revenue may be 0.

### Admin shipments / notifications (preserve; do not expand)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/orders/:id/shipments` | Shipment rows for one order |
| POST | `/admin/orders/:id/shipments` | Create shipment |
| PATCH | `/admin/shipments/:id` | Status update |
| POST | `/admin/notifications/process` | Mock outbox drain |
| POST | `/admin/reservations/expire` | Expire stale holds |

---

## Present but deferred — do not call from MVP UI

| Method | Path | Why |
|---|---|---|
| POST | `/payments/orders/:id/initiate` | Razorpay deferred; 503 without keys |
| POST | `/payments/:id/refunds` | Deferred |
| POST | `/webhooks/razorpay` | Deferred |

---

## Missing API support (do not implement in F0)

Needed for complete customer/admin UX, **not** built:

1. ~~**GET `/admin/orders`**~~ — implemented in `0006` / Milestone 3.
2. ~~**PATCH `/auth/me`**~~ — `fullName` and `phone` only. Avatar still has no update API.
3. ~~**PATCH/DELETE `/addresses/:id`**~~ — implemented.
4. **Private media signed URL** — paths only; no Express signing endpoint (would need a service-role key, which must not go in the browser).
5. **Artwork image/media delete** — add only.
6. **Explore filters** for medium, size band, movement — not query params; only `q`, category, collection, price, featured.
7. ~~**Separate wishlist vs cart**~~ — implemented; see cart/wishlist section.
8. **Quantity on cart lines** — model is one-of-one.
9. **GET `/admin/customers?q=`** — `listCustomers` reads `q`, but `paginationQuery` strips it before the handler.
10. **GET `/artworks/:slug`** — public detail is UUID only.

Workarounds that do **not** require new APIs:

- Admin order detail: `GET /orders/:id` as an admin session (ownership bypass).
- Admin order list (partial): iterate customers — not acceptable for F1; treat as a real gap.
- Public images: construct public Storage URLs from `storagePath` if the `artwork-images` bucket is public.
- Wishlist UI: reuse `/cart`.

---

## Auth rules the frontend must follow

- Google OAuth via Supabase Auth in the browser.
- Send access token on every protected request.
- Trust `GET /auth/me` for `isAdmin` / `roles`.
- 401 → signed-out; 403 → signed-in but not admin.
- CORS origin must match `FRONTEND_URL`.
