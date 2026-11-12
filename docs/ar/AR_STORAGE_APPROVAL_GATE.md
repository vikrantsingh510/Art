# AR Storage approval gate

**Status: WAITING FOR EXPLICIT APPROVAL. No bucket, policy, RLS or schema change has been applied.**

Inspected 11 November 2026 against the live Supabase project used by this repository.

## Current Storage (unchanged)

| Bucket | Public | MIME allow-list | Notes |
| --- | --- | --- | --- |
| `artwork-images` | yes | JPEG, PNG, WebP, AVIF | Gallery photographs. Admin JWT upload. 10 MiB. |
| `artwork-documents` | no | PDF, JPEG, PNG | Private. |
| `artwork-videos` | no | MP4, WebM | Private. |

`ar-assets` **does not exist**. No `storage.objects` policy mentions `ar-assets`.

Existing policies remain scoped to `artwork-images` (public SELECT, admin INSERT/DELETE via `current_user_is_admin()`) and the private media buckets (JWT `app_metadata.role`). This work does not alter those policies.

Postgres: no new tables. Express env still has no service-role key. Browser code still has only the publishable key.

## Recommended bucket (not created)

| Setting | Value | Why |
| --- | --- | --- |
| Name | `ar-assets` | Dedicated customer AR delivery. Do not reuse `artwork-images` (image MIME allow-list, admin browser uploads, 10 MiB cap). |
| Public | **yes** | Model Viewer and iOS Quick Look need durable HTTPS URLs without `Authorization` headers. |
| File size | 20 MiB | Same as `artwork-documents`. Versioned GLB+USDZ stay well under this. |
| Allowed MIME | `model/gltf-binary`, `model/vnd.usdz+zip`, `application/json` | Only the files this pipeline writes. |

## Recommended policies (not applied)

Writes use the **service-role key in the operator CLI only**. The service role bypasses Storage RLS. Customer browsers never receive that key.

Still attach a SELECT policy so `anon` / `authenticated` can read the public URLs:

```sql
-- DO NOT APPLY until approved.
CREATE POLICY "Public can view published AR assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'ar-assets');
```

Do **not** add INSERT, UPDATE or DELETE policies for `anon` or `authenticated`. There must be no browser upload path.

Do **not** add Postgres RLS or migrations for this feature.

## Why not private + signed URLs

- iOS Quick Look (`ios-src`) fetches the USDZ URL without the page’s Authorization header.
- Signed query strings expire; a wall-placement session can outlive a short TTL.
- Model Viewer may cache `src` / `ios-src`. Rotation would strand the viewer on a dead URL.
- Public-read of **only customer-ready versions** is the same pattern as `artwork-images`.

Unpublished works are kept off this bucket entirely: the publisher refuses draft, reserved and archived lots, and `current.json` is written last.

## Credentials

| Location | Key | Use |
| --- | --- | --- |
| Operator CLI (`npm run ar:publish`) | `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`) | Upload, overwrite current pointer, inspect bucket |
| Next.js storefront | `NEXT_PUBLIC_SUPABASE_URL` only | Public GET of `current.json`, manifest, GLB, USDZ |
| Browser | Publishable key only | Unchanged. No AR upload API. |

## What is already implemented without this approval

Code, mocked tests, storefront remote resolver, launch error handling. No production upload. No bucket create.
