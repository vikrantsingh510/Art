# Remaining gaps after feature expansion

## Not in this scope (still deferred)

- Razorpay initiation, capture, refunds, webhooks
- Courier booking, dispatch CTAs, live tracking operations
- Real email provider (outbox still uses the mock adapter)
- Profile avatar upload / `avatarPath` editing
- Signed URLs for private certificates
- Artwork image/media delete
- Explore filters for medium / size / movement
- Public artwork-by-slug
- Quantity on cart lines
- Production deployment

## AR device matrix

| Surface | Live WebXR AR | Photo preview |
|---|---|---|
| Android Chrome (HTTPS or localhost) | Attempted when `immersive-ar` + hit-test are reported | Always available |
| iOS Safari | Not claimed. WebXR AR is not available | Default path |
| Desktop Chrome without WebXR AR | Fallback | Default path |
| Insecure `http://` non-localhost | Blocked | Available |

Automated tests cover capability detection, dimension conversion and camera-track cleanup. **Live AR on a physical Android device was not executed in this session.** Do not treat the WebXR path as field-validated until a device checklist pass.

### Manual device checklist

1. Android Chrome, HTTPS or localhost, artwork with width/height/unit: start live AR, grant camera, tap a wall, confirm a 2D canvas appears, Exit stops the camera.
2. Deny camera: denied message + photo preview.
3. iPhone Safari: photo preview labelled “not live AR”; no false live-AR claim.
4. Missing dimensions: live AR disabled; explanation shown.
5. Photo preview: choose image, drag, scale, perspective, reset; no network upload of the photo.

## Migration notes

- `0006_feature_expansion.sql` **moves** current `wishlist_items` into `cart_items` then deletes wishlist rows. Wishlist is empty after migrate.
- Duplicate profile phones (if any) are nulled except the earliest row so the unique index can apply.
- Invalid dimension units/values are normalized or nulled before CHECKs.

## Admin search

`GET /admin/orders?q=` is a verified HTTP param. `GET /admin/customers?q=` is still stripped by `paginationQuery` and was not changed in this scope.
