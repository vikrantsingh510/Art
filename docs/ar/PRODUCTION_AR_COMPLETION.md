# Production AR completion — Storage, integrity, launch

**Status: CODE COMPLETE for review. Storage bucket NOT created. No production upload. Phase 4 not started.**

Phase 1 Android/desktop POC remains PASS; iOS Quick Look remains **NOT TESTED**. Phase 2 generator is reused. Phase 3 storefront UI is unchanged except the asset resolver and `activateAR()` error handling.

---

## 1. Objective

Move production GLB/USDZ delivery off the Next.js filesystem, add versioned integrity checks, harden AR launch failures, and prepare a real eligible artwork. Hosting stays independent of Vercel vs EC2 vs Docker.

---

## 2. Approval gate (blocked)

Inspected live Storage on 11 November 2026:

- Buckets present: `artwork-images` (public), `artwork-documents` (private), `artwork-videos` (private).
- **`ar-assets` does not exist.** No object policy names that bucket.
- No schema, RLS or policy change was applied.

Exact proposed bucket, MIME list, SELECT-only public policy, and why signed URLs were rejected: `docs/ar/AR_STORAGE_APPROVAL_GATE.md`.

**Do not create the bucket or apply policies until that document is explicitly approved.**

---

## 3. Architecture

```text
Operator CLI (service-role, never NEXT_PUBLIC_)
  → generate or reuse Phase 2 meshes
  → validate locally
  → PUT immutable {artworkId}/{contentHash}/painting.glb|usdz|manifest.json
  → download and re-verify
  → PUT {artworkId}/current.json last

Next.js artwork page (publishable URL only)
  → GET current.json
  → GET version manifest
  → hash gallery source image
  → download GLB/USDZ and validate
  → emit public HTTPS URLs only if every check passes
```

Customer browsers never upload. Draft/reserved/archived lots are refused before the first object is written.

---

## 4. Integrity

| Check | Behaviour |
| --- | --- |
| Source image SHA-256 | Manifest records the generation hash. Storefront hashes the live gallery file. Replacement hides AR even when centimetres are unchanged. |
| Physical dimensions | Catalogue width, height, depth and **explicit** unit must match the manifest. Unit is never inferred. Pixels never define the plane. |
| GLB | Structure, SHA-256, POSITION bounds vs admin metres. |
| USDZ | ZIP magic, required `model.usda` + `texture.jpg`, SHA-256, same version as the GLB. |
| Current pointer | Written only after both assets and the manifest verify. Incomplete or hash-mismatched pointers emit no URLs. |

A v2 USDZ failure leaves v1 `current.json` in place. Immutable version objects are never overwritten with different bytes.

---

## 5. Storefront

`frontend/app/(gallery)/artwork/[id]/page.js` now calls `resolveArtworkArAssets` from `storefront-storage.js`. It does not use `process.cwd()` or `public/ar-assets`. Model URLs are absolute Supabase public object URLs, or `null`.

Gallery, lightbox, Size Guide, room-photo preview, bag, wishlist and inquiry are unchanged. The golden lot still has no **View on your wall** CTA.

---

## 6. AR launch

`ArtworkModelViewer` still uses Model Viewer 4.4.0, `webxr scene-viewer quick-look`, wall, fixed scale, and `ios-src`. `activateAR()` is awaited when thenable, wrapped in try/catch, and never reports success before activation. Failures show a distinct message from the Scene Viewer bounce note.

---

## 7. Real artwork

Live catalogue: one published lot, **A Moment of Innocence** (`506b0baa-…`), 90 × 120 × 4 cm, ~10.4% aspect mismatch. Archived JPEG-register fixtures have no dimensions. **No genuinely eligible published or sold artwork exists.** Nothing was fabricated. No production upload was attempted.

---

## 8. Verification

| Command | Result |
| --- | --- |
| `npm test` | 117 pass, 0 fail |
| `npm run lint` | 0 errors, 2 pre-existing warnings in artwork-image-constraints/upload |
| `npm run build` | Compiled successfully |

Physical device tests (Samsung S23, OnePlus Nord 4, iPhone Quick Look) are **not run**. They need an eligible lot and an approved `ar-assets` bucket.

---

## 9. Outstanding blockers

1. Explicit approval of `docs/ar/AR_STORAGE_APPROVAL_GATE.md` (create `ar-assets`, public-read, SELECT-only, service-role writes).
2. A real published/sold artwork whose image aspect matches catalogued size within 2%.
3. After both: operator `npm run ar:publish`, then physical Android WebXR and iPhone Quick Look tests.

Phase 4 has not started. No commit, no push.
