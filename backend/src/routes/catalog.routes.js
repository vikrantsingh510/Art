import { Router } from 'express';
import {
  addAdminCollectionArtwork,
  createAdminCategory,
  createAdminCollection,
  getAdminCollection,
  getPublicCollection,
  listAdminCategories,
  listAdminCollections,
  listPublicCategories,
  listPublicCollections,
  replaceAdminCollectionArtworks,
  updateAdminCategory,
  updateAdminCollection,
} from '../controllers/catalog.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  categoryBody,
  collectionArtworkBody,
  collectionArtworksBody,
  collectionBody,
  collectionUpdateBody,
} from '../validators/catalog.validators.js';
import { uuidParam } from '../validators/common.js';

export const categoryPublicRouter = Router();
export const collectionPublicRouter = Router();
export const categoryAdminRouter = Router();
export const collectionAdminRouter = Router();

categoryPublicRouter.get('/', asyncHandler(listPublicCategories));
collectionPublicRouter.get('/', asyncHandler(listPublicCollections));
collectionPublicRouter.get('/:id', validate({ params: uuidParam }), asyncHandler(getPublicCollection));

categoryAdminRouter.get('/', asyncHandler(listAdminCategories));
categoryAdminRouter.post('/', validate({ body: categoryBody }), asyncHandler(createAdminCategory));
categoryAdminRouter.patch('/:id', validate({ params: uuidParam, body: categoryBody.partial() }), asyncHandler(updateAdminCategory));

collectionAdminRouter.get('/', asyncHandler(listAdminCollections));
collectionAdminRouter.post('/', validate({ body: collectionBody }), asyncHandler(createAdminCollection));
collectionAdminRouter.get('/:id', validate({ params: uuidParam }), asyncHandler(getAdminCollection));
collectionAdminRouter.patch('/:id', validate({ params: uuidParam, body: collectionUpdateBody }), asyncHandler(updateAdminCollection));
collectionAdminRouter.put(
  '/:id/artworks',
  validate({ params: uuidParam, body: collectionArtworksBody }),
  asyncHandler(replaceAdminCollectionArtworks),
);
collectionAdminRouter.post(
  '/:id/artworks',
  validate({ params: uuidParam, body: collectionArtworkBody }),
  asyncHandler(addAdminCollectionArtwork),
);
