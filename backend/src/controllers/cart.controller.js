import { sendSuccess } from '../utils/ApiResponse.js';
import { addCartItem, getCart, removeCartItem } from '../services/cart.service.js';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from '../services/address.service.js';
import { createCheckoutOrder, getOrderForUser, listOrdersForUser } from '../services/checkout.service.js';
import {
  addWishlistItem,
  getWishlist,
  moveWishlistItemToCart,
  removeWishlistItem,
} from '../services/wishlist.service.js';

export async function getCurrentCart(req, res) {
  const data = await getCart(req.user.id);
  return sendSuccess(res, { data });
}

export async function addToCart(req, res) {
  const data = await addCartItem(req.user.id, req.body.artworkId);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function removeFromCart(req, res) {
  const data = await removeCartItem(req.user.id, req.params.artworkId);
  return sendSuccess(res, { data });
}

export async function listCurrentAddresses(req, res) {
  const data = await listAddresses(req.user.id);
  return sendSuccess(res, { data });
}

export async function createCurrentAddress(req, res) {
  const data = await createAddress(req.user.id, req.body);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function updateCurrentAddress(req, res) {
  const data = await updateAddress(req.user.id, req.params.id, req.body);
  return sendSuccess(res, { data });
}

export async function deleteCurrentAddress(req, res) {
  const data = await deleteAddress(req.user.id, req.params.id);
  return sendSuccess(res, { data });
}

export async function getCurrentWishlist(req, res) {
  const data = await getWishlist(req.user.id);
  return sendSuccess(res, { data });
}

export async function addToWishlist(req, res) {
  const data = await addWishlistItem(req.user.id, req.body.artworkId);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function removeFromWishlist(req, res) {
  const data = await removeWishlistItem(req.user.id, req.params.artworkId);
  return sendSuccess(res, { data });
}

export async function moveWishlistToCart(req, res) {
  const data = await moveWishlistItemToCart(req.user.id, req.params.artworkId);
  return sendSuccess(res, { data });
}

export async function checkout(req, res) {
  const data = await createCheckoutOrder(req.user.id, req.body, { email: req.user.email });
  return sendSuccess(res, { statusCode: 201, data });
}

export async function listCurrentOrders(req, res) {
  const data = await listOrdersForUser(req.user.id);
  return sendSuccess(res, { data });
}

export async function getCurrentOrder(req, res) {
  const data = await getOrderForUser(req.params.id, req.user.id, { isAdmin: req.user.isAdmin });
  return sendSuccess(res, { data });
}

export default {
  getCurrentCart,
  addToCart,
  removeFromCart,
  listCurrentAddresses,
  createCurrentAddress,
  updateCurrentAddress,
  deleteCurrentAddress,
  getCurrentWishlist,
  addToWishlist,
  removeFromWishlist,
  moveWishlistToCart,
  checkout,
  listCurrentOrders,
  getCurrentOrder,
};
