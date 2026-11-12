# AR asset operator notes

Admin-entered width, height, optional depth and **explicit** unit are the physical size customers must see in AR. Those values define the plane. Do not change catalogue numbers to silence a warning. Do not derive plane width from image aspect.

Production customer delivery is **Supabase Storage**, not `public/ar-assets`. Local generate remains available for inspection. Do not treat a local folder as the production origin.

Customer delivery uses the public `ar-assets` bucket. Admin generate/publish uses a private `ar-assets-staging` bucket as a Vercel-safe handoff. Do not change bucket policies from application code. Never put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_` variables.

## Generate (local inspection)

From `frontend/`:

```text
npm run ar:generate -- --from-poc
```

Or explicitly:

```text
node scripts/generate-ar-assets.mjs --artwork-id <uuid> --image <file.jpg> --width 200 --height 150 --unit cm --status published --out public/ar-assets/<uuid>
```

Exit `0`: artwork is AR-ready (published **or sold**, aspect matches, both meshes validated).  
Exit `2`: flagged — read `reasons` in stdout.  
Exit `1`: missing arguments, image file, or a publish/storage error.

`--from-poc` still uses the golden 90 × 120 cm scan. That lot is **not** AR-ready (aspect mismatch ~10.4%). Do not publish it.

## Publish (Storage, after bucket approval)

Requires `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, plus **server-side** `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`). The CLI will not create the bucket.

```text
npm run ar:publish -- --artwork-id <uuid> --image <file.jpg> --width 200 --height 150 --depth 4 --unit cm --status published
```

Sequence: generate or reuse a valid version → acquire `{artworkId}/_lock/{epoch}.json` in staging → validate GLB/USDZ locally → upload immutable `{id}/{contentHash}/` objects → download and re-verify → upload manifest → fence the epoch → write `current.json` last → release that epoch.

Admin UI generate/publish is different: generate writes private staging objects, then publish downloads them, re-validates, and only then writes the public version. The CLI still generates in-process and does not stage meshes; both take the same epoch lock.

If USDZ, manifest or verification fails, `current.json` is left unchanged. Draft, reserved and archived lots are not uploaded.

Already-valid Storage objects for the same content hash are not overwritten and are not regenerated.

## Eligibility

| Status | Customer AR |
| --- | --- |
| published | eligible if assets validate |
| sold | eligible if assets validate |
| reserved | never AR-ready; never uploaded |
| draft / archived | not AR-ready; never uploaded |

## Aspect mismatch

If image aspect and physical aspect differ by more than **2%**, meshes are **not** written and nothing is published. Example: 90 × 120 cm with 6720 × 10000 px stays flagged until an admin supplies a matching image **or** corrects the entered size on purpose.

Never stretch or crop the painting to force a match. Never rewrite catalogue dimensions.

## Storage layout

```text
ar-assets/                            (public, customer)
  {artworkId}/current.json
  {artworkId}/{contentHash}/painting.glb
  {artworkId}/{contentHash}/painting.usdz
  {artworkId}/{contentHash}/manifest.json

ar-assets-staging/                    (private, admin generate → publish)
  {artworkId}/{contentHash}/{attemptId}/painting.glb
  {artworkId}/{contentHash}/{attemptId}/painting.usdz
  {artworkId}/{contentHash}/{attemptId}/manifest.json
  {artworkId}/{contentHash}/{attemptId}/staging.json
  {artworkId}/_lock/{epoch}.json
```

`current.json` is the only mutable customer pointer. Version files in `ar-assets` are immutable. Staging objects live only in `ar-assets-staging` and are deleted after a successful publish. Concurrent Generate requests write distinct `{attemptId}` prefixes so they cannot overwrite each other.

Admin and CLI share one publication protocol: create-if-not-exists `{artworkId}/_lock/{epoch}.json` in staging (never upsert), snapshot `current.json`, upload immutable version files, re-check that this epoch is still the latest unexpired lock (fencing token), then write `current.json` last. Release deletes only `{epoch}.json` for that holder. A successor lock is a new epoch key, so an old holder cannot delete it. First-time `current.json` uses create-if-not-exists. Replacing an existing pointer is still a non-atomic upsert after the fencing check; a narrow race remains between that check and the upsert. Intended operation is a single admin. A successful Admin Publish deletes only the loaded staging attempt after re-checking `staging.json` identity.

The storefront reads `ar-assets` over HTTPS and never reads staging or `process.cwd()`. `generationId` is `{artworkId}:{contentHash}:{attemptId}` and is opaque to the admin UI. The CLI still generates in-process and does not stage meshes; it does take the same epoch lock in `ar-assets-staging`.

## Storefront

The artwork detail page resolves the current pointer from Storage, checks Phase 2 eligibility, catalogue dimensions, source-image SHA-256, and GLB/USDZ integrity. **View on your wall** and interactive 3D appear only when every check passes. Changing the gallery image or catalogue width/height/depth/unit without republishing hides the CTA.

## Out of scope here

Phase 4, admin UI, schema/RLS changes, paid AR SDKs.
