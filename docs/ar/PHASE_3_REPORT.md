# Phase 3 implementation report — production storefront AR

**Status: COMPLETE for review. Phase 4 not started.**

Phase 1 Android/desktop POC remains PASS; iOS Quick Look is still **NOT TESTED / PENDING**. Phase 2 is approved and unchanged except for shared Model Viewer extraction used by both the POC and the storefront.

---

## 1. Objective

Integrate the Phase 2 asset pipeline and Google Model Viewer into `frontend/app/(gallery)/artwork/[id]/page.js` without redesigning the salon, without touching purchase flows, and without marking mismatched works AR-ready.

---

## 2. Architectural notes (inspected, then implemented)

| Finding | Decision |
| --- | --- |
| Detail page used custom WebXR `ArViewer` plus photo preview | Production AR is Model Viewer (`ar-modes="webxr scene-viewer quick-look"`, wall, fixed scale). Photo preview is kept and labelled illustrative. Custom live WebXR is no longer a storefront CTA (two AR stacks would compete). |
| `evaluateArReadiness` can re-decode image bytes | Storefront does **not** re-decode gallery JPEGs. It uses Phase 2 `evaluateArReadiness` plus `current.json`, validated file presence, manifest aspect, and catalogue-vs-manifest dimension match. |
| `artworkPhysicalSizeMetres` infers `cm` | Storefront eligibility uses Phase 2 `parsePhysicalDimensions` (unit never inferred). |
| Golden artwork 90 × 120 cm / 10.4% mismatch | Left ineligible. Not used as a production AR-ready example. Matching 200 × 150 cm fixtures are used in tests. |
| Importing generator `persist.js` from the detail page traced the whole project | Storefront resolver reads `public/ar-assets` only and does not import the generator. |

---

## 3. How production eligibility is connected

Server, on each artwork detail request:

1. Read `public/ar-assets/{id}/current.json`.
2. Confirm GLB and USDZ paths in that pointer exist and are non-empty.
3. Load the version manifest.
4. Call `evaluateStorefrontAr` → Phase 2 `evaluateArReadiness` (published **or sold**; reserved/draft/archived blocked) plus:
   - `current.ready` and `current.assetsValid`
   - both file pointers present
   - manifest aspect match
   - catalogue width/height/depth/unit equal the manifest (else `stale-hash`)
5. `serializeStorefrontAr` returns GLB/USDZ URLs **only** when ready. Otherwise URLs are `null` (old assets cannot be loaded).

The React tree does not re-implement those rules. `ArtworkArPanel` mounts only when `ar.ready` is true. **View on your wall** additionally requires Model Viewer `canActivateAR === true`.

---

## 4. How physical dimensions are preserved

- Admin width × height × unit remain the plane in the GLB/USDZ (Phase 2).
- Detail gallery frames use admin aspect when dimensions are valid; `object-fit: contain`; no stretch or crop.
- Copy always uses catalogued size (`formatDimensions` / `physicalLabel`).
- Model Viewer: `ar-scale="fixed"`; status copy states zoom does not change metres.
- Size guide scales a rectangle with the artwork’s physical aspect against **stated** sofa (220 × 85 cm), bed (160 × 50 cm) and wall (400 × 280 cm) sizes, labelled illustrative.

---

## 5. Platform behaviour

| Surface | Behaviour |
| --- | --- |
| AR-ready + Android Chrome | Interactive 3D; **View on your wall** when `canActivateAR`; WebXR first, wall, fixed scale |
| AR-ready + iPhone Safari | USDZ `ios-src` prepared for Quick Look; **not physically validated** |
| AR-ready desktop | Interactive 3D; AR button hidden (`canActivateAR` false) |
| Not AR-ready (including golden) | No 3D panel, no wall CTA; photograph + size guide + room-photo preview remain |
| Unsupported / no AR | No misleading AR button; 3D if ready; photo preview always |

Scene Viewer remains listed after WebXR and is still an unverified secondary route.

---

## 6. Changed files

Created:

- `frontend/lib/ar-assets/storefront.js`
- `frontend/lib/ar-assets/storefront-fs.js`
- `frontend/components/artwork-model-viewer.js`
- `frontend/components/artwork-ar-panel.js`
- `frontend/components/artwork-size-guide.js`
- `frontend/tests/ar-storefront.test.mjs`
- `docs/ar/PHASE_3_REPORT.md` (this file)

Modified:

- `frontend/app/(gallery)/artwork/[id]/page.js`
- `frontend/app/(gallery)/about/page.js`
- `frontend/app/dev/ar-poc/model-viewer-element.js` (wrapper around the shared viewer; POC launch copy unchanged)
- `frontend/components/artwork-gallery.js`
- `frontend/components/artwork-image.js`
- `frontend/components/ar-viewer.js` (photo preview only)
- `frontend/components/site-footer.js`
- `frontend/app/globals.css`
- `frontend/lib/ar-poc-model-viewer.js`
- `frontend/tests/ar-poc-model-viewer.test.mjs`
- `docs/ar/PHASE_3_STOREFRONT_REQUIREMENTS.md`
- `docs/ar/AR_ASSET_OPERATOR.md`
- `docs/operations/ART_ADMIN_AND_ARTWORK_OPERATIONS_GUIDE.md` (QA CTA names)

Not modified:

- Cart, wishlist, checkout, purchase buttons
- Schema, migrations, RLS, Storage
- Phase 2 generator / persist / eligibility core
- Production custom WebXR helpers (unused by the storefront CTA)

---

## 7. Tests, lint, build

```text
npm test                 # 105 pass
npm run lint             # 0 errors (2 pre-existing warnings in untouched upload files)
npm run build            # success; /dev/ar-poc still gated; /artwork/[id] dynamic
```

Browser (localhost, this session):

- Golden artwork `506b0baa-…`: gallery `object-contain`, actual size copy, size guide (sofa/bed/wall), **Add to bag**, **Save to wishlist**, **Preview in a room photo**. **View on your wall** absent.
- Room-photo dialog opens with illustrative / not centimetre-accurate copy.
- Explore still lists the work with catalogued dimensions.
- Cart route still loads.
- Mobile-width layout stacks purchase actions; no false AR button.

Physical Android (Samsung S23 / OnePlus Nord 4) and iPhone Safari were **not** available in this session. Do not treat this report as a device PASS.

---

## 8. Carry-forward limitations

1. **iOS Quick Look is integrated but not physically validated.**
2. **Android WebXR is validated in Phase 1; Scene Viewer remains an unverified secondary route.** Production wall CTA was not re-run on S23 / Nord 4 in this session.
3. **The golden artwork remains AR-ineligible** (10.4% aspect mismatch). Catalogue 90 × 120 × 4 cm is unchanged.
4. **EXIF orientation normalisation is not implemented** in the asset pipeline. Storefront does not re-decode pixels.
5. **Depth is recorded; the mesh is still a thin quad** without frame thickness.
6. **Physical dimensions of actual production artwork still need independent tape-measure verification.** The 200 × 150 cm path in tests is a mathematical fixture.

Also: no matching published work currently has ready `current.json` in this catalogue, so live 3D cannot be demonstrated on a real lot until an operator generates assets for an aspect-matching published or sold work.

A Next.js hydration overlay appeared in the Cursor-instrumented browser (`data-cursor-ref` attribute diffs). Production build succeeded. Treat that overlay as tooling noise unless it reproduces in a normal Chrome window.

---

## 9. Purchase and gallery

Add to bag, wishlist, inquiry, explore grid and cart remain in place. Gallery navigation, lightbox and `object-contain` remain. Phase 4 was not started.

**Phase 3: complete for review. Do not start Phase 4 until approved. No commit or push.**
