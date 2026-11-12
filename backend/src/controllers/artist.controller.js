import { sendSuccess } from '../utils/ApiResponse.js';
import {
  createArtist,
  deleteArtist,
  getAdminArtistById,
  getPublicArtistBySlug,
  listAdminArtists,
  listPublicArtists,
  updateArtist,
} from '../services/artist.service.js';

export async function listPublicArtistsHandler(req, res) {
  const data = await listPublicArtists(req.query);
  return sendSuccess(res, { data });
}

export async function getPublicArtistHandler(req, res) {
  const data = await getPublicArtistBySlug(req.params.slug);
  return sendSuccess(res, { data });
}

export async function listAdminArtistsHandler(req, res) {
  const data = await listAdminArtists(req.query);
  return sendSuccess(res, { data });
}

export async function getAdminArtistHandler(req, res) {
  const data = await getAdminArtistById(req.params.id);
  return sendSuccess(res, { data });
}

export async function createAdminArtistHandler(req, res) {
  const data = await createArtist(req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function updateAdminArtistHandler(req, res) {
  const data = await updateArtist(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data });
}

export async function deleteAdminArtistHandler(req, res) {
  const data = await deleteArtist(req.params.id, req.user.id);
  return sendSuccess(res, { data });
}

export default {
  listPublicArtistsHandler,
  getPublicArtistHandler,
  listAdminArtistsHandler,
  getAdminArtistHandler,
  createAdminArtistHandler,
  updateAdminArtistHandler,
  deleteAdminArtistHandler,
};
