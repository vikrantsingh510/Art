# Frontend gaps and decisions

Evidence is from F0 (`docs/frontend/API_INTEGRATION_MAP.md`) and the Express validators/routes. No backend changes were made.

| Gap | Evidence | Affected routes | Frontend behaviour |
|---|---|---|---|
| ~~No `GET /admin/orders`~~ | Implemented | `/admin/orders` | Real paginated register. No capture/dispatch CTAs. |
| ~~No profile PATCH~~ | `PATCH /auth/me` for name/phone | `/account/profile` | Editable. Email/role still locked. |
| ~~No address PATCH/DELETE~~ | PATCH/DELETE owner routes | `/account/addresses`, `/checkout` | Edit/delete/default supported. |
| Explore medium/size/movement | `artworkListQuery` has q, category, collection, price, featured | `/explore` | Controls visible but marked unavailable. |
| Artwork by slug | Public detail is UUID param | `/artwork/[id]` | IDs from API only. |
| Cart quantity | No qty field | `/cart` | Qty 1 remains. Wishlist is now a separate list. |
| ~~Separate wishlist~~ | `GET/POST/DELETE /wishlist` | `/account/wishlist` | Independent of cart. |
| Signed URLs for private media | Paths only | `/artwork/[id]`, admin edit | Private files not opened. |
| Image/media delete | POST image/media only | `/admin/artworks/[id]/edit` | No delete control. |
| Admin customer `q` | `paginationQuery` strips `q` | `/admin/customers` | Local filter of the current page only. |
| Multipart upload | Path registration only | `/admin/artworks/new` | Storage upload then path POST; failure is reported honestly. |
| Payments / shipping providers | Deferred | checkout, admin order docket | No paid/captured/dispatch CTAs. |
| Live AR field validation | WebXR + photo preview shipped | artwork detail | Device checklist still required; iOS uses photo preview. |

Required backend (ask separately if you want these wired):

1. ~~`GET /api/v1/admin/orders`~~ shipped.
2. Avatar `PATCH` still missing; name/phone shipped.
3. ~~Address PATCH/DELETE~~ shipped.
4. Explore filters: `medium`, size band, movement/category taxonomy as real query params.
5. Signed URL endpoint for private media, or a documented public policy.
6. Image/media DELETE.
7. Allow `q` on `GET /admin/customers` in the HTTP validator.
8. Optional public `GET /artworks/slug/:slug`.
