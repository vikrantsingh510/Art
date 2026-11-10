import { Router } from 'express';
import { getCurrentUser, updateCurrentUser } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { profilePatchBody } from '../validators/profile.validators.js';

const router = Router();

router.get('/me', requireAuth, asyncHandler(getCurrentUser));
router.patch('/me', requireAuth, validate({ body: profilePatchBody }), asyncHandler(updateCurrentUser));

export default router;
