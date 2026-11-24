import { sendSuccess } from '../utils/ApiResponse.js';
import {
  getAdminHomepageFeaturedArtistSettings,
  getAdminHomepageHeroSettings,
  getAdminWhatsappSettings,
  getPublicHomepageFeaturedArtist,
  getPublicHomepageHero,
  getPublicWhatsappEnquiry,
  updateAdminHomepageFeaturedArtistSettings,
  updateAdminHomepageHeroSettings,
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

export async function getPublicHomepageHeroHandler(_req, res) {
  const data = await getPublicHomepageHero();
  return sendSuccess(res, { data });
}

export async function getAdminHomepageHeroSettingsHandler(_req, res) {
  const data = await getAdminHomepageHeroSettings();
  return sendSuccess(res, { data });
}

export async function updateAdminHomepageHeroSettingsHandler(req, res) {
  const data = await updateAdminHomepageHeroSettings(req.body, req.user.id, {
    ipAddress: req.ip,
  });
  return sendSuccess(res, { data });
}

export async function getPublicHomepageFeaturedArtistHandler(_req, res) {
  const data = await getPublicHomepageFeaturedArtist();
  return sendSuccess(res, { data });
}

export async function getAdminHomepageFeaturedArtistSettingsHandler(_req, res) {
  const data = await getAdminHomepageFeaturedArtistSettings();
  return sendSuccess(res, { data });
}

export async function updateAdminHomepageFeaturedArtistSettingsHandler(req, res) {
  const data = await updateAdminHomepageFeaturedArtistSettings(req.body, req.user.id, {
    ipAddress: req.ip,
  });
  return sendSuccess(res, { data });
}

export default {
  getPublicWhatsappEnquiryHandler,
  getAdminWhatsappSettingsHandler,
  updateAdminWhatsappSettingsHandler,
  getPublicHomepageHeroHandler,
  getAdminHomepageHeroSettingsHandler,
  updateAdminHomepageHeroSettingsHandler,
  getPublicHomepageFeaturedArtistHandler,
  getAdminHomepageFeaturedArtistSettingsHandler,
  updateAdminHomepageFeaturedArtistSettingsHandler,
};
