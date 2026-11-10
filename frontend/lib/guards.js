export function canAccessAdmin(user) {
  return Boolean(user?.isAdmin);
}

export function isSignedIn(user) {
  return Boolean(user?.id);
}
