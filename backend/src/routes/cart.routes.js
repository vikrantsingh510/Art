import { Router } from 'express';
import {
  addToCart,
  addToWishlist,
  checkout,
  createCurrentAddress,
  deleteCurrentAddress,
  getCurrentCart,
  getCurrentOrder,
  getCurrentWishlist,
  listCurrentAddresses,
  listCurrentOrders,
  moveWishlistToCart,
  removeFromCart,
  removeFromWishlist,
  updateCurrentAddress,
} from '../controllers/cart.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  addressBody,
  addressPatchBody,
  cartItemBody,
  checkoutBody,
  wishlistItemBody,
} from '../validators/cart.validators.js';
import { artworkIdParam, uuidParam } from '../validators/common.js';

export const cartRouter = Router();
export const addressRouter = Router();
export const checkoutRouter = Router();
export const orderRouter = Router();
export const wishlistRouter = Router();

cartRouter.get('/', asyncHandler(getCurrentCart));
cartRouter.post('/items', validate({ body: cartItemBody }), asyncHandler(addToCart));
cartRouter.delete('/items/:artworkId', validate({ params: artworkIdParam }), asyncHandler(removeFromCart));

addressRouter.get('/', asyncHandler(listCurrentAddresses));
addressRouter.post('/', validate({ body: addressBody }), asyncHandler(createCurrentAddress));
addressRouter.patch('/:id', validate({ params: uuidParam, body: addressPatchBody }), asyncHandler(updateCurrentAddress));
addressRouter.delete('/:id', validate({ params: uuidParam }), asyncHandler(deleteCurrentAddress));

wishlistRouter.get('/', asyncHandler(getCurrentWishlist));
wishlistRouter.post('/items', validate({ body: wishlistItemBody }), asyncHandler(addToWishlist));
wishlistRouter.delete('/items/:artworkId', validate({ params: artworkIdParam }), asyncHandler(removeFromWishlist));
wishlistRouter.post(
  '/items/:artworkId/move-to-cart',
  validate({ params: artworkIdParam }),
  asyncHandler(moveWishlistToCart),
);

checkoutRouter.post('/', validate({ body: checkoutBody }), asyncHandler(checkout));

orderRouter.get('/', asyncHandler(listCurrentOrders));
orderRouter.get('/:id', validate({ params: uuidParam }), asyncHandler(getCurrentOrder));
