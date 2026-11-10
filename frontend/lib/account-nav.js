export const ACCOUNT_NAV_LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/wishlist', label: 'Wishlist' },
  { href: '/cart', label: 'Bag' },
  { href: '/account/orders', label: 'Orders' },
];

export function isAccountNavActive(pathname, href) {
  const current = String(pathname || '').replace(/\/+$/, '') || '/';
  const target = String(href || '').replace(/\/+$/, '') || '/';
  if (target === '/account') {
    return current === '/account';
  }
  return current === target || current.startsWith(`${target}/`);
}
