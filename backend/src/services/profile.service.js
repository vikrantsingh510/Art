import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { profiles } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { applyProfilePatch } from '../utils/profile-fields.js';
import { isUniqueViolation } from '../utils/pg-error.js';
import { getProfileWithRoles } from './identity.service.js';

export async function updateCurrentProfile(userId, payload) {
  const { profile, roles } = await getProfileWithRoles(userId);
  if (!profile) {
    throw new ApiError(404, 'Profile not found');
  }

  const next = applyProfilePatch({
    fullName: profile.fullName,
    phone: profile.phone,
  }, payload);

  try {
    const [updated] = await db.update(profiles).set({
      fullName: next.fullName,
      phone: next.phone,
    }).where(eq(profiles.id, userId)).returning();

    return {
      profile: updated,
      roles,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'Phone number is already in use');
    }
    throw error;
  }
}

export default {
  updateCurrentProfile,
};
