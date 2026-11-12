import { Router } from 'express';
import { getPublicWhatsappEnquiryHandler } from '../controllers/settings.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

export const enquiryPublicRouter = Router();

enquiryPublicRouter.get('/whatsapp', asyncHandler(getPublicWhatsappEnquiryHandler));
