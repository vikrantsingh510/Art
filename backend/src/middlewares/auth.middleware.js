import { ApiError } from '../utils/ApiError.js';
import { verifySupabaseAccessToken } from '../services/auth.service.js';
import { getProfileWithRoles, provisionCustomerIdentity } from '../services/identity.service.js';

let verifyAccessToken = verifySupabaseAccessToken;
let provisionIdentity = provisionCustomerIdentity;
let loadProfileWithRoles = getProfileWithRoles;

export function setAuthDependencies(overrides = {}) {
  if (overrides.verifyAccessToken) {
    verifyAccessToken = overrides.verifyAccessToken;
  }
  if (overrides.provisionIdentity) {
    provisionIdentity = overrides.provisionIdentity;
  }
  if (overrides.loadProfileWithRoles) {
    loadProfileWithRoles = overrides.loadProfileWithRoles;
  }
}

export function resetAuthDependencies() {
  verifyAccessToken = verifySupabaseAccessToken;
  provisionIdentity = provisionCustomerIdentity;
  loadProfileWithRoles = getProfileWithRoles;
}

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token.trim();
}

export async function requireAuth(req, _res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    const identity = await verifyAccessToken(token);
    await provisionIdentity({
      userId: identity.userId,
      fullName: identity.fullName,
      email: identity.email,
    });

    const { profile, roles } = await loadProfileWithRoles(identity.userId);

    req.auth = {
      userId: identity.userId,
      email: identity.email,
      token,
    };
    req.user = {
      id: identity.userId,
      email: identity.email,
      fullName: profile?.fullName || identity.fullName,
      profile,
      roles,
      isAdmin: roles.includes('admin'),
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      next();
      return;
    }

    const identity = await verifyAccessToken(token);
    await provisionIdentity({
      userId: identity.userId,
      fullName: identity.fullName,
      email: identity.email,
    });
    const { profile, roles } = await loadProfileWithRoles(identity.userId);

    req.auth = {
      userId: identity.userId,
      email: identity.email,
      token,
    };
    req.user = {
      id: identity.userId,
      email: identity.email,
      fullName: profile?.fullName || identity.fullName,
      profile,
      roles,
      isAdmin: roles.includes('admin'),
    };
    next();
  } catch {
    next();
  }
}

export function requireAdmin(req, _res, next) {
  if (!req.user) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  if (!req.user.isAdmin) {
    next(new ApiError(403, 'Admin access required'));
    return;
  }

  next();
}

export default {
  requireAuth,
  requireAdmin,
  setAuthDependencies,
  resetAuthDependencies,
};
