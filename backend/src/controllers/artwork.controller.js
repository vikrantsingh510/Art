import { sendSuccess } from '../utils/ApiResponse.js';
import {
  addArtworkImage,
  addArtworkMedia,
  archiveArtwork,
  createArtwork,
  deleteArtworkPermanently,
  getArtworkById,
  listArtworks,
  removeArtworkImage,
  reorderArtworkImages,
  updateArtwork,
  userHasPurchasedArtwork,
} from '../services/artwork.service.js';

export async function listPublicArtworks(req, res) {
  const data = await listArtworks(req.query, { publicOnly: true });
  return sendSuccess(res, { data });
}

export async function getPublicArtwork(req, res) {
  const includePrivateMedia = Boolean(req.user?.isAdmin)
    || (req.user ? await userHasPurchasedArtwork(req.user.id, req.params.id) : false);
  const data = await getArtworkById(req.params.id, {
    publicOnly: !req.user?.isAdmin,
    includePrivateMedia,
  });
  return sendSuccess(res, { data });
}

export async function listAdminArtworks(req, res) {
  const data = await listArtworks(req.query, { publicOnly: false });
  return sendSuccess(res, { data });
}

export async function createAdminArtwork(req, res) {
  const data = await createArtwork(req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function updateAdminArtwork(req, res) {
  const data = await updateArtwork(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data });
}

export async function archiveAdminArtwork(req, res) {
  const data = await archiveArtwork(req.params.id, req.user.id);
  return sendSuccess(res, { data });
}

export async function deleteAdminArtworkPermanently(req, res) {
  const data = await deleteArtworkPermanently(req.params.id, req.user.id);
  return sendSuccess(res, { data });
}

export async function addAdminArtworkImage(req, res) {
  const data = await addArtworkImage(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function removeAdminArtworkImage(req, res) {
  const data = await removeArtworkImage(req.params.id, req.params.imageId, req.user.id);
  return sendSuccess(res, { data });
}

export async function reorderAdminArtworkImages(req, res) {
  const data = await reorderArtworkImages(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data });
}

export async function addAdminArtworkMedia(req, res) {
  const data = await addArtworkMedia(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export default {
  listPublicArtworks,
  getPublicArtwork,
  listAdminArtworks,
  createAdminArtwork,
  updateAdminArtwork,
  archiveAdminArtwork,
  deleteAdminArtworkPermanently,
  addAdminArtworkImage,
  removeAdminArtworkImage,
  reorderAdminArtworkImages,
  addAdminArtworkMedia,
};
