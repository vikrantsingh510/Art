import { Router } from 'express';
import {
  createAdminArtistHandler,
  deleteAdminArtistHandler,
  getAdminArtistHandler,
  getPublicArtistHandler,
  listAdminArtistsHandler,
  listPublicArtistsHandler,
  updateAdminArtistHandler,
} from '../controllers/artist.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  artistCreateBody,
  artistListQuery,
  artistSlugParam,
  artistUpdateBody,
} from '../validators/artist.validators.js';
import { paginationQuery, uuidParam } from '../validators/common.js';

export const artistPublicRouter = Router();
export const artistAdminRouter = Router();

artistPublicRouter.get('/', validate({ query: paginationQuery }), asyncHandler(listPublicArtistsHandler));
artistPublicRouter.get('/:slug', validate({ params: artistSlugParam }), asyncHandler(getPublicArtistHandler));

artistAdminRouter.get('/', validate({ query: artistListQuery }), asyncHandler(listAdminArtistsHandler));
artistAdminRouter.post('/', validate({ body: artistCreateBody }), asyncHandler(createAdminArtistHandler));
artistAdminRouter.get('/:id', validate({ params: uuidParam }), asyncHandler(getAdminArtistHandler));
artistAdminRouter.patch('/:id', validate({ params: uuidParam, body: artistUpdateBody }), asyncHandler(updateAdminArtistHandler));
artistAdminRouter.delete('/:id', validate({ params: uuidParam }), asyncHandler(deleteAdminArtistHandler));
