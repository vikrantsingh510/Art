import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export async function verifySupabaseAccessToken(accessToken) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(401, 'Invalid or expired access token');
  }

  if (!response.ok) {
    throw new ApiError(401, 'Unable to verify access token');
  }

  const payload = await response.json();
  const userId = payload.id || payload.user?.id;
  if (!userId) {
    throw new ApiError(401, 'Invalid or expired access token');
  }

  return {
    userId,
    email: payload.email || payload.user?.email || null,
    fullName: payload.user_metadata?.full_name
      || payload.user_metadata?.name
      || payload.user?.user_metadata?.full_name
      || null,
  };
}

export default {
  verifySupabaseAccessToken,
};
