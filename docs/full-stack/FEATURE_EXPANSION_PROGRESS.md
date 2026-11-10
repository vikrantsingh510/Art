# Feature expansion progress

Milestone 0 design: `docs/full-stack/FEATURE_EXPANSION_DESIGN.md`.

## Milestone 1 — Profile editing

Done. `PATCH /api/v1/auth/me` updates `fullName` and `phone` only. `/account/profile` has edit/save/cancel.

## Milestone 2 — Address editing and deletion

Done. `PATCH` / `DELETE /api/v1/addresses/:id`. Default transitions are transactional. Order snapshots are untouched.

## Milestone 3 — Admin orders register

Done. `GET /api/v1/admin/orders` with `q`, status, paymentStatus, date range, pagination. `/admin/orders` is a real table. No capture/refund/dispatch controls.

## Milestone 4 — Separate wishlist and cart

Done. New `carts` / `cart_items`. Existing `wishlist_items` moved into the cart (they were the bag). True wishlist starts empty. Checkout clears cart only.

## Milestone 5 — Live AR

Done. Artwork detail “View in your space”: WebXR `immersive-ar` + hit-test where the browser supports it; labelled photo preview otherwise. No paid SDK. Camera frames are not uploaded.

## Milestone 6 — Docs, tests, local commands

See `FEATURE_EXPANSION_GAPS.md` and the API map updates.

### Local commands

```bash
# backend
cd backend
npm test
npm run db:migrate   # uses MIGRATION_DATABASE_URL; never drizzle-kit push

# frontend
cd frontend
npm test
npm run lint
npm run build
```

Backup before migrate: dump `wishlists`, `wishlist_items`, `profiles`, `addresses`, `artworks`, `orders`.
