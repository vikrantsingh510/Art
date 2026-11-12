import { Router } from 'express';
import {
  getAdminWhatsappSettingsHandler,
  updateAdminWhatsappSettingsHandler,
} from '../controllers/settings.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { whatsappSettingsBody } from '../validators/settings.validators.js';

export const settingsAdminRouter = Router();

settingsAdminRouter.get('/whatsapp', asyncHandler(getAdminWhatsappSettingsHandler));
settingsAdminRouter.put(
  '/whatsapp',
  validate({ body: whatsappSettingsBody }),
  asyncHandler(updateAdminWhatsappSettingsHandler),
);
