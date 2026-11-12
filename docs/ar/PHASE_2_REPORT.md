# Phase 2 implementation report — AR asset pipeline

**Status: APPROVED — Phase 2 is COMPLETE. Phase 3 not started.**

Approved 11 November 2026. The pipeline meets the approved business requirements. Implementation is frozen unless a specific issue is identified.

Admin-entered physical dimensions are the source of truth. Image pixels are never used to replace width, height or unit, and are never used to derive plane width. Mismatched images are flagged and are not AR-ready.

---

## 1. Objective

Repeatable GLB/USDZ generation, exact physical size preservation, aspect validation, integrity checks, **actual JPEG decode/re-encode**, eligibility (published + sold; reserved never), and versioned manifests with `current.json` — without storefront integration.

---

## 2. Review items

### 2.1 Actual texture optimisation

Sharp (`^0.35.5`, direct frontend dependency) decodes the source and re-encodes a JPEG with `fit: 'inside'`, no enlargement, quality **82**. GLB and USDZ embed that processed JPEG. `frontend/public/dev/ar-poc/source.jpg` was **not** overwritten (8,653,404 bytes before and after).

Command: `npm run ar:compare-textures`  
Evidence file: `frontend/public/ar-assets/_texture-study/comparison.json`

#### Visual contain of the gallery JPEG (aspect 0.672 preserved)

| Max edge | Pixels | JPEG bytes | vs original 8,653,404 |
| --- | ---: | ---: | ---: |
| 1024 | 688 × 1024 | 116,556 | **−98.7%** |
| **2048** (production default) | 1376 × 2048 | 496,530 | **−94.3%** |
| 4096 | 2753 × 4096 | 2,069,812 | **−76.1%** |

Visual check of the three study JPEGs:

- **1024:** composition intact; dark canopy and dress ruffles are softer.
- **2048:** watercolor grain, bouquet and grass specks remain readable at wall scale.
- **4096:** finer paper grain; about 4× the 2048 file for a small extra in detail.

#### GLB / USDZ from the processed texture

The catalogue work is **90 × 120 cm** and still mismatches, so it cannot emit ready meshes. To measure real photographic GLB/USDZ bytes without stretching or rewriting the catalogue, the same JPEG was generated against a **study-only** matching rectangle of **67.2 × 100 cm**. That rectangle is not a catalogue edit.

| Max edge | Texture bytes | GLB | USDZ | POSITION (m) |
| --- | ---: | ---: | ---: | --- |
| 1024 | 116,556 | 117,836 | 118,757 | 0.672 × 1.0 |
| **2048** | 496,530 | 497,812 | 498,731 | 0.672 × 1.0 |
| 4096 | 2,069,812 | 2,071,092 | 2,072,013 | 0.672 × 1.0 |

All three reduce output bytes versus embedding the 8.6 MB original. GLB and USDZ of each row share one content-hash version directory. Production default remains **2048**.

### 2.2 Artwork eligibility

Approved rule, now implemented and tested:

| Status | Customer AR-ready if assets validate |
| --- | --- |
| published | yes |
| sold | yes |
| reserved | **never** |
| draft | no (`not-published`) |
| archived | no |

### 2.3 Versioning and stale-asset safety

Layout:

```text
{artworkId}/
  current.json          # written last; only pointer that may be served as current
  manifest.json
  {contentHash}/
    painting.glb
    painting.usdz
    texture.jpg
    manifest.json
```

Verified in tests:

- Changing source image bytes or physical width changes the content hash.
- Status alone does not change the hash.
- Failed generation (`generation-failed` on an undecodable JPEG) returns no files and is not ready.
- After a successful version, a mismatched regeneration writes `current.json` with `ready: false`, `assetsValid: false`, and null file pointers, so the previous GLB is not current.
- An incomplete version directory (GLB without USDZ) is rejected even if `current.json` claims ready. Readiness requires validated GLB **and** USDZ, not mere existence.
- GLB and USDZ are always written to the same hash directory.

Golden artwork `current.json`: `ready: false`, `assetsValid: false`, `files.glb/usdz: null`, reason `aspect-mismatch`.

### 2.4 Physical dimensions

- Admin width, height, optional depth, explicit unit are the only scale. Unit is never inferred.
- Matching fixture **200 × 150 cm** → GLB POSITION **2.0 × 1.5 m** exactly (mathematical fixture validation).
- Golden artwork **90 × 120 × 4 cm** → 0.9 × 1.2 m recorded; image 6720 × 10000 (delta **10.4%**) → **not AR-ready**, no meshes (physical artwork validation).
- No stretch, crop, or catalogue rewrite (`stretched/cropped/catalogueEdited: false`).

### 2.5 Documentation

`PHASE_2_EXECUTION_PLAN.md` no longer derives plane width from image aspect and no longer lists sold as ineligible. Authoritative admin width and height define the plane; mismatched images are ineligible.

---

## 3. Golden rules applied

| Rule | Implementation |
| --- | --- |
| Admin width, height, depth, unit | `parsePhysicalDimensions` — unit never inferred |
| Never replace size from pixels | Plane metres = admin × unit only |
| Never stretch / silent crop / silent catalogue edit | Flags stay false; 90 × 120 is unchanged |
| Aspect mismatch | `deltaPct > 2%` → `aspect-mismatch`, no ready meshes |
| Generate meshes | Only when aspect matches; then GLB/USDZ at **exact** admin metres from the **processed** JPEG |
| Customer size copy | `physicalLabel` / `customerCopy` (UI in Phase 3) |

Current *A Moment of Innocence* (90 × 120 cm, 6720 × 10000 px): **flagged, not AR-ready, no GLB/USDZ written.**

---

## 4. Files

Created or updated in this review pass:

- `frontend/lib/ar-assets/*` (texture Sharp path, eligibility, async generate, hash+quality, persist + `current.json`)
- `frontend/scripts/generate-ar-assets.mjs`
- `frontend/scripts/compare-ar-textures.mjs`
- `frontend/tests/ar-assets.test.mjs`
- `frontend/package.json` — `sharp`, `ar:compare-textures`
- `frontend/next.config.mjs` — MIME for `{artworkId}/{hash}/*.glb|usdz`
- `docs/ar/PHASE_2_EXECUTION_PLAN.md`
- `docs/ar/AR_ASSET_OPERATOR.md`
- `docs/ar/PHASE_3_STOREFRONT_REQUIREMENTS.md` (sold/reserved note only)
- this report

Not modified:

- `frontend/components/ar-viewer.js`
- `frontend/app/(gallery)/artwork/[id]/page.js`
- schema, migrations, RLS, Storage
- `/dev/ar-poc` behaviour (Phase 1 harness kept)

---

## 5. Tests, lint, build

```text
npm test                 # 95 pass (ar-assets coverage includes Sharp, sold/reserved, current.json)
npm run lint             # 0 errors (3 pre-existing warnings in untouched production files)
npm run build            # success; /dev/ar-poc still gated; artwork detail unchanged
npm run ar:generate -- --from-poc    # exit 2, golden still flagged
npm run ar:compare-textures          # byte tables above; source.jpg unchanged
```

---

## 6. Phase 3 (documented, not built)

See `docs/ar/PHASE_3_STOREFRONT_REQUIREMENTS.md`:

- Responsive `object-fit: contain` gallery; dimensions shown separately
- Production Model Viewer; zoom does not change metres; `ar-scale="fixed"`
- View on your wall only when `isArReady` (published or sold, validated current assets; never reserved)
- Photo preview stays labelled illustrative
- Size Guide (sofa/bed/wall) with stated reference sizes

---

## 7. Carry-forward limitations (future phases)

These remain open after Phase 2 approval. They must be accounted for before or during later work; they are not defects in the approved pipeline.

1. **EXIF orientation is not currently normalised.** Future image processing must apply orientation before aspect validation and asset generation. Phase 2 uses encoded JPEG SOF dimensions so the gate stays consistent with the bytes on disk.
2. **The 200 × 150 cm fixture proves mathematical scale, not the physical dimensions of an actual painting.** GLB POSITION **2.0 × 1.5 m** confirms the generator writes admin metres. It is not a tape-measured artwork.
3. **Artwork depth is recorded but the current 3D model is a thin quad.** Admin depth is stored on the manifest and in customer copy; actual frame thickness is not represented in the mesh.
4. **iOS Quick Look remains NOT TESTED / PENDING.** Phase 1 Android (WebXR) and desktop passed. Scene Viewer still bounced on the Google app.
5. **The current golden artwork remains AR-ineligible because of its 10.4% aspect mismatch.** Catalogue size stays **90 × 120 × 4 cm** against **6720 × 10000 px**. That is correct under the business rule until an admin supplies a matching image or deliberately corrects the entered size.

Other notes (not blocking Phase 2):

- `/dev/ar-poc` still uses the Phase 1 **80.64 × 120 cm** unstretched plane for device demo. That is **not** the production contract.
- Production `ArViewer` still uses `artworkPhysicalSizeMetres`, which infers `cm` if unit is missing. Unchanged on purpose.
- No Size Guide, no detail-page CTA, no Storage upload.
- Old hash directories may remain on disk after a new version; they are not current unless `current.json` points at them **and** both files validate.

---

## 8. Exit gate

| Criterion | Result |
| --- | --- |
| Admin dimensions authoritative | **Pass** |
| Generated metres match admin size when aspect matches | **Pass** (2.0 × 1.5 m fixture; study 0.672 × 1.0 m) |
| Aspect mismatch detected and safe | **Pass** (90 × 120 flagged, no meshes, `current.json` not-ready) |
| Actual JPEG optimisation reduces bytes | **Pass** (8.6 MB → 497 KB at 2048; GLB 497,812) |
| Published / sold eligible; reserved not | **Pass** |
| Versioning / stale safety | **Pass** (`current.json`, validated pair, hash invalidation) |
| No stretch / silent crop | **Pass** |
| Unresolved discrepancy cannot be AR-ready | **Pass** |
| Screen vs AR treated separately | **Pass** (no detail-page work) |
| Repeatable generation | **Pass** (CLI) |
| Tests / lint / build | **Pass** |
| Phase 3 documented only | **Pass** |

**Phase 2 is APPROVED and COMPLETE. Do not start Phase 3 yet. Keep the Phase 2 implementation unchanged unless a specific issue is identified.**
