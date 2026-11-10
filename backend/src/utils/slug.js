export function slugify(value) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'item';
}

export function uniqueSlug(value) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugify(value)}-${suffix}`;
}

export default slugify;
