import { sendSuccess } from '../utils/ApiResponse.js';
import {
  addArtworkToCollection,
  createCategory,
  createCollection,
  getCollectionById,
  listCategories,
  listCollections,
  updateCategory,
  updateCollection,
} from '../services/catalog.service.js';

export async function listPublicCategories(_req, res) {
  const data = await listCategories({ activeOnly: true });
  return sendSuccess(res, { data });
}

export async function listPublicCollections(_req, res) {
  const data = await listCollections({ publishedOnly: true });
  return sendSuccess(res, { data });
}

export async function getPublicCollection(req, res) {
  const data = await getCollectionById(req.params.id, { publishedOnly: true });
  return sendSuccess(res, { data });
}

export async function listAdminCategories(_req, res) {
  const data = await listCategories({ activeOnly: false });
  return sendSuccess(res, { data });
}

export async function createAdminCategory(req, res) {
  const data = await createCategory(req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function updateAdminCategory(req, res) {
  const data = await updateCategory(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data });
}

export async function listAdminCollections(_req, res) {
  const data = await listCollections({ publishedOnly: false });
  return sendSuccess(res, { data });
}

export async function createAdminCollection(req, res) {
  const data = await createCollection(req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function updateAdminCollection(req, res) {
  const data = await updateCollection(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data });
}

export async function addAdminCollectionArtwork(req, res) {
  const data = await addArtworkToCollection(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export default {
  listPublicCategories,
  listPublicCollections,
  getPublicCollection,
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  listAdminCollections,
  createAdminCollection,
  updateAdminCollection,
  addAdminCollectionArtwork,
};
