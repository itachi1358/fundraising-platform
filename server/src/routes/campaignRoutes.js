import { Router } from 'express';
import {
  createCampaignRequest,
  getCampaign,
  listActiveCampaigns,
  listMyCampaigns,
  prepareCampaignRequestAssets
} from '../controllers/campaignController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadCampaignFiles } from '../middleware/upload.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { campaignListQuerySchema, campaignRequestSchema } from '../validation/campaignSchemas.js';

const router = Router();

router.get('/', validateQuery(campaignListQuerySchema), listActiveCampaigns);
router.post('/request', requireAuth, uploadCampaignFiles, prepareCampaignRequestAssets, validate(campaignRequestSchema), createCampaignRequest);
router.get('/my-campaigns', requireAuth, listMyCampaigns);
router.get('/mine', requireAuth, listMyCampaigns);
router.get('/:id', getCampaign);

export default router;

// Compatibility mounts for the API paths originally specified for the app.
export const legacyCampaignRoutes = Router();
legacyCampaignRoutes.post('/request', requireAuth, uploadCampaignFiles, prepareCampaignRequestAssets, validate(campaignRequestSchema), createCampaignRequest);
legacyCampaignRoutes.get('/:id', getCampaign);

export const userCampaignRoutes = Router();
userCampaignRoutes.get('/my-campaigns', requireAuth, listMyCampaigns);
