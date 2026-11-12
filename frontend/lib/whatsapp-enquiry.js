export const DEFAULT_WHATSAPP_BUTTON_LABEL = 'Enquire on WhatsApp';
export const WHATSAPP_ME_HOST = 'https://wa.me';

export function whatsappDigits(e164) {
  const raw = String(e164 || '').trim();
  if (!raw) {
    return null;
  }

  let value = raw.startsWith('00') ? `+${raw.slice(2)}` : raw;
  value = value.replace(/[\s().-]/g, '');
  if (/^[1-9]\d{7,14}$/.test(value)) {
    value = `+${value}`;
  }

  if (/^\+[1-9]\d{7,14}$/.test(value)) {
    return value.slice(1);
  }

  const digits = raw.replace(/\D/g, '');
  if (/^[1-9]\d{7,14}$/.test(digits)) {
    return digits;
  }

  return null;
}

export function buildWhatsappEnquiryMessage({ title, id, url } = {}) {
  const safeTitle = String(title || '').trim() || 'Untitled';
  const safeId = String(id || '').trim();
  const safeUrl = String(url || '').trim();

  return [
    "Hello Maison d'Art,",
    '',
    'I would like to enquire about this artwork.',
    '',
    `Title: ${safeTitle}`,
    `Reference: ${safeId}`,
    `Page: ${safeUrl}`,
    '',
    'Please share availability and how I may view or acquire this work.',
  ].join('\n');
}

export function buildWhatsappEnquiryHref({ e164, title, id, url } = {}) {
  const digits = whatsappDigits(e164);
  if (!digits) {
    return null;
  }

  const text = buildWhatsappEnquiryMessage({ title, id, url });
  return `${WHATSAPP_ME_HOST}/${digits}?text=${encodeURIComponent(text)}`;
}
