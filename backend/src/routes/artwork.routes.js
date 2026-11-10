import { Router } from 'express';
import {
  addAdminArtworkImage,
  addAdminArtworkMedia,
  archiveAdminArtwork,
  createAdminArtwork,
  getPublicArtwork,
  listAdminArtworks,
  listPublicArtworks,
  updateAdminArtwork,
} from '../controllers/artwork.controller.js';
import { createPreview, listPreviews } from '../controllers/preview.controller.js';
import { optionalAuth, requireAdmin, requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  artworkCreateBody,
  artworkImageBody,
  artworkListQuery,
  artworkMediaBody,
  artworkUpdateBody,
} from '../validators/artwork.validators.js';
import { artworkIdParam, uuidParam } from '../validators/common.js';
import { previewCreateBody } from '../validators/preview.validators.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/', validate({ query: artworkListQuery }), asyncHandler(listPublicArtworks));
publicRouter.get('/:id', optionalAuth, validate({ params: uuidParam }), asyncHandler(getPublicArtwork));
publicRouter.get(
  '/:artworkId/previews',
  requireAuth,
  validate({ params: artworkIdParam }),
  asyncHandler(listPreviews),
);
publicRouter.post(
  '/:artworkId/previews',
  requireAuth,
  validate({ params: artworkIdParam, body: previewCreateBody }),
  asyncHandler(createPreview),
);

adminRouter.get('/', validate({ query: artworkListQuery }), asyncHandler(listAdminArtworks));
adminRouter.post('/', validate({ body: artworkCreateBody }), asyncHandler(createAdminArtwork));
adminRouter.patch('/:id', validate({ params: uuidParam, body: artworkUpdateBody }), asyncHandler(updateAdminArtwork));
adminRouter.delete('/:id', validate({ params: uuidParam }), asyncHandler(archiveAdminArtwork));
adminRouter.post(
  '/:id/images',
  validate({ params: uuidParam, body: artworkImageBody }),
  asyncHandler(addAdminArtworkImage),
);
adminRouter.post(
  '/:id/media',
  validate({ params: uuidParam, body: artworkMediaBody }),
  asyncHandler(addAdminArtworkMedia),
);

export { publicRouter as artworkPublicRouter, adminRouter as artworkAdminRouter };
export default publicRouter;
