import { randomUUID } from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';

export const HOMEPAGE_FAQ_HEADING_MAX_LENGTH = 120;
export const HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH = 400;
export const HOMEPAGE_FAQ_QUESTION_MAX_LENGTH = 200;
export const HOMEPAGE_FAQ_ANSWER_MAX_LENGTH = 4000;
export const HOMEPAGE_FAQ_MAX_ITEMS = 40;
export const HOMEPAGE_FAQ_LIMIT_MIN = 1;
export const HOMEPAGE_FAQ_LIMIT_MAX = 40;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function emptyHomepageFaqDocument() {
  return {
    enabled: false,
    heading: null,
    subtitle: null,
    homepageLimit: null,
    items: [],
  };
}

export function emptyPublicHomepageFaq() {
  return {
    enabled: false,
    heading: null,
    subtitle: null,
    items: [],
  };
}

function containsHtml(value) {
  return /[<>]/.test(value);
}

function readTrimmed(input) {
  if (input == null) {
    return null;
  }
  const trimmed = String(input).trim();
  return trimmed || null;
}

function normalizePlainText(input, {
  field,
  maxLength,
  required = false,
  rejectHtml = false,
} = {}) {
  const trimmed = readTrimmed(input);
  if (!trimmed) {
    if (required) {
      throw new ApiError(400, `${field} is required.`);
    }
    return null;
  }

  if (rejectHtml && containsHtml(trimmed)) {
    throw new ApiError(400, `${field} cannot contain HTML.`);
  }

  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${field} must be at most ${maxLength} characters.`);
  }

  return trimmed;
}

function readPlainText(input, { maxLength, rejectHtml = false } = {}) {
  const trimmed = readTrimmed(input);
  if (!trimmed) {
    return null;
  }
  if (rejectHtml && containsHtml(trimmed)) {
    return null;
  }
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function normalizeFaqItemId(raw) {
  if (raw == null || String(raw).trim() === '') {
    return randomUUID().toLowerCase();
  }

  const id = String(raw).trim().toLowerCase();
  if (!UUID_PATTERN.test(id)) {
    throw new ApiError(400, 'Each FAQ item id must be a UUID.');
  }
  return id;
}

function readFaqItemId(raw) {
  if (raw == null) {
    return null;
  }
  const id = String(raw).trim().toLowerCase();
  if (!id || !UUID_PATTERN.test(id)) {
    return null;
  }
  return id;
}

function normalizeHomepageLimit(input) {
  if (input == null || input === '') {
    return null;
  }
  if (!Number.isInteger(input) || input < HOMEPAGE_FAQ_LIMIT_MIN || input > HOMEPAGE_FAQ_LIMIT_MAX) {
    throw new ApiError(400, 'Homepage FAQ limit must be null or an integer from 1 to 40.');
  }
  return input;
}

function readHomepageLimit(input) {
  if (input == null) {
    return null;
  }
  const value = Number(input);
  if (!Number.isInteger(value) || value < HOMEPAGE_FAQ_LIMIT_MIN || value > HOMEPAGE_FAQ_LIMIT_MAX) {
    return null;
  }
  return value;
}

function normalizeFaqItem(item, seenIds) {
  if (!item || typeof item !== 'object') {
    throw new ApiError(400, 'Each FAQ item must be an object.');
  }

  const id = normalizeFaqItemId(item.id);
  if (seenIds.has(id)) {
    throw new ApiError(400, 'FAQ item ids must be unique.');
  }
  seenIds.add(id);

  return {
    id,
    question: normalizePlainText(item.question, {
      field: 'FAQ question',
      maxLength: HOMEPAGE_FAQ_QUESTION_MAX_LENGTH,
      required: true,
      rejectHtml: true,
    }),
    answer: normalizePlainText(item.answer, {
      field: 'FAQ answer',
      maxLength: HOMEPAGE_FAQ_ANSWER_MAX_LENGTH,
      required: true,
      rejectHtml: true,
    }),
    enabled: item.enabled == null ? true : Boolean(item.enabled),
  };
}

function readFaqItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = readFaqItemId(item.id);
  const question = readPlainText(item.question, {
    maxLength: HOMEPAGE_FAQ_QUESTION_MAX_LENGTH,
    rejectHtml: true,
  });
  const answer = readPlainText(item.answer, {
    maxLength: HOMEPAGE_FAQ_ANSWER_MAX_LENGTH,
    rejectHtml: true,
  });

  if (!id || !question || !answer) {
    return null;
  }

  return {
    id,
    question,
    answer,
    enabled: Boolean(item.enabled),
  };
}

export function normalizeHomepageFaqDocument(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(400, 'Homepage FAQ settings must be an object.');
  }

  const itemsInput = payload.items;
  if (!Array.isArray(itemsInput)) {
    throw new ApiError(400, 'FAQ items must be an array.');
  }
  if (itemsInput.length > HOMEPAGE_FAQ_MAX_ITEMS) {
    throw new ApiError(400, `At most ${HOMEPAGE_FAQ_MAX_ITEMS} FAQ items can be saved.`);
  }

  const seenIds = new Set();
  const items = itemsInput.map((item) => normalizeFaqItem(item, seenIds));

  return {
    enabled: Boolean(payload.enabled),
    heading: normalizePlainText(payload.heading, {
      field: 'FAQ heading',
      maxLength: HOMEPAGE_FAQ_HEADING_MAX_LENGTH,
      rejectHtml: true,
    }),
    subtitle: normalizePlainText(payload.subtitle, {
      field: 'FAQ subtitle',
      maxLength: HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH,
      rejectHtml: true,
    }),
    homepageLimit: normalizeHomepageLimit(payload.homepageLimit),
    items,
  };
}

export function readHomepageFaqDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return emptyHomepageFaqDocument();
  }

  const items = Array.isArray(value.items)
    ? value.items.map(readFaqItem).filter(Boolean)
    : [];

  return {
    enabled: Boolean(value.enabled),
    heading: readPlainText(value.heading, {
      maxLength: HOMEPAGE_FAQ_HEADING_MAX_LENGTH,
      rejectHtml: true,
    }),
    subtitle: readPlainText(value.subtitle, {
      maxLength: HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH,
      rejectHtml: true,
    }),
    homepageLimit: readHomepageLimit(value.homepageLimit),
    items,
  };
}

export function toPublicHomepageFaq(value) {
  const document = readHomepageFaqDocument(value);
  if (!document.enabled) {
    return emptyPublicHomepageFaq();
  }

  const active = document.items.filter((item) => item.enabled);
  const limited = document.homepageLimit == null
    ? active
    : active.slice(0, document.homepageLimit);

  return {
    enabled: true,
    heading: document.heading,
    subtitle: document.subtitle,
    items: limited.map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
    })),
  };
}

export function toHomepageFaqSnapshot(row) {
  const document = readHomepageFaqDocument(row?.value);
  return {
    ...document,
    updatedAt: row?.updatedAt || null,
  };
}

export default {
  HOMEPAGE_FAQ_HEADING_MAX_LENGTH,
  HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH,
  HOMEPAGE_FAQ_QUESTION_MAX_LENGTH,
  HOMEPAGE_FAQ_ANSWER_MAX_LENGTH,
  HOMEPAGE_FAQ_MAX_ITEMS,
  emptyHomepageFaqDocument,
  emptyPublicHomepageFaq,
  normalizeHomepageFaqDocument,
  readHomepageFaqDocument,
  toPublicHomepageFaq,
  toHomepageFaqSnapshot,
};
