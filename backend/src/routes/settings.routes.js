import { Router } from 'express';
import {
  getAdminHomepageFeaturedArtistSettingsHandler,
  getAdminHomepageHeroSettingsHandler,
  getAdminWhatsappSettingsHandler,
  updateAdminHomepageFeaturedArtistSettingsHandler,
  updateAdminHomepageHeroSettingsHandler,
  updateAdminWhatsappSettingsHandler,
} from '../controllers/settings.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  homepageFeaturedArtistSettingsBody,
  homepageHeroSettingsBody,
  whatsappSettingsBody,
} from '../validators/settings.validators.js';

export const settingsAdminRouter = Router();

settingsAdminRouter.get('/whatsapp', asyncHandler(getAdminWhatsappSettingsHandler));
settingsAdminRouter.put(
  '/whatsapp',
  validate({ body: whatsappSettingsBody }),
  asyncHandler(updateAdminWhatsappSettingsHandler),
);
settingsAdminRouter.get('/homepage-hero', asyncHandler(getAdminHomepageHeroSettingsHandler));
settingsAdminRouter.put(
  '/homepage-hero',
  validate({ body: homepageHeroSettingsBody }),
  asyncHandler(updateAdminHomepageHeroSettingsHandler),
);
settingsAdminRouter.get(
  '/homepage-featured-artist',
  asyncHandler(getAdminHomepageFeaturedArtistSettingsHandler),
);
settingsAdminRouter.put(
  '/homepage-featured-artist',
  validate({ body: homepageFeaturedArtistSettingsBody }),
  asyncHandler(updateAdminHomepageFeaturedArtistSettingsHandler),
);
