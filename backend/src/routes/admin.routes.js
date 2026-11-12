import { Router } from 'express';
import {
  adminCreateShipment,
  adminCustomer,
  adminCustomers,
  adminExpireReservations,
  adminMetrics,
  adminOrders,
  adminOrderShipments,
  adminArtworkImageConstraints,
  adminPing,
  adminProcessNotifications,
  adminUpdateShipment,
} from '../controllers/admin.controller.js';
import { getPreview } from '../controllers/preview.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { uuidParam } from '../validators/common.js';
import { analyticsQuery, shipmentCreateBody, shipmentUpdateBody } from '../validators/shipment.validators.js';
import { paginationQuery } from '../validators/common.js';
import { adminOrdersQuery } from '../validators/admin.validators.js';
import { artistAdminRouter } from './artist.routes.js';
import { artworkAdminRouter } from './artwork.routes.js';
import { blogAdminRouter } from './blog.routes.js';
import { categoryAdminRouter, collectionAdminRouter } from './catalog.routes.js';

const router = Router();

router.get('/ping', adminPing);
router.get('/storage/artwork-images', asyncHandler(adminArtworkImageConstraints));
router.get('/metrics', validate({ query: analyticsQuery }), asyncHandler(adminMetrics));
router.get('/customers', validate({ query: paginationQuery }), asyncHandler(adminCustomers));
router.get('/customers/:id', validate({ params: uuidParam }), asyncHandler(adminCustomer));
router.get('/orders', validate({ query: adminOrdersQuery }), asyncHandler(adminOrders));
router.get('/orders/:id/shipments', validate({ params: uuidParam }), asyncHandler(adminOrderShipments));
router.post(
  '/orders/:id/shipments',
  validate({ params: uuidParam, body: shipmentCreateBody }),
  asyncHandler(adminCreateShipment),
);
router.patch(
  '/shipments/:id',
  validate({ params: uuidParam, body: shipmentUpdateBody }),
  asyncHandler(adminUpdateShipment),
);
router.post('/notifications/process', asyncHandler(adminProcessNotifications));
router.post('/reservations/expire', asyncHandler(adminExpireReservations));
router.get('/previews/:id', validate({ params: uuidParam }), asyncHandler(getPreview));
router.use('/artists', artistAdminRouter);
router.use('/artworks', artworkAdminRouter);
router.use('/categories', categoryAdminRouter);
router.use('/collections', collectionAdminRouter);
router.use('/blogs', blogAdminRouter);

export default router;
