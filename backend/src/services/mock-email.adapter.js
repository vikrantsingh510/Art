import { logger } from '../config/logger.js';

function recipientDomain(to) {
  if (typeof to !== 'string' || !to.includes('@')) {
    return 'unknown';
  }

  return to.slice(to.lastIndexOf('@') + 1).toLowerCase();
}

export function createMockEmailAdapter(options = {}) {
  const deliveries = [];
  let failRemaining = Number(options.failTimes || 0);

  async function sendMockEmail({ to, subject, text, eventType }) {
    if (failRemaining > 0) {
      failRemaining -= 1;
      const error = new Error('Simulated email delivery failure');
      error.code = 'MOCK_EMAIL_FAILURE';
      throw error;
    }

    const result = {
      provider: 'mock',
      messageId: `mock-${deliveries.length + 1}`,
      eventType: eventType || null,
      recipientDomain: recipientDomain(to),
      subjectLength: String(subject || '').length,
      textLength: String(text || '').length,
    };

    deliveries.push(result);
    logger.info({
      provider: 'mock',
      eventType: result.eventType,
      recipientDomain: result.recipientDomain,
      subjectLength: result.subjectLength,
    }, 'Mock email sent');

    return result;
  }

  sendMockEmail.deliveries = deliveries;
  sendMockEmail.failNext = (times = 1) => {
    failRemaining = times;
  };
  sendMockEmail.reset = () => {
    deliveries.length = 0;
    failRemaining = 0;
  };

  return sendMockEmail;
}

export const sendMockEmail = createMockEmailAdapter();

export default {
  createMockEmailAdapter,
  sendMockEmail,
};
