import { sendSuccess } from '../utils/ApiResponse.js';
import { getDashboardMetrics } from '../services/analytics.service.js';
import { listAdminOrders } from '../services/admin-orders.service.js';
import { getCustomer, listCustomers } from '../services/customer.service.js';
import { createShipment, listShipments, updateShipment } from '../services/shipment.service.js';
import { processNotificationOutbox } from '../services/notification.service.js';
import { expireStaleReservations } from '../services/inventory.service.js';
import { getArtworkImagesUploadConstraints } from '../services/storage-constraints.service.js';

export function adminPing(req, res) {
  return sendSuccess(res, {
    data: {
      ok: true,
      userId: req.user.id,
    },
  });
}

export async function adminArtworkImageConstraints(_req, res) {
  const data = await getArtworkImagesUploadConstraints();
  return sendSuccess(res, { data });
}

export async function adminMetrics(req, res) {
  const data = await getDashboardMetrics(req.query);
  return sendSuccess(res, { data });
}

export async function adminCustomers(req, res) {
  const data = await listCustomers(req.query);
  return sendSuccess(res, { data });
}

export async function adminCustomer(req, res) {
  const data = await getCustomer(req.params.id);
  return sendSuccess(res, { data });
}

export async function adminOrders(req, res) {
  const data = await listAdminOrders(req.query);
  return sendSuccess(res, { data });
}

export async function adminOrderShipments(req, res) {
  const data = await listShipments(req.params.id);
  return sendSuccess(res, { data });
}

export async function adminCreateShipment(req, res) {
  const data = await createShipment(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export async function adminUpdateShipment(req, res) {
  const data = await updateShipment(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { data });
}

export async function adminProcessNotifications(_req, res) {
  const data = await processNotificationOutbox();
  return sendSuccess(res, { data });
}

export async function adminExpireReservations(_req, res) {
  const data = await expireStaleReservations();
  return sendSuccess(res, { data });
}

export default {
  adminPing,
  adminArtworkImageConstraints,
  adminMetrics,
  adminCustomers,
  adminCustomer,
  adminOrders,
  adminOrderShipments,
  adminCreateShipment,
  adminUpdateShipment,
  adminProcessNotifications,
  adminExpireReservations,
};
