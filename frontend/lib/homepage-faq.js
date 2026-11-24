export const HOMEPAGE_FAQ_HEADING_MAX_LENGTH = 120;
export const HOMEPAGE_FAQ_SUBTITLE_MAX_LENGTH = 400;
export const HOMEPAGE_FAQ_QUESTION_MAX_LENGTH = 200;
export const HOMEPAGE_FAQ_ANSWER_MAX_LENGTH = 4000;
export const HOMEPAGE_FAQ_MAX_ITEMS = 40;
export const HOMEPAGE_FAQ_LIMIT_MIN = 1;
export const HOMEPAGE_FAQ_LIMIT_MAX = 40;

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

export function resolveHomepageFaq(data) {
  if (!data || typeof data !== 'object' || data.enabled !== true) {
    return emptyPublicHomepageFaq();
  }

  const items = Array.isArray(data.items)
    ? data.items
      .filter((item) => item && item.id && String(item.question || '').trim() && String(item.answer || '').trim())
      .map((item) => ({
        id: String(item.id),
        question: String(item.question).trim(),
        answer: String(item.answer),
      }))
    : [];

  return {
    enabled: true,
    heading: String(data.heading || '').trim() || null,
    subtitle: String(data.subtitle || '').trim() || null,
    items,
  };
}

export function shouldRenderHomepageFaq(faq) {
  return Boolean(faq?.enabled && Array.isArray(faq.items) && faq.items.length > 0);
}

export function toggleHomepageFaqOpenIds(openIds, id) {
  const next = new Set(openIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function clampHomepageFaqLimit(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    return HOMEPAGE_FAQ_LIMIT_MIN;
  }
  return Math.min(HOMEPAGE_FAQ_LIMIT_MAX, Math.max(HOMEPAGE_FAQ_LIMIT_MIN, parsed));
}

export function createHomepageFaqItem(overrides = {}, keySeed = 'new') {
  return {
    localKey: overrides.localKey || `faq-${keySeed}`,
    id: overrides.id || null,
    question: overrides.question || '',
    answer: overrides.answer || '',
    enabled: overrides.enabled == null ? true : Boolean(overrides.enabled),
  };
}

export function fieldsFromFaqSettings(settings) {
  const items = Array.isArray(settings?.items) ? settings.items : [];
  const limit = settings?.homepageLimit;
  return {
    enabled: Boolean(settings?.enabled),
    heading: settings?.heading || '',
    subtitle: settings?.subtitle || '',
    showAll: limit == null,
    homepageLimit: limit == null ? HOMEPAGE_FAQ_LIMIT_MIN : clampHomepageFaqLimit(limit),
    items: items.map((item, index) => createHomepageFaqItem(item, item.id || `loaded-${index}`)),
  };
}

export function addHomepageFaqItem(items, keySeed = Date.now()) {
  const current = Array.isArray(items) ? items : [];
  if (current.length >= HOMEPAGE_FAQ_MAX_ITEMS) {
    return current;
  }
  return [...current, createHomepageFaqItem({}, keySeed)];
}

export function updateHomepageFaqItem(items, index, patch) {
  const current = Array.isArray(items) ? items : [];
  return current.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...patch } : item
  ));
}

export function moveHomepageFaqItem(items, index, offset) {
  const current = Array.isArray(items) ? [...items] : [];
  const target = index + offset;
  if (index < 0 || target < 0 || index >= current.length || target >= current.length) {
    return current;
  }
  const [item] = current.splice(index, 1);
  current.splice(target, 0, item);
  return current;
}

export function removeHomepageFaqItem(items, index) {
  return (Array.isArray(items) ? items : []).filter((_, itemIndex) => itemIndex !== index);
}

export function shouldConfirmHomepageFaqDelete(item) {
  return Boolean(item?.id || String(item?.question || '').trim() || String(item?.answer || '').trim());
}

export function homepageFaqPutBody(fields) {
  return {
    enabled: Boolean(fields?.enabled),
    heading: String(fields?.heading || '').trim() || null,
    subtitle: String(fields?.subtitle || '').trim() || null,
    homepageLimit: fields?.showAll ? null : clampHomepageFaqLimit(fields?.homepageLimit),
    items: (Array.isArray(fields?.items) ? fields.items : []).map((item) => {
      const body = {
        question: String(item.question || '').trim(),
        answer: String(item.answer || '').trim(),
        enabled: Boolean(item.enabled),
      };
      if (item.id) {
        body.id = item.id;
      }
      return body;
    }),
  };
}
