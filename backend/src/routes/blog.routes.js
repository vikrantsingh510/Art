import { Router } from 'express';
import {
  createAdminBlogHandler,
  deleteAdminBlogHandler,
  getAdminBlogHandler,
  getPublicBlogHandler,
  listAdminBlogsHandler,
  listPublicBlogsHandler,
  replaceAdminBlogArtworksHandler,
  updateAdminBlogHandler,
} from '../controllers/blog.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  blogArtworksBody,
  blogCreateBody,
  blogListQuery,
  blogSlugParam,
  blogUpdateBody,
} from '../validators/blog.validators.js';
import { paginationQuery, uuidParam } from '../validators/common.js';

export const blogPublicRouter = Router();
export const blogAdminRouter = Router();

blogPublicRouter.get('/', validate({ query: paginationQuery }), asyncHandler(listPublicBlogsHandler));
blogPublicRouter.get('/:slug', validate({ params: blogSlugParam }), asyncHandler(getPublicBlogHandler));

blogAdminRouter.get('/', validate({ query: blogListQuery }), asyncHandler(listAdminBlogsHandler));
blogAdminRouter.post('/', validate({ body: blogCreateBody }), asyncHandler(createAdminBlogHandler));
blogAdminRouter.get('/:id', validate({ params: uuidParam }), asyncHandler(getAdminBlogHandler));
blogAdminRouter.patch('/:id', validate({ params: uuidParam, body: blogUpdateBody }), asyncHandler(updateAdminBlogHandler));
blogAdminRouter.delete('/:id', validate({ params: uuidParam }), asyncHandler(deleteAdminBlogHandler));
blogAdminRouter.put(
  '/:id/artworks',
  validate({ params: uuidParam, body: blogArtworksBody }),
  asyncHandler(replaceAdminBlogArtworksHandler),
);
