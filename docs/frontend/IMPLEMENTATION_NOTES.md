# Frontend implementation notes

Brand treatment used in this build:

- Product wordmark: **Maison d'Art** (matches `README.md` and admin Stitch screens).
- Exhibition series copy: **Vérité Salon** is retained as editorial naming from the customer Stitch screens, not as a second product brand.
- Confirm with the owner if the public wordmark should be Vérité Fine Art instead. The technical app does not need to wait on that decision.

Environment names (values stay local; never commit secrets):

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Google OAuth must be enabled on the Supabase project, with redirect `http://localhost:3000/auth/callback`. The publishable key is the only key used in the browser.

Public artwork images are resolved as:

`{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/{storagePath}`

Admin image upload uses the same public bucket, then `POST /admin/artworks/:id/images` with the path, MIME type and size. An artwork may have at most five public images. MIME type and size follow the live `artwork-images` bucket (`GET /admin/storage/artwork-images`), not a hardcoded 10 MiB constant. If that bucket metadata cannot be loaded, register is rejected (`503` unavailable, or `404` if the bucket is missing) — validation is never skipped. Order is `PATCH /admin/artworks/:id/images/order`. Removal deletes the Storage object first (browser JWT, `404` counts as already gone), then `DELETE /admin/artworks/:id/images/:imageId`. If Storage delete fails, the catalogue row is kept so retry is possible. If Storage succeeds and catalogue delete fails, the row remains as the recoverable record; retry treats a Storage `404` as success then removes the row. Browser Storage DELETE needs migration `0008` on the target database. The first image is primary by default; the administrator can choose another. Publishing requires at least one catalogue image; the form saves a draft first if images are still uploading. Existing single-image lots keep working: listing cards still render only the primary image. The customer detail page uses `ArtworkGallery` (thumbnails, previous/next, lightbox). No new `artwork_images` table or schema migration was required — `display_order` and `is_primary` already existed. If Storage RLS rejects the upload, the artwork record can still be saved as a draft.

AR: live path is WebXR `immersive-ar` + hit-test on supported Android Chrome. iOS Safari uses the photo preview. Artwork `width` / `height` / `dimension_unit` (`cm` \| `in` \| `mm`) drive scale. Camera frames stay in the tab.
