import { sendSuccess } from '../utils/ApiResponse.js';
import { createArtworkPreview, getPreviewById, listArtworkPreviews } from '../services/preview.service.js';

export async function listPreviews(req, res) {
  const data = await listArtworkPreviews(req.params.artworkId, {
    userId: req.user.id,
    isAdmin: req.user.isAdmin,
  });
  return sendSuccess(res, { data });
}

export async function createPreview(req, res) {
  const data = await createArtworkPreview(req.params.artworkId, req.user.id, req.body);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function getPreview(req, res) {
  const data = await getPreviewById(req.params.id, {
    userId: req.user.id,
    isAdmin: req.user.isAdmin,
  });
  return sendSuccess(res, { data });
}

export default {
  listPreviews,
  createPreview,
  getPreview,
};
