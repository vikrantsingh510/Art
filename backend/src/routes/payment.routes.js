import { Router } from 'express';
import { createPaymentRefund, initiateOrderPayment, razorpayWebhook } from '../controllers/payment.controller.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { uuidParam } from '../validators/common.js';
import { refundCreateBody } from '../validators/shipment.validators.js';

export const paymentRouter = Router();
export const webhookRouter = Router();

paymentRouter.post(
  '/orders/:id/initiate',
  requireAuth,
  validate({ params: uuidParam }),
  asyncHandler(initiateOrderPayment),
);
paymentRouter.post(
  '/:id/refunds',
  requireAuth,
  requireAdmin,
  validate({ params: uuidParam, body: refundCreateBody }),
  asyncHandler(createPaymentRefund),
);

webhookRouter.post('/razorpay', asyncHandler(razorpayWebhook));
