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

Admin image upload uses the same public bucket, then `POST /admin/artworks/:id/images` with the path. If Storage RLS rejects the upload, the artwork record can still be saved.

AR: live path is WebXR `immersive-ar` + hit-test on supported Android Chrome. iOS Safari uses the photo preview. Artwork `width` / `height` / `dimension_unit` (`cm` \| `in` \| `mm`) drive scale. Camera frames stay in the tab.
