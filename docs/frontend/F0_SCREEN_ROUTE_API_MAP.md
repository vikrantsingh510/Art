# F0 screen → route → API map

Implemented Next.js App Router paths (8 November 2026). Artwork detail is `/artwork/[id]` per the frontend master prompt (singular). Auth lives at `/auth/login`. Account nested routes match the master prompt.

Canonical Stitch HTML: `design/stitch-reference/stitch_maison_d_art_gallery_platform/<folder>/code.html`.

## 8 Stitch screens

| Screen | Stitch ID | Proposed route | Backend APIs | API status |
|---|---|---|---|---|
| Home | `9eb3079e5544470680db20d92cf4eb5a` | `/` | `GET /artworks?featured=true`, `GET /artworks`, `GET /categories`, `GET /collections` | Exists |
| Explore | `55f48d0109354881ac1df3a78b1b7fc5` | `/explore` | `GET /artworks` (`q`, `categoryId`, `minPricePaise`, `maxPricePaise`, `page`, `limit`), `GET /categories` | Exists (subset of Stitch filters) |
| Artwork detail | `9617463bdc4246d183f2386180ca2e26` | `/artworks/[id]` | `GET /artworks/:id` (UUID, not slug); add to cart `POST /cart/items` | Exists. AR CTA: preview APIs exist; AR runtime deferred |
| Admin dashboard | `2b85c1b550614e41a9307a582d6680a4` | `/admin` | `GET /admin/metrics`, `GET /admin/ping`, `GET /admin/artworks`, `GET /admin/customers` | Exists. Revenue will be 0 until payments |
| Artwork management | `8e809f412eca4d1ea05691a4a461b89e` | `/admin/artworks` | `GET /admin/artworks`, `PATCH/DELETE /admin/artworks/:id` | Exists |
| Add artwork | `6ba659ea594b44a9871d637ac966c54e` | `/admin/artworks/new` | `POST /admin/artworks`, `POST .../images`, `POST .../media`, categories/collections | Exists. Upload = Storage then path, not multipart |
| Orders | `caf13cd5ffc44d5199d5a1a145078964` | `/admin/orders` | `GET /admin/orders` | Exists. No capture/dispatch UI |
| Order details | `29dc97b7252a43bdbc57c9ebd01ef37b` | `/admin/orders/[id]` | `GET /orders/:id` (admin), `GET /admin/orders/:id/shipments` | Exists. Do not wire payment/refund UI |

## Additional screens required (not in Stitch ZIP)

| Screen | Proposed route | Backend API | Status |
|---|---|---|---|
| Google sign-in | `/auth/login` | Supabase Auth (browser) + `GET /auth/me` | Session exists |
| Account / profile | `/account/profile` | `GET/PATCH /auth/me` | Name/phone editable |
| Addresses | `/account/addresses` | `GET/POST/PATCH/DELETE /addresses` | Exists |
| Wishlist | `/account/wishlist` | `/wishlist` | Independent from cart |
| Cart | `/cart` | `/cart` | Exists (no quantity) |
| Checkout without payment | `/checkout` | `POST /checkout`, `GET /addresses` | Exists. Must show reservation / `pending_payment`, never paid |
| Customer order history | `/orders` | `GET /orders` | Exists |
| Customer order detail | `/orders/[id]` | `GET /orders/:id` | Exists |
| Admin customers | `/admin/customers` | `GET /admin/customers` (`page`, `limit`) | Exists. Search `q` is not a verified HTTP param. No Stitch screen |
| Admin customer detail | `/admin/customers/[id]` | `GET /admin/customers/:id` | Exists. No Stitch screen |
| Edit artwork | `/admin/artworks/[id]` | `PATCH /admin/artworks/:id` | Exists. Add screen is Stitch; edit is implied |

Auth callback: Next.js + `@supabase/ssr` or supabase-js on `/auth/callback` (to be created in F1). Not a product screen.

## Reusable / preserve

| Asset | Preserve |
|---|---|
| Entire `backend/` | Do not reimplement APIs |
| Stitch `code.html` + `screen.png` | Visual source for conversion |
| `curatorial_editorial/DESIGN.md` | Tokens: Playfair Display, Manrope, ivory/bronze, 0 radius |
| `FRONTEND_URL=http://localhost:3000` | CORS already set |
| `frontend/.gitkeep` | Folder reserved for Next.js |
| Express envelope, paise, UUID params, DB-backed admin | Client must follow |

No Next.js components, layouts, or API clients exist to reuse.

## F1 recommendation (smallest slice)

After approval only:

1. Scaffold `frontend/` as Next.js App Router, **JavaScript**.
2. Env names: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser publishable key only).
3. One `lib/api.js` client + Bearer from Supabase session.
4. Convert **Home** Stitch HTML to `/` and load `GET /api/v1/artworks` + `GET /api/v1/categories`.
5. Leave admin, cart, checkout, and login for later slices.

Do not install packages until F1 is approved. Do not add backend routes in F1 unless Home cannot render (it can).
