import { sendSuccess } from '../utils/ApiResponse.js';
import { createRefund, initiatePayment, processRazorpayWebhook } from '../services/payment.service.js';

export async function initiateOrderPayment(req, res) {
  const data = await initiatePayment(req.params.id, req.user.id);
  return sendSuccess(res, { data });
}

export async function razorpayWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  const data = await processRazorpayWebhook(req.rawBody || Buffer.from(JSON.stringify(req.body)), signature, req.body);
  return sendSuccess(res, { data });
}

export async function createPaymentRefund(req, res) {
  const data = await createRefund(req.params.id, req.body, req.user.id);
  return sendSuccess(res, { statusCode: 201, data });
}

export default {
  initiateOrderPayment,
  razorpayWebhook,
  createPaymentRefund,
};
