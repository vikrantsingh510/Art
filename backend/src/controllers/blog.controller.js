import { sendSuccess } from '../utils/ApiResponse.js';
import {
  createBlog,
  deleteBlog,
  getAdminBlogById,
  getPublicBlogBySlug,
  listAdminBlogs,
  listPublicBlogs,
  replaceBlogArtworks,
  updateBlog,
} from '../services/blog.service.js';

export async function listPublicBlogsHandler(req, res) {
  const data = await listPublicBlogs(req.query);
  return sendSuccess(res, { data });
}

export async function getPublicBlogHandler(req, res) {
  const data = await getPublicBlogBySlug(req.params.slug);
  return sendSuccess(res, { data });
}

export async function listAdminBlogsHandler(req, res) {
  const data = await listAdminBlogs(req.query);
  return sendSuccess(res, { data });
}

export async function getAdminBlogHandler(req, res) {
  const data = await getAdminBlogById(req.params.id);
  return sendSuccess(res, { data });
}

export async function createAdminBlogHandler(req, res) {
  const data = await createBlog(req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function updateAdminBlogHandler(req, res) {
  const data = await updateBlog(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data });
}

export async function deleteAdminBlogHandler(req, res) {
  const data = await deleteBlog(req.params.id, req.user.id);
  return sendSuccess(res, { data });
}

export async function replaceAdminBlogArtworksHandler(req, res) {
  const data = await replaceBlogArtworks(req.params.id, req.body.artworkIds, req.user.id);
  return sendSuccess(res, { data });
}

export default {
  listPublicBlogsHandler,
  getPublicBlogHandler,
  listAdminBlogsHandler,
  getAdminBlogHandler,
  createAdminBlogHandler,
  updateAdminBlogHandler,
  deleteAdminBlogHandler,
  replaceAdminBlogArtworksHandler,
};
