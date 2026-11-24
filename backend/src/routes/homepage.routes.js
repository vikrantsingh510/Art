import { Router } from 'express';
import {
  getPublicHomepageFeaturedArtistHandler,
  getPublicHomepageHeroHandler,
} from '../controllers/settings.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

export const homepagePublicRouter = Router();

homepagePublicRouter.get('/hero', asyncHandler(getPublicHomepageHeroHandler));
homepagePublicRouter.get('/featured-artist', asyncHandler(getPublicHomepageFeaturedArtistHandler));
