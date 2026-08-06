import { Router } from 'express';
import { z } from 'zod';
import { login, logout, me, register, updateProfile } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128)
});
const registration = credentials.extend({ name: z.string().trim().min(2).max(80) });

const router = Router();
router.post('/register', validate(registration), register);
router.post('/login', validate(credentials), login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/profile', requireAuth, validate(z.object({ name: z.string().trim().min(2).max(80) })), updateProfile);
export default router;
