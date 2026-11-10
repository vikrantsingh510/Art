const FORBIDDEN_PROFILE_KEYS = [
  'id',
  'userId',
  'email',
  'role',
  'roles',
  'isAdmin',
  'isActive',
  'avatarPath',
  'createdAt',
  'updatedAt',
];

export function blankToNull(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizePhone(value) {
  const next = blankToNull(value);
  if (next === undefined || next === null) {
    return next;
  }
  return next.replace(/\s+/g, ' ');
}

export function hasForbiddenProfileKeys(body) {
  if (!body || typeof body !== 'object') {
    return [];
  }
  return FORBIDDEN_PROFILE_KEYS.filter((key) => Object.hasOwn(body, key));
}

export function applyProfilePatch(current, patch) {
  const next = { ...current };
  if (Object.hasOwn(patch, 'fullName')) {
    next.fullName = blankToNull(patch.fullName);
  }
  if (Object.hasOwn(patch, 'phone')) {
    next.phone = normalizePhone(patch.phone);
  }
  return next;
}

export default {
  blankToNull,
  normalizePhone,
  hasForbiddenProfileKeys,
  applyProfilePatch,
};
