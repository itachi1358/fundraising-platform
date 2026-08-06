import { Router } from 'express';
import { z } from 'zod';
import {
  createDonationOrder,
  getCampaignDonationHistory,
  getDonationHistory,
  verifyDonationPayment
} from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');
const money = z.coerce
  .number()
  .positive('Donation amount must be positive')
  .max(1000000, 'Donation amount is too large')
  .refine((value) => Math.round(value * 100) / 100 === value, 'Donation amount can have at most two decimal places');

const router = Router();

router.post('/order', requireAuth, validate(z.object({ campaignId: objectId, amount: money })), createDonationOrder);
router.post(
  '/verify',
  requireAuth,
  validate(
    z.object({
      campaignId: objectId.optional(),
      orderId: z.string().trim().min(8).max(255),
      paymentId: z.string().trim().min(4).max(255),
      signature: z.string().trim().min(1).max(512).optional()
    })
  ),
  verifyDonationPayment
);
router.get('/history', requireAuth, getDonationHistory);
router.get('/campaign/:campaignId', requireAuth, getCampaignDonationHistory);

export default router;
