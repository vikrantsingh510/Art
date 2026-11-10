# Maison d’Art — Admin and artwork operations guide

**Audience:** project owner / atelier operator  
**Date inspected:** 10 November 2026  
**Scope:** how to sign in as an administrator, catalog an artwork, upload an image, publish it, and confirm it on the public site.

This is an investigation document. It describes the **current implementation**. It does not change application code, database rows, roles, Storage, Auth, or production settings.

## How to read this document

Every section is tagged:

| Tag | Meaning |
|---|---|
| **Confirmed** | Observed in source code or in a read-only database count. You can rely on this. |
| **Required manual setup** | You (or a trusted database administrator) must configure this outside the app. This guide does not perform it. |
| **Missing / unverified** | Not built, not wired in the UI, or not proven in this environment (for example Storage policies that live only in the Supabase dashboard). |

Money in the API is integer **paise**. The admin form asks for **INR rupees** and converts before save. Currency is **INR**.

Do not put service-role keys, database passwords, or access tokens in the frontend. This guide never prints them.

---

## Quick map of URLs (local)

| What | URL |
|---|---|
| Storefront | http://localhost:3000 |
| Sign in | http://localhost:3000/auth/login |
| OAuth callback | http://localhost:3000/auth/callback |
| Collector dossier | http://localhost:3000/account |
| Profile | http://localhost:3000/account/profile |
| Forbidden (signed in, not admin) | http://localhost:3000/forbidden |
| Curatorial console | http://localhost:3000/admin |
| Artwork collection | http://localhost:3000/admin/artworks |
| Catalog a new artwork | http://localhost:3000/admin/artworks/new |
| Explore (public catalogue) | http://localhost:3000/explore |
| Artwork detail (public) | http://localhost:3000/artwork/{uuid} |
| Express API | http://localhost:5000 |
| API prefix | http://localhost:5000/api/v1 |
| Health | http://localhost:5000/api/v1/health |

Sources: `frontend/README.md`, `backend/.env.example` (`PORT=5000`, `FRONTEND_URL=http://localhost:3000`), `frontend/app/admin/layout.js`.

---

# PART 1 — Admin authentication

## 1. How does a new customer register?

**Confirmed.** There is no email/password registration form and no “Create account” page.

1. The visitor opens `/auth/login` (“Sign in with Google”).
2. They click **Continue with Google**.
3. Google + Supabase Auth create or reuse `auth.users`.
4. The browser lands on `/auth/callback`, which exchanges the OAuth `code` for a session cookie.
5. The next authenticated call to Express (`GET /api/v1/auth/me` or any `requireAuth` route) runs `provisionCustomerIdentity`:
   - inserts `profiles` with the **same UUID** as `auth.users.id`
   - inserts `user_roles` with role `customer` (`ON CONFLICT DO NOTHING`)
   - inserts empty `wishlists` and `carts` rows
6. A welcome notification is queued as `customer.welcome`. Real email delivery is **not** implemented (mock outbox only).

Sources: `frontend/components/login-button.js`, `frontend/app/auth/callback/route.js`, `backend/src/services/identity.service.js`, `backend/src/middlewares/auth.middleware.js`.

**Important environment caveat (Confirmed in code + security docs):** after migration `0005_security_hardening.sql`, the intended runtime database role `maison_app` has **SELECT only** on `user_roles`. The identity service still tries to `INSERT` the `customer` row. That INSERT works today only because the development `DATABASE_URL` user is privileged (see §1.7). After a production cutover to `maison_app`, first login will not be able to write `user_roles` until a reviewed `SECURITY DEFINER` function exists. That function is **Missing**. Documented in `docs/database/ART_DATABASE_SECURITY_HARDENING.md` §8 and `backend/src/db/schema/index.js`.

Admin is **never** auto-assigned at signup.

## 2. How does Google login work?

**Confirmed.**

```
Browser  →  supabase.auth.signInWithOAuth({ provider: 'google',
              redirectTo: {origin}/auth/callback?next=... })
Google   →  Supabase Auth
Supabase →  GET /auth/callback?code=...&next=...
Next.js  →  exchangeCodeForSession(code)  →  sets cookies  →  redirect to `next`
Later    →  Express verifies the access token at {SUPABASE_URL}/auth/v1/user
```

- Passwords are not stored in this application (`/auth/login` copy).
- `next` must start with `/` or the app falls back to `/account`.
- Callback errors redirect to `/auth/login?error=callback` or `error=session`.
- Frontend uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (must start with `sb_publishable_`).
- Express uses `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` to verify the Bearer token. There is no service-role key in the frontend.

**Required manual setup:** Google provider enabled in the Supabase project, and redirect URL `http://localhost:3000/auth/callback` (plus the production origin when you deploy). See `frontend/README.md`.

Sources: `frontend/lib/supabase/browser.js`, `frontend/lib/env.js`, `backend/src/services/auth.service.js`.

## 3. How is the authenticated user identified?

**Confirmed.**

| Layer | What it trusts |
|---|---|
| Browser / Next.js cookies | Supabase SSR session (`frontend/lib/supabase/server.js`, refreshed in `frontend/proxy.js`) |
| Next.js server | `session.access_token` → `GET /api/v1/auth/me` |
| Express | `Authorization: Bearer <access_token>` |
| Express identity | Token payload `id` (UUID) = `profiles.id` = `auth.users.id` |

`isAdmin` on the client is **not** authority. The frontend reads `user.isAdmin` from `/auth/me` and hides/shows the **Console** link. The API recomputes admin from `user_roles`.

Guards: `frontend/lib/guards.js` (`canAccessAdmin` = `Boolean(user?.isAdmin)`). Tests in `frontend/tests/guards.test.mjs` confirm a client `role: 'admin'` flag with `isAdmin: false` is rejected.

Sources: `frontend/lib/session.js`, `backend/src/controllers/auth.controller.js`.

## 4. Where is the admin role stored?

**Confirmed.** PostgreSQL table `user_roles`:

| Column | Meaning |
|---|---|
| `id` | Row UUID |
| `user_id` | FK to `profiles.id` (same as Auth user id), `ON DELETE CASCADE` |
| `role` | enum `user_role`: `customer` or `admin` |
| `created_at` | Timestamp |

A person may hold **both** `customer` and `admin` as two rows. Unique constraint: `(user_id, role)`.

There is **no** public admin registration API. `user_roles` is not client-writable.

Sources: `backend/src/db/schema/user-roles.schema.js`, `backend/src/db/schema/enums.js`, `backend/src/db/migrations/0000_phase1_identity_gallery.sql`.

## 5. How does the application determine whether a user is an admin?

**Confirmed.**

1. Express `requireAuth` loads roles with `getProfileWithRoles`.
2. `req.user.isAdmin = roles.includes('admin')`.
3. `GET /api/v1/auth/me` returns `{ id, email, fullName, roles, isAdmin, profile }`.
4. Next.js `requireAdmin()` (`frontend/lib/session.js`):
   - no session → `/auth/login?next=...`
   - session but `!user.isAdmin` → `/forbidden`
5. Express `requireAdmin` on `/api/v1/admin/*`:
   - no user → 401 `Authentication required`
   - not admin → 403 `Admin access required`

Sending `isAdmin: true` or `role: 'admin'` on `PATCH /auth/me` is rejected (`backend/src/utils/profile-fields.js`, strict Zod body in `backend/src/validators/profile.validators.js`).

## 6. How can the project owner safely obtain the initial admin role?

**Confirmed intended process** (does **not** run automatically):

1. Sign in once with Google so a `profiles` row exists.
2. Copy your user UUID from `GET /api/v1/auth/me` → `data.id` (browser Network tab, while signed in). Do not email that UUID in public channels if you can avoid it.
3. In the **Supabase SQL Editor** (or `psql`) as the **migration administrator** (`postgres` / `MIGRATION_DATABASE_URL` user — **not** `maison_app`):

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'admin');
```

Replace the placeholder with your `profiles.id`. If the row already exists, the unique constraint will reject a duplicate; that is safe.

4. Sign out (**Sign out** in the console header) and sign in again, or refresh. `/auth/me` must now list `admin` in `roles`.
5. The header shows **Console**. Open http://localhost:3000/admin.

`maison_app` cannot insert this row (`GRANT SELECT` only — `0005_security_hardening.sql`). Do not grant the runtime role INSERT without a new security review.

Source: `docs/database/ART_DATABASE_SECURITY_HARDENING.md` §8.

## 7. Does an admin account already exist in the development database?

**Confirmed (read-only count, 10 November 2026). No roles were changed.**

Inspection connected as the current Express `DATABASE_URL` user and counted rows only. No emails, names, or UUIDs are published here.

| Count | Value |
|---|---|
| `profiles` | 1 |
| `user_roles` total | 2 |
| `user_roles` where role = `customer` | 1 |
| `user_roles` where role = `admin` | **1** |
| `artworks` | 0 |
| published artworks | 0 |
| `categories` | 0 |
| `collections` | 0 |
| `artwork_images` | 0 |

That pattern is one Google identity that already holds **both** `customer` and `admin`. If you sign in with **that same Google account**, `/admin` should open. If you sign in with a different Google account, you will get `/forbidden` even though an admin row exists for someone else.

The runtime database user observed during inspection was `postgres` on a remote host (not `maison_app`). Production is supposed to switch to `maison_app` (`docs/backend/PRODUCTION_READINESS.md`). That switch was **not** performed here.

## 8. If no admin exists, what is the officially intended provisioning process?

Same as §1.6. There is no in-app “make me admin” button, no seed script in this repository that assigns admin, and no dashboard toggle.

## 9. Can an admin role be assigned through the profile page?

**Confirmed: no.**

`/account/profile` notice: “You can update name and phone. Email stays with Google sign-in. Role and admin access cannot be edited here.”

Editable fields: **Name**, **Phone** only (`PATCH /api/v1/auth/me`). **Email** and **Roles** are read-only display. Forbidden keys include `role`, `roles`, `isAdmin`.

Sources: `frontend/app/(gallery)/account/profile/page.js`, `frontend/components/profile-form.js`.

## 10. What happens when a normal customer visits `/admin`?

**Confirmed.**

| Visitor | Result |
|---|---|
| Signed out | Redirect to `/auth/login?next=%2Fadmin` (or the current path) |
| Signed in, `isAdmin` false | Redirect to `/forbidden` — “This console is reserved” / “Your signed-in identity does not have the admin role assigned in the database.” |
| Signed in, `isAdmin` true | `AdminShell` (“Curatorial console”) |

API calls to `/api/v1/admin/*` without the admin role return 403, even if someone forges a URL.

Sources: `frontend/app/admin/layout.js`, `frontend/app/(gallery)/forbidden/page.js`, `backend/src/routes/index.js`.

---

# PART 2 — Artwork management

Admin navigation labels (**Confirmed**, `frontend/components/admin-shell.js`):

- Dashboard
- Artwork collection
- Add new artwork
- Orders
- Customers

There is **no** admin screen to create categories or collections. APIs exist (see Part 7).

## 1. Exact steps to create an artwork

**Confirmed.**

### Prerequisites

- Frontend and backend running (Part 6).
- Google session whose `user_roles` includes `admin`.
- Optional: at least one category and/or collection if you want Taxonomy selections. Today the development database has **zero** of each, so those lists will be empty. You can still save an artwork.

### Steps

1. Sign in at http://localhost:3000/auth/login.
2. Click **Console** (desktop header) or open http://localhost:3000/admin.
3. Open **Artwork collection** (`/admin/artworks`) or **Add new artwork**.
4. Click **Add new artwork** → `/admin/artworks/new` (“Catalog a new artwork”).
5. Fill **Artwork title**, **Artist / atelier**, and **Price (INR rupees)** (the only fields the form treats as required before submit).
6. Optionally fill material ledger, monograph, inventory, status, featured, taxonomy, and a public image.
7. Click **Create artwork**.
8. The app `POST`s `/api/v1/admin/artworks`. On success it may upload an image (Part 3), then navigates to `/admin/artworks/{id}/edit`.

Client-side required check copy: “Title, artist and a numeric INR price are required.”

Sources: `frontend/app/admin/artworks/new/page.js`, `frontend/components/artwork-form.js`.

## 2–3. Form fields, types, and validation

Labels below are the **exact UI labels**. `name=` is the HTML field. API names are camelCase JSON.

| UI label | Form `name` | Required in UI | Sent to API as | Type / validation |
|---|---|---|---|---|
| Artwork title | `title` | Yes (`required`) | `title` | string, trim, 1–255 |
| Slug | `slug` | No. Hint: “Optional. Public detail lookup remains UUID-only.” | `slug` (omitted if blank) | string 1–255 if sent. If omitted, server sets `uniqueSlug(title)` e.g. `my-title-a1b2c3` |
| Artist / atelier | `artistName` | Yes | `artistName` | string, 1–150 |
| Year | `yearCreated` | No | `yearCreated` or `null` | integer 1000–9999 |
| Medium | `medium` | No | `medium` or `null` | string max 150 |
| Material | `material` | No | `material` or `null` | string max 150 |
| Technique | `technique` | No | `technique` or `null` | string max 150 |
| Width | `width` | No | `width` or `null` | numeric; DB CHECK null or `> 0` |
| Height | `height` | No | `height` or `null` | numeric; DB CHECK null or `> 0` |
| Depth | `depth` | No | `depth` or `null` | numeric; DB CHECK null or `> 0` |
| Unit | `dimensionUnit` | No (input default `in`) | `dimensionUnit` or `null` | DB CHECK: `cm`, `in`, or `mm` only. UI is a **text** field, not a dropdown. Invalid values fail at Postgres, not a friendly enum. |
| Description | `description` | No | `description` or `null` | string max 20 000 |
| Story | `story` | No | `story` or `null` | string max 20 000 |
| Price (INR rupees) | `priceRupees` | Yes (`type=number` min 0 step 1) | `pricePaise` | rupees × 100, rounded integer, `>= 0` |
| Inventory quantity | `inventoryQuantity` | No (default 1) | `inventoryQuantity` | integer `>= 0`, default 1 |
| Status | `status` | No (default `draft`) | `status` | `draft` \| `published` \| `reserved` \| `sold` \| `archived` |
| Featured on the exhibition | `isFeatured` | No (checkbox) | `isFeatured` | boolean, default false |
| Categories | `categoryIds` | No (multi-select) | `categoryIds` | UUID array, default `[]` |
| Collections | `collectionIds` | No (multi-select) | `collectionIds` | UUID array, default `[]` |
| (file input, no Field label) | `imageFile` | No | not in create body | see Part 3 |

Hardcoded on submit: `currency: 'INR'`.

There is **no** “active” status in this product. Do not look for one.

Sources: `frontend/components/artwork-form.js`, `backend/src/validators/artwork.validators.js`, `backend/src/db/schema/artworks.schema.js`.

## 4. Price format and currency

**Confirmed.**

- You type **whole INR rupees** in **Price (INR rupees)**. Hint: “Converted to integer paise before POST/PATCH.”
- Storage: `price_paise` bigint, CHECK `>= 0`.
- `currency` varchar(3), default `INR`.
- Public pages format with `formatInrFromPaise` (`en-IN`, rupee symbol).
- Checkout totals are also paise / INR. Payment capture is **not** implemented.

## 5. Dimensions and supported units

**Confirmed.**

- Fields: **Width**, **Height**, **Depth**, **Unit**.
- Allowed units in the database: `cm`, `in`, `mm` (migration `0006_feature_expansion.sql`).
- Live WebXR AR uses width + height + unit to compute metres (`backend/src/utils/dimensions.js`, `frontend/lib/dimensions.js`). Depth is stored but not required for AR scale.
- Zero or negative dimensions are rejected by CHECK constraints.
- Empty dimensions are allowed; live AR then explains that scale cannot be verified.

## 6. Category / collection selection

**Confirmed.**

- Multi-selects on the artwork form, populated from:
  - `GET /api/v1/admin/categories` (includes inactive)
  - `GET /api/v1/admin/collections` (includes unpublished)
- Saving writes join tables `artwork_categories` and `collection_artworks` (replace-all on update when those arrays are sent).
- Public Explore can filter `categoryId` / `collectionId`.
- Public collections list only rows with `is_published = true`.
- **Missing UI:** no page to create/edit a category or collection. You would need `POST /api/v1/admin/categories` or `POST /api/v1/admin/collections` with an admin Bearer token, or SQL as the migrator. Development currently has **0** categories and **0** collections, so the Taxonomy boxes are empty until you add some.

Sources: `backend/src/routes/catalog.routes.js`, `backend/src/services/catalog.service.js`.

## 7. Availability and inventory

**Confirmed.**

- **Inventory quantity** is the stock counter (`inventory_quantity`, default 1, CHECK `>= 0`).
- Checkout does **not** decrement that column. It inserts `inventory_reservations` (`active`) for 15 minutes (`RESERVATION_TTL_SECONDS`, default 900).
- API computed fields:
  - `reservedQuantity` = sum of active reservations
  - `availableQuantity` = inventory − reserved
  - `isPurchasable` = `status === 'published'` **and** `availableQuantity > 0`
- Public label helper (`frontend/lib/format.js`): Available / Archived / Acquired / Reserved / Unavailable.
- Setting status to `reserved` or `sold` is a **manual admin choice**. Checkout does not flip those statuses.

## 8. Featured artwork

**Confirmed.**

- Checkbox **Featured on the exhibition** → `is_featured`.
- Home (`/`) requests `GET /api/v1/artworks?featured=true&limit=8` (public, therefore **published** only). If that list is empty, it falls back to the latest published lots.
- Explore can pass `featured=true`. `featured=false` does **not** exclude featured works (`artwork.service.js`).

## 9. Draft, published, reserved, sold, archived

There is no “active” status. Behaviour **Confirmed**:

| Status | On Explore / home? | Public `GET /artworks/:id` | Purchasable? | Typical use |
|---|---|---|---|---|
| `draft` | No | 404 for the public; admin with Bearer can load it | No | Work in progress. Default on create. |
| `published` | Yes | Yes | Yes, if stock remains | Visible catalogue lot. |
| `reserved` | No | 404 public | No | Manual hold; not set by checkout. |
| `sold` | No | 404 public | No | Manual “Acquired” label if someone opens it as admin. |
| `archived` | No | 404 public | No | Soft delete. |

Public list filter is hard-coded `status = published` even if a `status` query param is sent (`listArtworks` + `publicOnly: true`).

**Saving vs publishing:** one form, one submit. Status is a field on the same **Create artwork** / **Save artwork** request. There is no separate “Publish” button. To publish: set **Status** to `published` and save.

## 10. How to edit and “delete” an artwork

**Edit — Confirmed**

1. `/admin/artworks` → click the title, or go to `/admin/artworks/{id}/edit`.
2. Change fields. Click **Save artwork**.
3. `PATCH /api/v1/admin/artworks/:id` (partial body).
4. Notice on the edit page: “Image deletion is not available. Additional public images can be uploaded; private media cannot be opened without signed URLs.”

**Delete — Confirmed: archive only**

- List row action **Archive**. Confirm: `Archive “{title}”? This sets status to archived; it does not hard-delete.`
- Calls `DELETE /api/v1/admin/artworks/:id` → `archiveArtwork` sets `status: 'archived'`.
- The row remains. Orders that referenced it remain. Images rows remain.

There is no hard-delete API.

Sources: `frontend/components/archive-artwork-button.js`, `backend/src/services/artwork.service.js` `archiveArtwork`.

## 11. What happens if an artwork is already referenced by an order?

**Confirmed.**

- `order_items.artwork_id` references `artworks.id` with `ON DELETE RESTRICT`. A true SQL `DELETE` of the artwork would fail if order lines exist. The app never issues that delete.
- Each order line also stores `artwork_title` and `artwork_snapshot` JSON, so the docket still shows what was reserved even if you later edit the live catalogue.
- Archiving hides the work from Explore. Historical `/admin/orders/{id}` and `/account/orders/{id}` still list the snapshot.
- Checkout of a non-purchasable work returns 409.

Source: `backend/src/db/schema/order-items.schema.js`, `backend/src/services/checkout.service.js`.

---

# PART 3 — Image upload

## Step-by-step (what the form actually does)

**Confirmed** (`frontend/components/artwork-form.js`):

1. The administrator can select up to five images, preview them, reorder (drag-and-drop or move up/down), mark primary, and remove pending files immediately. Removing a saved image asks for confirmation and happens on save.
2. On create, Express saves a **draft** first if the intended status is `published`, so images can exist before publication. On edit, image add/remove/reorder runs **before** the artwork PATCH so a publish request sees the new catalogue.
3. For each pending file the **browser** uploads directly to Supabase Storage (not Express):
   - bucket: `artwork-images`
   - path: `{artworkId}/{timestamp}-{index}-{sanitizedFileName}`
   - `upsert: false`
   - `contentType`: file MIME or `image/jpeg`
   - size and MIME are checked against `GET /api/v1/admin/storage/artwork-images`
   - On Storage or register failure, a newly uploaded object is deleted when possible. The artwork row still exists.
   - On Storage success: `POST /api/v1/admin/artworks/{id}/images` with `{ storagePath, altText, isPrimary, mimeType, fileSizeBytes }`. Maximum five images. Display order and primary are then confirmed with `PATCH .../images/order`.
4. Saved images that were removed: browser Storage DELETE first (`404` = already gone), then `DELETE /api/v1/admin/artworks/{id}/images/{imageId}`. If Storage delete fails, the catalogue row is left in place and save fails so the administrator can retry. If Storage succeeds and the catalogue delete fails, the row remains as the recoverable record; retry is safe.
5. Success note: “Images uploaded to artwork-images and registered by path.” Form copy: there is no multipart Express upload.

### Answers to the inspection questions

| # | Question | Finding |
|---|---|---|
| 1 | Direct to Storage or through Express? | **Confirmed:** browser → Supabase Storage, then Express only stores the path. |
| 2 | Bucket name | **Confirmed:** `artwork-images` (`PUBLIC_IMAGE_BUCKET` in `frontend/lib/media.js`). |
| 3 | Public or private? | **Code assumes public** (public object URLs). **Unverified** in the live project: no Storage SQL/policies are in this repo. |
| 4 | Allowed formats | Live bucket allow-list from `GET /admin/storage/artwork-images` (JPEG, PNG, WebP, AVIF on the current development bucket). The admin file input `accept` and Express register both use that list. |
| 5 | Maximum file size | Live bucket `fileSizeLimitBytes` from the same endpoint. Not hardcoded as 10 MiB in new UI/backend logic. Express JSON limit is 1 MB and is **irrelevant** to the file bytes. |
| 6 | Multiple images | API and UI: up to **five** `artwork_images` rows. The admin form previews, reorders (drag-and-drop plus move up/down), marks primary, and can remove a saved image after confirmation. Unique index: at most one `is_primary` per artwork. No new table; `display_order` already existed. |
| 7 | Primary / cover | First image is primary by default. The administrator can choose another; `PATCH .../images/order` can send `primaryImageId`. Removing the primary promotes the next remaining image. Public cards still show only the primary. |
| 8 | Previews before upload | Local object-URL previews on the admin form before Storage upload. |
| 9 | Resize / compression | **Missing.** Original bytes are stored. |
| 10 | What is saved in Postgres | `artwork_images.storage_path` (text), plus `alt_text`, `display_order`, `is_primary`. Not a full URL. |
| 11 | How the public site loads images | `publicStorageUrl` → `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/{storagePath}`. Next.js `<Image>` allows `**.supabase.co` public storage paths (`frontend/next.config.mjs`). Missing image: “Image not catalogued”. |
| 12 | Replace or delete artwork | Admin can remove a specific image: browser DELETEs the Storage object first (`404` is treated as gone), then Express deletes the `artwork_images` row. A Storage failure keeps the row. A catalogue failure after Storage success also keeps the row for retry. Migration `0008` allows admin DELETE on `artwork-images` via `current_user_is_admin()`; it is not applied from this change. Archive: status change only; remaining files stay. Hard-delete of artwork is not exposed. |
| 13 | Auth enforcement | Path registration, reorder and removal require admin Bearer (`requireAdmin` via `public.user_roles`). File upload uses the **signed-in user’s JWT + publishable key**. Storage INSERT is `current_user_is_admin()` from `0007`. Storage DELETE on `artwork-images` needs `0008` (not applied to production from this change). Express does not check that the path exists in Storage. |
| 14 | Orphans | **Yes, possible:** failed register after a successful upload; extra files after a “replace”; archived artworks; anything uploaded with a path the API never recorded. |

**Required manual setup:** create a Storage bucket named exactly `artwork-images` in Supabase, decide public vs private, and attach policies that allow the admin user’s upload. This repository does not create the bucket.

---

# PART 4 — Publishing and the public website

## 1–2. How an admin publishes; save vs publish

**Confirmed.** On create or edit, set **Status** to `published` and click **Create artwork** or **Save artwork**. That is the publish operation. Drafts stay invisible until you save `published`.

## 3. How Explore retrieves artworks

**Confirmed.**

- Page: `/explore` (`frontend/app/(gallery)/explore/page.js`)
- API: `GET /api/v1/artworks` with query `q`, `categoryId`, `collectionId`, `minPricePaise`, `maxPricePaise`, `featured`, `page`, `limit` (Explore default limit 18)
- Server always filters `status = published`
- Empty copy: “No works match this hanging”
- Medium / Scale / Movement filters are **not** API-backed (UI says so)

## 4. How artwork detail retrieves data

**Confirmed.**

- Route: `/artwork/{uuid}` only. Non-UUID → Next.js `notFound()`. Slug is stored but **not** used for lookup (`GET /artworks/:slug` is Missing).
- API: `GET /api/v1/artworks/:id` (`optionalAuth`)
- Public / non-admin: 404 unless `published`
- Admin Bearer: can load any status (used by the edit page)
- Purchasers of confirmed/processing/shipped/delivered orders may receive private media **metadata**; signed download URLs are **Missing**

## 5. How collections are linked

**Confirmed.**

- Join table `collection_artworks`
- Set from the artwork form **Collections** multi-select, or API `POST /api/v1/admin/collections/:id/artworks`
- Public list: `GET /api/v1/collections` (published only) → `/collections`
- Public detail: `GET /api/v1/collections/:id` plus `GET /api/v1/artworks?collectionId=` → `/collections/{uuid}`
- Unpublished collections 404 for the public
- Collection cover uses `coverImagePath` with the same public URL helper (no admin UI to set a cover)

## 6. How to verify a newly published artwork is public

**Confirmed procedure (no dummy data required — use the lot you just saved):**

1. Note the UUID from the edit URL `/admin/artworks/{id}/edit`.
2. Confirm **Status** shows `published` on that page.
3. Open http://localhost:3000/explore (signed out, or a private window).
4. You should see the card (title, artist, INR, image or “Image not catalogued”).
5. Open http://localhost:3000/artwork/{id}. Title, **Add to bag**, **Save to wishlist**, **View in your space** should render.
6. If **Featured on the exhibition** was checked, also check `/` “Selected singular acquisitions” (home falls back to latest published if no featured rows).
7. Optional API check: `GET http://localhost:5000/api/v1/artworks` (no auth) should include the item.

## 7. What can keep an artwork off the public site?

**Confirmed causes:**

- Status is not `published` (draft / reserved / sold / archived)
- Explore filters (`q`, category, price, featured) do not match
- Backend not running or `NEXT_PUBLIC_API_BASE_URL` wrong (especially if it still includes `/api/v1` — `getApiBaseUrl()` strips it, but CORS/`FRONTEND_URL` mismatches still fail)
- Image missing: the **lot still lists**; the picture shows “Image not catalogued”
- Collection page: collection unpublished, or the artwork is not a member, or the artwork itself is not published
- Empty database: currently **0** artworks, so Explore honestly empty until you publish one

---

# PART 5 — Orders and customers

Admin sidebar: **Dashboard**, **Orders**, **Customers**.

## Dashboard (`/admin`)

**Confirmed, available**

- Title: “Executive dashboard”
- Metrics from `GET /api/v1/admin/metrics`: **Gross captured**, **Net revenue**, **Orders placed** (with confirmed count), plus a fourth card **Published lots**
- Notice: captured revenue may be ₹0 until Razorpay
- **Recent catalogue** from `GET /api/v1/admin/artworks?limit=8`
- Collector count from `GET /api/v1/admin/customers?limit=8`
- Links: **Open collection**, **Open register**

**Missing / honest gaps**

- No live escrow charts
- No payment capture controls
- The card labelled **Published lots** uses `artworks.total` from the **unfiltered** admin list (all statuses), not `status=published`. Treat the label as approximate.

Source: `frontend/app/admin/page.js`, `backend/src/services/analytics.service.js`.

## Orders register (`/admin/orders`)

**Confirmed, available**

- Title: “Acquisitions & dispatches”
- `GET /api/v1/admin/orders` with Search, Status, Payment, From, To, **Filter**
- Columns: Order (number + UUID), Placed, Collector (name/phone), Items, Total, Status (hold expiry), Payment
- Notice: “Payment capture, refunds and courier dispatch remain deferred and are not offered here.”

## Order detail (`/admin/orders/{id}`)

**Confirmed, available (read-only)**

- Loads `GET /api/v1/orders/:id` as admin (ownership bypass in `getOrderForUser`)
- Optionally `GET /api/v1/admin/orders/:id/shipments`
- Shows total, line titles, **Patron snapshot**, shipment rows if any
- `pending_payment` notice: not marked paid; capture and shipment booking deferred
- Copy when no shipments: “No shipment rows. Creating or updating shipments is disabled in this frontend.”

**API exists but UI does not expose**

- `POST /api/v1/admin/orders/:id/shipments`
- `PATCH /api/v1/admin/shipments/:id`
- `POST /api/v1/admin/notifications/process`
- `POST /api/v1/admin/reservations/expire`

**Not operational (do not treat as live atelier tools)**

- Razorpay capture / refund (`POST /payments/...` returns 503 without keys; keys are empty by design)
- Courier booking, GPS, installation
- Real email
- Marking the order paid from the browser (forbidden by schema comments)

## Customer management (`/admin/customers`, `/admin/customers/{id}`)

**Confirmed, available (read-only)**

- Paginated `GET /api/v1/admin/customers` (`page`, `limit` only)
- Detail: profile name/phone, roles, that collector’s orders
- Notice: “Profile editing is not available.”
- **Cannot** grant admin from this screen

**Missing**

- Server-side search `q` is stripped by the HTTP validator. The box **Filter this page** (`localQ`) only filters the current page in the browser.
- No customer create/disable UI (`profiles.is_active` is not exposed in the form)

---

# PART 6 — Local operation guide

## Commands

Terminal 1 — API:

```bash
cd backend
npm install
npm run dev
```

Listens on `PORT` from `backend/.env` (example **5000**). Confirm `GET http://localhost:5000/api/v1/health`.

Terminal 2 — storefront:

```bash
cd frontend
npm install
npm run dev
```

Opens **http://localhost:3000**.

Production-like frontend: `npm run build` then `npm start`. Do not use that as a substitute for configuring Auth.

## Environment (names only)

**Frontend** `frontend/.env.local` (from `frontend/.env.example`):

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000` — **do not** append `/api/v1`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…` only)

**Backend** `backend/.env` (from `backend/.env.example`):

- `NODE_ENV=development`
- `PORT=5000`
- `FRONTEND_URL=http://localhost:3000` (CORS allowlist — must match the browser origin)
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `RESERVATION_TTL_SECONDS=900` (optional)
- Leave `RAZORPAY_*` empty

Never put `DATABASE_URL`, `MIGRATION_DATABASE_URL`, or a service-role key in the frontend.

## Prerequisites per workflow

| Workflow | You need |
|---|---|
| Browse empty public site | Both servers. No login. |
| Google sign-in | Supabase URL + publishable key; Google provider; redirect `http://localhost:3000/auth/callback` |
| Open `/admin` | Same Google user as the existing `user_roles.admin` row (one already exists in development) **or** the SQL grant in Part 1.6 |
| Create artwork | Admin session. Title, artist, numeric rupee price |
| Show it on Explore | Status `published`. Both servers. |
| Show a photograph | Bucket `artwork-images` + working Storage policy + a successful upload |
| Put it in a collection on `/collections` | A **published** collection row (API/SQL — no admin UI) **and** a published member artwork |
| Featured on home | `isFeatured` + `published` |
| Checkout as a collector | Signed-in customer, published purchasable lot, address; produces `pending_payment` only |
| Live WebXR AR | Published dimensions; Android Chrome; HTTPS or localhost. Desktop/iOS: photo fallback only |

---

# PART 7 — Security and missing setup

Work the owner (or a trusted DBA) must do **manually**. This document does not do it.

## Must configure (or already configured outside git)

1. **Initial admin** — SQL INSERT into `user_roles` as the migrator. Development already has **one** admin row; confirm you are signing in as that Google identity.
2. **Google OAuth** in Supabase, redirect `http://localhost:3000/auth/callback` (and production URL later).
3. **Frontend and backend env files** as in Part 6. CORS origin must equal `FRONTEND_URL`.
4. **Supabase Storage bucket** `artwork-images`. Create it in the dashboard. Public-read is what the Next.js image URLs expect.
5. **Storage policies** so a signed-in admin can `upload` and anonymous visitors can `select` public objects. **Unverified** in-repo; if upload fails, the form already explains that the browser cannot invent a policy.
6. **Categories / collections** if you want Taxonomy or `/collections`. No admin screens; use admin API or SQL.
7. **Production `maison_app` LOGIN + DATABASE_URL cutover** — documented, not applied in this session (`docs/backend/PRODUCTION_READINESS.md`). Until then, Express may still be using a privileged DB user (observed: `postgres`).
8. **Customer `user_roles` INSERT after maison_app cutover** — still **Missing** a `SECURITY DEFINER` function. First-login provisioning will break for the customer role if you cut over without it.

## Do not do

- Do not put a service-role key in Next.js.
- Do not `GRANT INSERT` on `user_roles` to `maison_app` without a new review.
- Do not use `drizzle-kit push`.
- Do not treat Razorpay, courier, or email as live.
- Do not disable Windows / endpoint security to “make uploads work”.

## Missing product functionality (honest list)

| Item | Status |
|---|---|
| In-app admin grant | Missing (SQL only) |
| Category / collection admin UI | Missing (API only) |
| Artwork image delete / Storage cleanup | Missing |
| Private media signed URLs | Missing |
| Public artwork slug route | Missing (UUID only) |
| Cart quantity | Missing (always 1) |
| Explore medium/scale/movement | Missing |
| Customer register server search | Missing (`q` stripped) |
| Payment capture, refunds, shipment booking UI | Deferred / not shown |
| Real email | Deferred (mock outbox) |
| Avatar upload | Missing |
| Application-enforced image MIME/size | Missing |
| Storage bucket + policies in migrations | Missing (dashboard) |

---

# Source index

| Topic | Files |
|---|---|
| Login + callback | `frontend/components/login-button.js`, `frontend/app/(gallery)/auth/login/page.js`, `frontend/app/auth/callback/route.js` |
| Session / admin gate | `frontend/lib/session.js`, `frontend/lib/guards.js`, `frontend/app/admin/layout.js`, `frontend/app/(gallery)/forbidden/page.js` |
| Token verify + roles | `backend/src/services/auth.service.js`, `backend/src/middlewares/auth.middleware.js`, `backend/src/services/identity.service.js` |
| Profile cannot set admin | `frontend/components/profile-form.js`, `backend/src/validators/profile.validators.js`, `backend/src/utils/profile-fields.js` |
| Admin SQL grant | `docs/database/ART_DATABASE_SECURITY_HARDENING.md` §8, `backend/src/db/migrations/0005_security_hardening.sql` |
| Artwork form + archive | `frontend/components/artwork-form.js`, `frontend/components/archive-artwork-button.js` |
| Artwork API | `backend/src/routes/artwork.routes.js`, `backend/src/validators/artwork.validators.js`, `backend/src/services/artwork.service.js` |
| Images | `frontend/lib/media.js`, `backend/src/db/schema/artwork-images.schema.js` |
| Public catalogue | `frontend/app/(gallery)/explore/page.js`, `frontend/app/(gallery)/artwork/[id]/page.js`, `frontend/app/(gallery)/page.js` |
| Admin console pages | `frontend/app/admin/page.js`, `artworks/page.js`, `artworks/new/page.js`, `artworks/[id]/edit/page.js`, `orders/page.js`, `orders/[id]/page.js`, `customers/page.js` |
| Checkout / orders | `backend/src/services/checkout.service.js`, `backend/src/services/admin-orders.service.js` |

---

# One-page operator checklist

1. Start backend (`npm run dev` in `backend`) and frontend (`npm run dev` in `frontend`).
2. Sign in with the Google account that already has the admin role (one admin row exists in development). If `/forbidden` appears, you used a different Google identity — use Part 1.6 only if you intend to grant a **new** person admin, and do it in the SQL Editor yourself.
3. Open **Console** → **Add new artwork**.
4. Enter title, artist, rupee price. Leave **Status** `draft` to hide it, or `published` to show it immediately.
5. Optionally attach a file under **Public image** (requires the `artwork-images` bucket).
6. Click **Create artwork**. Fix Storage errors if the notice says the image was not registered; the lot can still exist.
7. To go live later: edit, set **Status** `published`, **Save artwork**.
8. Verify `/explore` and `/artwork/{id}` while signed out.
9. Do not expect payment, shipping, or email to run.
