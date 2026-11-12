export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
export const DEFAULT_WHATSAPP_BUTTON_LABEL = 'Enquire on WhatsApp';
export const WHATSAPP_ME_HOST = 'https://wa.me';
export const BUTTON_LABEL_MAX_LENGTH = 40;

export function normalizeWhatsappE164(input) {
  if (input === null || input === undefined) {
    return null;
  }

  let raw = String(input).trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('00')) {
    raw = `+${raw.slice(2)}`;
  }

  raw = raw.replace(/[\s().-]/g, '');

  if (/^[1-9]\d{7,14}$/.test(raw)) {
    raw = `+${raw}`;
  }

  if (!E164_PATTERN.test(raw)) {
    return null;
  }

  return raw;
}

export function whatsappDigits(e164) {
  const normalized = normalizeWhatsappE164(e164);
  if (normalized) {
    return normalized.slice(1);
  }

  const digits = String(e164 || '').replace(/\D/g, '');
  if (/^[1-9]\d{7,14}$/.test(digits)) {
    return digits;
  }

  return null;
}

export function maskWhatsappE164(e164) {
  const normalized = normalizeWhatsappE164(e164);
  if (!normalized) {
    return null;
  }

  const digits = normalized.slice(1);
  const visible = Math.min(2, Math.max(0, digits.length - 4));
  const hidden = Math.max(0, digits.length - visible - 4);
  return `+${digits.slice(0, visible)}${'•'.repeat(hidden)}${digits.slice(-4)}`;
}

export function normalizeWhatsappButtonLabel(input) {
  if (input === null || input === undefined) {
    return null;
  }

  const trimmed = String(input).trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > BUTTON_LABEL_MAX_LENGTH) {
    return null;
  }

  if (/[<>]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function resolveWhatsappButtonLabel(input) {
  return normalizeWhatsappButtonLabel(input) || DEFAULT_WHATSAPP_BUTTON_LABEL;
}

export function toPublicWhatsappSnapshot(value) {
  const enabled = Boolean(value?.enabled);
  const digits = whatsappDigits(value?.e164);
  if (!enabled || !digits) {
    return { enabled: false };
  }

  return {
    enabled: true,
    e164: digits,
    buttonLabel: resolveWhatsappButtonLabel(value?.buttonLabel),
    waMeHost: WHATSAPP_ME_HOST,
  };
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

export default {
  E164_PATTERN,
  DEFAULT_WHATSAPP_BUTTON_LABEL,
  WHATSAPP_ME_HOST,
  normalizeWhatsappE164,
  whatsappDigits,
  maskWhatsappE164,
  normalizeWhatsappButtonLabel,
  resolveWhatsappButtonLabel,
  toPublicWhatsappSnapshot,
  buildWhatsappEnquiryMessage,
  buildWhatsappEnquiryHref,
};
