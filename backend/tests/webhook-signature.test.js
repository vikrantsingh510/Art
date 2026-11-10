import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyRazorpayWebhookSignature } from '../src/services/payment.service.js';

test('valid Razorpay signatures are accepted', () => {
  const body = '{"event":"payment.captured"}';
  const secret = 'whsec_test';
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyRazorpayWebhookSignature(body, signature, secret), true);
});

test('invalid Razorpay signatures are rejected', () => {
  assert.equal(
    verifyRazorpayWebhookSignature('{"event":"payment.captured"}', 'deadbeef', 'whsec_test'),
    false,
  );
});

test('missing signatures are rejected', () => {
  assert.equal(verifyRazorpayWebhookSignature('{}', '', 'secret'), false);
  assert.equal(verifyRazorpayWebhookSignature('{}', 'abc', ''), false);
});
