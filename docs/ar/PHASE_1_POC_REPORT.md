# Art Cross-Platform AR — Phase 1 Proof of Concept (Model Viewer)

**Status: ANDROID + DESKTOP PASS · iOS NOT TESTED / PENDING**

Option A is proven on the isolated `/dev/ar-poc` route. Google Model Viewer is the shared layer. Production artwork pages, `ArViewer`, WebXR, and photo preview are unchanged. Catalogue dimensions were not edited. Phase 2 has **not** started.

The original plan’s Phase 1 exit gate required **both** physical iOS Quick Look and physical Android wall placement. Android and desktop are now PASS. iOS Quick Look remains **NOT TESTED / PENDING**, so the dual-device exit gate is still open. Physical canvas tape-measure vs catalogue 90 cm is also pending.

---

## Exit gate

| Criterion | Result |
| --- | --- |
| Android physical wall placement (Chrome AR) | **PASS** |
| Painting orientation on the wall | **PASS** (after GLB UV correction) |
| Desktop 3D preview | **PASS** |
| iPhone physical Quick Look wall placement | **NOT TESTED / PENDING** |
| Physical canvas tape-measure vs catalogue 90 × 120 cm | **PENDING** — do not treat 80.64 cm and 90 cm as equivalent |
| Proportions unstretched in generated assets | **PASS** (plane 80.64 × 120 cm from image aspect × catalogue height) |
| Photo preview fallback (POC-local) | **PASS** (labelled not-live-AR; production untouched) |
| Production `ArViewer` / artwork detail unchanged | **PASS** |
| Dual-device Phase 1 exit (iOS **and** Android) | **OPEN** — iOS remaining |

**Android + desktop POC validation: PASS. Do not start Phase 2 until this report and the Phase 2 proposal are approved.**

---

## 1. What Phase 1 proved

One published artwork — *A Moment of Innocence* (`506b0baa-f6e2-4d19-9922-7979b314fa69`) — can be placed on a real vertical wall from a phone browser, at the generated plane size, with correct image orientation, without modifying production pages.

| Check | Outcome |
| --- | --- |
| Isolated `/dev/ar-poc` (production `notFound()`) | Yes |
| Flat-plane GLB + USDZ from the same JPEG and catalogue height | Yes |
| Android Chrome live AR on a physical phone | **PASS** |
| Desktop Model Viewer 3D orbit | **PASS** |
| iOS Safari Quick Look | **NOT TESTED / PENDING** |
| Camera frames uploaded | No |

HTTPS POC URL used during device tests (ephemeral trycloudflare; hostname dies with the tunnel):  
https://conscious-lid-allowing-chicken.trycloudflare.com/dev/ar-poc

---

## 2. Final working AR launch approach

Shared layer: `@google/model-viewer@4.4.0` (peer `three@0.183.0`), loaded only after mount on `/dev/ar-poc`. Not imported by production `ArViewer`.

| Setting | Value | Why |
| --- | --- | --- |
| `ar` | present | Enable AR |
| `ar-modes` | `webxr scene-viewer quick-look` | **WebXR first** on Android |
| `ar-placement` | `wall` | Vertical wall |
| `ar-scale` | `fixed` | Lock metres from the GLB/USDZ |
| `src` | `/dev/ar-poc/painting.glb?v=gltf-uv` | Android / desktop / WebXR |
| `ios-src` | `/dev/ar-poc/painting.usdz?v=gltf-uv` | Apple Quick Look (untested on device) |
| Launch control | External **Place on wall** iff `canActivateAR === true` | Calls `activateAR()`; default FAB hidden |

### Why WebXR is first (not Scene Viewer)

Scene Viewer via the Google app (`com.google.android.googlequicksearchbox`) currently opens and returns in a fraction of a second (model-viewer issue 5210, Oct–Nov 2026). Chrome then follows `S.browser_fallback_url` back to this page. Model Viewer does not auto-start WebXR on that bounce because the tap gesture is spent.

**Working Android path:** `ar-modes="webxr scene-viewer quick-look"`. The first tap stays in **Chrome WebXR** (camera, wall, fixed scale). Scene Viewer remains listed only if WebXR is unavailable. If Scene Viewer still bounces, the page shows a notice and **Place on wall** can be tapped again.

This is a verified exception to the plan’s “prefer Scene Viewer on Android” baseline. Scene Viewer is not abandoned; it is demoted until the Google app is reliable. Quick Look stays in `ar-modes` for a future iPhone test.

Place on wall is not a slotted Model Viewer button (`.btn-primary { display: inline-flex }` can override `.hidden`). Desktop hides the button because `canActivateAR` is false.

---

## 3. GLB UV orientation correction

**Symptom:** After Chrome AR launched, the painting hung **upside down** on the wall. Desktop 3D was already right-side up.

**Cause:** The plane used OpenGL-style UVs (`v=0` at the bottom of the image). glTF 2.0 and WebXR sample with the origin at the **upper-left** of the image, so the texture was inverted in AR.

**Correction (dimensions unchanged):**

- Vertex order remains bottom-left, bottom-right, top-right, top-left.
- **GLB / glTF:** `(0,1), (1,1), (1,0), (0,0)` — `v=0` is the top of the painting.
- **USDZ / USD:** `(0,0), (1,0), (1,1), (0,1)` — `st` origin stays lower-left (USD convention).
- Plane still **80.64 × 120 cm** (catalogue height × image aspect). Catalogue **90 × 120 cm** was not edited.
- Cache-bust query `?v=gltf-uv` so phones do not keep the old 8.6 MB GLB.

Physical Android retest after this change: orientation **PASS**. Desktop 3D retest: still **PASS**.

---

## 4. Android physical test

**Result: PASS**

Product owner confirmed on a physical Android phone:

- Painting launches in **Chrome AR** (WebXR), not a Google-app flash-and-return.
- Places on a **vertical wall**.
- **Orientation is correct** (head toward the ceiling).

| Field | Value |
| --- | --- |
| Route | `/dev/ar-poc` over HTTPS trycloudflare |
| Viewer | Google Model Viewer 4.4.0 |
| AR mode used | Chrome WebXR (`webxr` first in `ar-modes`) |
| Placement | `wall` |
| Scale | `fixed` at generated plane |
| Orientation | Correct after glTF UV fix |
| Device model / Android / Chrome versions | Not captured in this report; outcome confirmed by the owner |
| Scene Viewer | Known Google app bounce; not used for the passing test |

Do not treat this as Scene Viewer validation. Do not treat this as a tape-measured 90 cm width.

---

## 5. Desktop 3D fallback

**Result: PASS**

Verified on `http://localhost:3000/dev/ar-poc` (and re-verified after the UV fix):

- Model Viewer loaded the GLB (`loaded: true`)
- Painting renders right-side up; orbit is usable after load
- `canActivateAR` is false; **Place on wall** is hidden
- Photo preview is labelled not-live-AR; local overlay works
- Production `/artwork/[id]` still imports `ArViewer` (file not modified)

---

## 6. iOS Quick Look

**Result: NOT TESTED / PENDING**

`ios-src` points at `/dev/ar-poc/painting.usdz` (`Content-Type: model/vnd.usdz+zip`, `Content-Disposition: inline`). Quick Look is present in `ar-modes`. USDZ uses Y-up metres and USD `st` coordinates. A physical iPhone / Safari session has **not** been run.

When a device exists:

1. HTTPS URL in **Safari** (not Chrome).
2. Wait for the model; confirm **Place on wall**.
3. Confirm Quick Look, wall placement, portrait proportions, ~81 × 120 cm, right-side-up texture.
4. Record iPhone model, iOS, Safari version.

---

## 7. Dimension mismatch (measurement still pending)

| Measure | Value |
| --- | --- |
| Catalogue | **90 × 120 cm** (explicit, **unchanged**) |
| JPEG | **6720 × 10000** (aspect 0.672 vs catalogue 0.75) |
| Difference | **~10.4%** |
| Edge scan | No extra photographic margin to crop |
| Generated plane | **80.64 × 120 cm** (catalogue height, image aspect, **not stretched**) |

Unresolved: whether the physical canvas is actually 90 cm wide, or the scan is a tighter crop of the painted face. **Do not treat 80.64 cm and 90 cm as equivalent.** On-wall scale still needs a tape measure against the real work. Catalogue rows must not be edited as part of that measurement.

---

## 8. Assets, MIME, HTTPS

| Asset | URL | Status | Content-Type | Notes |
| --- | --- | --- | --- | --- |
| GLB | `/dev/ar-poc/painting.glb?v=gltf-uv` | 200 | `model/gltf-binary` | CORS `*`, 8,654,688 bytes |
| USDZ | `/dev/ar-poc/painting.usdz?v=gltf-uv` | 200 | `model/vnd.usdz+zip` | inline; CORS `*`; 8,655,599 bytes |

Same headers on localhost and the trycloudflare host used for the Android test.

---

## 9. Files (Phase 1 only)

Created: `frontend/lib/ar-poc-model-viewer.js`, `frontend/app/dev/ar-poc/*`, `frontend/tests/ar-poc-model-viewer.test.mjs`, generator + tests, this report.

Not modified: `frontend/components/ar-viewer.js`, `frontend/app/(gallery)/artwork/[id]/page.js`, schema, migrations, RLS, Storage policies.

---

## 10. Tests, lint, build (last full run in this POC)

```text
npm test          # 75 pass (later UV helper tests also pass)
npm run lint      # 0 errors (3 pre-existing warnings in untouched production files)
npm run build     # success; /dev/ar-poc gated with notFound() in production
```

---

## 11. Remaining limitations and known risks

- **iOS Quick Look is untested.** USDZ exists; wall placement, scale and UV convention on iPhone are unknown until a Safari session.
- **Scene Viewer is currently unusable** because of the Google app bounce (model-viewer #5210). Android PASS is Chrome WebXR, not Scene Viewer. When Google ships a fix, Scene Viewer should be retested before restoring it as the first Android mode.
- **Physical width is unresolved** (90 cm catalogue vs 80.64 cm image-aspect plane). Live AR used the unstretched plane. A tape measure is still required.
- **Assets are ~8.6 MB** (full 6720×10000 JPEG embedded). Cellular first load is slow. Compression belongs in Phase 2, not a silent catalogue change.
- **trycloudflare hostnames expire.** Production must not depend on this tunnel.
- **USDZ validator is ZIP magic only**, not a usdchecker run.
- Handset **OS / Chrome versions were not logged**.
- Camera frames are not uploaded; keep it that way.
- Model Viewer adds ~1.02 MiB uncompressed JS; it is code-split to `/dev/ar-poc` only.
- Lit may log a “change in update” warning in Next dev; it did not block AR.
- WebXR, Scene Viewer and Quick Look will not look identical. The plan already forbids guaranteeing that.
- Original Phase 1 exit gate (iOS **and** Android) is **not** fully closed.

---

## 12. Next step

Phase 2 is implemented for review: `docs/ar/PHASE_2_REPORT.md`. Under the production contract, *A Moment of Innocence* is **not AR-ready** (90 × 120 cm vs 6720 × 10000 px). The `/dev/ar-poc` harness is unchanged as a Phase 1 device demo. **Do not start Phase 3 until approved. Do not commit or push unless requested.**
