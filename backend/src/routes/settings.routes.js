import { Router } from 'express';
import {
  getAdminHomepageHeroSettingsHandler,
  getAdminWhatsappSettingsHandler,
  updateAdminHomepageHeroSettingsHandler,
  updateAdminWhatsappSettingsHandler,
} from '../controllers/settings.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { homepageHeroSettingsBody, whatsappSettingsBody } from '../validators/settings.validators.js';

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
