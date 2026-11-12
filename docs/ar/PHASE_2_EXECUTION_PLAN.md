# Phase 2 execution plan — AR asset pipeline and eligibility contract

**Status: IN REVIEW — implementation complete for the listed review items. Phase 3 not started.**

Admin-entered width, height, optional depth and explicit unit are the only permitted real-world size. Those values define the GLB/USDZ plane in metres. Image pixels are never used to replace width, height or unit, and are never used to derive plane width.

Screen preview (Phase 3) and photo preview remain separate from centimetre-accurate AR.

Phase 1 Android + desktop are PASS. iOS Quick Look is **NOT TESTED / PENDING**. This phase does **not** integrate Model Viewer into artwork detail.

---

## Golden business rules

Example: admin enters **200 × 150 cm**. AR must be **2.0 × 1.5 m**, even if the customer’s wall is smaller. The painting must not be auto-shrunk to fit.

| Rule | Behaviour |
| --- | --- |
| Authoritative size | Admin width, height, optional depth, **explicit** unit |
| Plane dimensions | `widthM` and `heightM` = admin values × unit. Image aspect does **not** set plane width |
| Never derive size from pixels | Image aspect is a **gate** only: match or ineligible |
| Never stretch | No UV or mesh distortion to force a match |
| Never silent crop | No trimming of artwork content |
| Never silent catalogue edit | 90 × 120 cm stays 90 × 120 cm until an admin changes it |
| Mismatch | Flag for correction; **not AR-ready**; **do not emit ready GLB/USDZ** |
| Generate meshes | Only after image aspect matches physical aspect (within 2%) |
| Customer AR copy | Communicates the admin size (e.g. `90 × 120 cm`), never an image-derived size |

Current golden artwork: **90 × 120 cm** with **6720 × 10000 px** (aspect 0.672 vs 0.75, ~10.4%). **Remains flagged. Not AR-ready.**

Aspect match tolerance: **2%** relative difference. 10.4% is a material discrepancy.

### Fixture validation vs physical artwork validation

- **Mathematical fixture:** a 200 × 150 px JPEG whose aspect equals 200 × 150 cm. Used in tests to prove GLB POSITION bounds are **2.0 × 1.5 m**. It is not a catalogue artwork.
- **Physical artwork:** the real gallery JPEG plus admin centimetres. *A Moment of Innocence* fails this gate (10.4% mismatch) and must not be AR-ready.

---

## Constraints

- JavaScript only. No TypeScript.
- No production `ArViewer` or artwork detail edits.
- No database, schema, migration, RLS or Storage policy changes.
- No paid AR SDK.
- Preserve working `/dev/ar-poc` (Phase 1 harness; its image-derived 80.64 cm plane is **not** the production contract).
- Generation failure must not block catalogue publishing.
- No commit or push unless separately requested.

---

## Workstreams

### A. Repeatable generation

CLI: image + artwork id + width + height + unit (+ optional depth, status, max-edge).

Plane **width and height in metres = admin values converted with the explicit unit**. Depth is recorded; the mesh stays a thin double-sided quad.

GLB/USDZ are written **only** when aspect matches, and only from the **processed** JPEG texture. Otherwise a `ready: false` evaluation manifest and `current.json` are written; previous models for that id are **not** treated as current.

UVs remain the Phase 1 correction (glTF upper-left, USD lower-left).

### B. Dimension and aspect validation

- Width and height required, positive, plausible (5 cm–500 cm after conversion).
- Unit required: `mm` | `cm` | `in`. Never infer.
- Depth optional; if present must be positive and use the same unit.
- Image JPEG/PNG pixels vs physical aspect; material mismatch → flag, ineligible, no meshes.

### C. Integrity

When meshes are built: GLB magic/version/length; POSITION min/max equals admin metres; USDZ ZIP + Y-up. Invalid output is not `ready` and is not pointed to by `current.json`.

### D. Texture optimisation

Sharp decodes the source and re-encodes a JPEG contained in a max long-edge (production default **2048 px**, quality **82**, `fit: 'inside'`, no enlargement). Same aspect; no stretch; no content crop.

The gallery original is never overwritten. GLB and USDZ embed the processed JPEG only.

1024 / 2048 / 4096 px outputs are compared by `npm run ar:compare-textures`. The workstream is complete only when processed bytes are smaller than the source for oversized inputs.

### E. Eligibility

`isArReady` is true only when:

- status is **published** or **sold**
- image present
- physical dimensions valid
- aspect matches
- manifest `assetsValid` (both outputs validated, not mere file existence)
- GLB and USDZ present for the **current** content hash
- content hash matches current inputs

| Status | Customer AR-ready if assets validate |
| --- | --- |
| published | yes |
| sold | yes (preview remains eligible) |
| reserved | **never** |
| draft | no (`not-published`) |
| archived | no |

Mismatch, incomplete generation, missing pair, and stale hash are not AR-ready.

### F. Versioning

Content hash = SHA-256 of generator version + UV convention + maxEdge + JPEG quality + unit + width + height + depth + source image SHA-256.

Layout:

```text
frontend/public/ar-assets/{artworkId}/
  current.json          # written last; the only pointer Phase 3 may follow
  manifest.json         # evaluation snapshot
  {contentHash}/
    painting.glb
    painting.usdz
    texture.jpg
    manifest.json
```

`current.json` is updated to `ready: true` only after **both** GLB and USDZ validate in the same version directory. Failed or incomplete regeneration writes `current.json` with `ready: false`, `assetsValid: false`, and null file pointers so old assets cannot be served as current. Changing the source image or physical dimensions produces a new hash; the previous pointer is stale.

---

## Phase 3 (documented only)

Customer-facing responsive `object-fit: contain` gallery, production Model Viewer, true-scale AR CTA, dimension copy, Size Guide (sofa/bed/wall with stated reference sizes). Not implemented here.

---

## Exit gate

1. Admin dimensions remain authoritative.
2. Generated model metres match admin width × height exactly when aspect is approved.
3. Aspect mismatch is detected; 90 × 120 + 6720 × 10000 is not AR-ready.
4. No stretch or silent crop; mismatched images are ineligible rather than fitted to the plane.
5. Ready GLB/USDZ preserve physical scale (`ar-scale="fixed"` remains the Phase 3 launch setting).
6. Unresolved discrepancies cannot be AR-ready.
7. Screen preview vs AR scale are separate concerns (preview not wired in Phase 2).
8. Generation is repeatable via CLI.
9. Tests, lint, production build pass.
10. Phase 3 requirements documented, not implemented.
