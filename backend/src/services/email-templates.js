const FALLBACK_SUBJECT = "Maison d'Art notification";

function greeting(payload = {}) {
  const name = String(payload.fullName || '').trim();
  return name ? `Hello ${name},` : 'Hello,';
}

export const EMAIL_TEMPLATES = {
  'customer.welcome': {
    subject: "Welcome to Maison d'Art",
    text(payload) {
      return [
        greeting(payload),
        '',
        'Your customer account is ready. You can browse the gallery and save artworks to your collection.',
        '',
        "Maison d'Art",
      ].join('\n');
    },
  },
  'order.pending_payment': {
    subject: 'Your artwork reservation is being held',
    text(payload) {
      const orderNumber = payload.orderNumber || 'your order';
      return [
        greeting(payload),
        '',
        `We have received ${orderNumber} and are holding the selected artwork while checkout is completed.`,
        'This message does not confirm a completed purchase.',
        '',
        "Maison d'Art",
      ].join('\n');
    },
  },
  'order.confirmed': {
    subject: 'Your order is confirmed',
    text(payload) {
      const orderNumber = payload.orderNumber || 'your order';
      return [
        greeting(payload),
        '',
        `Order ${orderNumber} is confirmed and will be prepared for fulfilment.`,
        '',
        "Maison d'Art",
      ].join('\n');
    },
  },
  'order.status_update': {
    subject: 'An update on your order',
    text(payload) {
      const orderNumber = payload.orderNumber || 'your order';
      const status = payload.status || 'updated';
      return [
        greeting(payload),
        '',
        `There is an update on ${orderNumber}. Current status: ${status}.`,
        '',
        "Maison d'Art",
      ].join('\n');
    },
  },
  'shipment.shipped': {
    subject: 'Your order has been marked as shipped',
    text(payload) {
      const orderNumber = payload.orderNumber || 'your order';
      const tracking = payload.trackingNumber
        ? ` Tracking reference: ${payload.trackingNumber}.`
        : '';
      return [
        greeting(payload),
        '',
        `Order ${orderNumber} has been marked as shipped.${tracking}`,
        '',
        "Maison d'Art",
      ].join('\n');
    },
  },
  'shipment.delivered': {
    subject: 'Your order has been marked as delivered',
    text(payload) {
      const orderNumber = payload.orderNumber || 'your order';
      return [
        greeting(payload),
        '',
        `Order ${orderNumber} has been marked as delivered.`,
        '',
        "Maison d'Art",
      ].join('\n');
    },
  },
};

export function renderNotification(eventType, payload = {}) {
  const template = EMAIL_TEMPLATES[eventType];
  if (!template) {
    return {
      subject: FALLBACK_SUBJECT,
      text: [
        greeting(payload),
        '',
        'There is an update related to your Maison d\'Art account or order.',
        '',
        "Maison d'Art",
      ].join('\n'),
    };
  }

  return {
    subject: template.subject,
    text: template.text(payload),
  };
}

export default {
  EMAIL_TEMPLATES,
  renderNotification,
};
