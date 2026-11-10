import { sendSuccess } from '../utils/ApiResponse.js';
import { updateCurrentProfile } from '../services/profile.service.js';

function presentUser(req, profile, roles) {
  const nextRoles = roles || req.user.roles;
  return {
    id: req.user.id,
    email: req.user.email,
    fullName: profile?.fullName || req.user.fullName,
    roles: nextRoles,
    isAdmin: nextRoles.includes('admin'),
    profile,
  };
}

export function getCurrentUser(req, res) {
  return sendSuccess(res, {
    data: presentUser(req, req.user.profile, req.user.roles),
  });
}

export async function updateCurrentUser(req, res) {
  const { profile, roles } = await updateCurrentProfile(req.user.id, req.body);
  return sendSuccess(res, {
    data: presentUser(req, profile, roles),
  });
}

export default {
  getCurrentUser,
  updateCurrentUser,
};
