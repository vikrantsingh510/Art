# Phase 3 storefront requirements

Implemented on the artwork detail page. Do not start Phase 4 until this phase is approved.

## Responsive product image

- Show the complete artwork in the available container (`object-fit: contain` or equivalent).
- Never distort or crop to fill the frame.
- Detail gallery frames use admin width ÷ height when dimensions are valid.
- Show admin size separately, e.g. `200 × 150 cm` from `formatDimensions`.
- Screen layout must not change stored width, height, depth or unit.
- Screen preview is labelled illustrative.

## Desktop 3D (Model Viewer on the detail page)

- Same `@google/model-viewer` element as Phase 1 (`ArtworkModelViewer`).
- Preserve artwork proportions; fit camera to the viewport; orbit/zoom are viewing only.
- `ar-scale="fixed"`; zoom must not change metres.
- Display actual width and height in artwork information.
- Lazy-load Model Viewer only when the work is AR-ready.

## Android and iOS AR

- **View on your wall** only when Phase 2 storefront eligibility is true and Model Viewer `canActivateAR` is true.
- Launch Model Viewer with admin metres (already in the GLB/USDZ).
- `ar-modes` as proven in Phase 1: `webxr scene-viewer quick-look` until Scene Viewer is retested.
- Do not let the customer freely resize; do not auto-shrink to the wall.
- Communicate actual size in copy, never an image-derived size.
- iPhone Quick Look is prepared and **not physically validated**.

## Room photo preview

- Keep the existing production photo-preview on the detail page.
- Label it as an illustrative preview. Do not claim centimetre accuracy.

## Size Guide (detail page)

Contextual comparisons (sofa, bed, representative wall) using **stated reference dimensions**. Graphics are illustrative. Actual artwork dimensions always remain visible. Not a substitute for AR.

## Integration rules

- Wire eligibility via `evaluateStorefrontAr` + `current.json`. Do not duplicate rules in React.
- Do not mark mismatched works AR-ready. The golden 90 × 120 cm work stays ineligible.
- Preserve gallery, wishlist, cart, purchase, responsive layout.
- iOS Quick Look still pending from Phase 1; do not skip that device test.
