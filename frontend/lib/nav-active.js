export function normalizeNavPath(pathname) {
  return String(pathname || '').replace(/\/+$/, '') || '/';
}

export function isNavHrefActive(pathname, href, allHrefs = []) {
  const current = normalizeNavPath(pathname);
  const target = normalizeNavPath(href);
  if (current !== target && !current.startsWith(`${target}/`)) {
    return false;
  }
  return !allHrefs.some((other) => {
    const candidate = normalizeNavPath(other);
    return candidate.length > target.length
      && (current === candidate || current.startsWith(`${candidate}/`));
  });
}
