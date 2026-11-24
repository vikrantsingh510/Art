import { Router } from 'express';
import { getPublicHomepageHeroHandler } from '../controllers/settings.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

export const homepagePublicRouter = Router();

homepagePublicRouter.get('/hero', asyncHandler(getPublicHomepageHeroHandler));
