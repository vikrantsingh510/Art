export async function readCurrentUser({ getAccessToken, getMe } = {}) {
  if (typeof getAccessToken !== 'function' || typeof getMe !== 'function') {
    throw new Error('getAccessToken and getMe are required');
  }

  const token = await getAccessToken();
  if (!token) {
    return { user: null, token: null };
  }

  try {
    const user = await getMe({ token });
    return { user, token };
  } catch (error) {
    const status = error?.status;
    if (status === 401 || status === 403) {
      return { user: null, token: null };
    }
    if (status === 429) {
      return {
        user: null,
        token,
        unavailable: 'rate_limited',
        error,
      };
    }
    throw error;
  }
}

export function createCurrentUserLoader(deps) {
  let inflight = null;
  return function getCurrentUser() {
    if (!inflight) {
      inflight = readCurrentUser(deps);
    }
    return inflight;
  };
}
