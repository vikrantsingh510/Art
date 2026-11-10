export function isUniqueViolation(error) {
  let current = error;
  while (current) {
    if (current.code === '23505') {
      return true;
    }
    current = current.cause || current.originalError || null;
  }
  return false;
}

export default {
  isUniqueViolation,
};
