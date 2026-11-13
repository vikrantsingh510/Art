function hasPostgresCode(error, code) {
  let current = error;
  while (current) {
    if (current.code === code) {
      return true;
    }
    current = current.cause || current.originalError || null;
  }
  return false;
}

export function isUniqueViolation(error) {
  return hasPostgresCode(error, '23505');
}

export function isForeignKeyViolation(error) {
  return hasPostgresCode(error, '23503');
}

export default {
  isUniqueViolation,
  isForeignKeyViolation,
};
