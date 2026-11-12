import { sendSuccess } from '../utils/ApiResponse.js';
import {
  getAdminWhatsappSettings,
  getPublicWhatsappEnquiry,
  updateAdminWhatsappSettings,
} from '../services/settings.service.js';

export async function getPublicWhatsappEnquiryHandler(_req, res) {
  const data = await getPublicWhatsappEnquiry();
  return sendSuccess(res, { data });
}

export async function getAdminWhatsappSettingsHandler(_req, res) {
  const data = await getAdminWhatsappSettings();
  return sendSuccess(res, { data });
}

export async function updateAdminWhatsappSettingsHandler(req, res) {
  const data = await updateAdminWhatsappSettings(req.body, req.user.id, {
    ipAddress: req.ip,
  });
  return sendSuccess(res, { data });
}

export default {
  getPublicWhatsappEnquiryHandler,
  getAdminWhatsappSettingsHandler,
  updateAdminWhatsappSettingsHandler,
};
