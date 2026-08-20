import { Router } from 'express';
import {
  createCampaignRequest,
  getCampaign,
  listActiveCampaigns,
  listMyCampaigns,
  prepareCampaignRequestAssets
} from '../controllers/campaignController.js';
import { requireAuth } from '../middleware/auth.js';
import { cache, invalidateCache } from '../middleware/cache.js';
import { uploadCampaignFiles } from '../middleware/upload.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { campaignListQuerySchema, campaignRequestSchema } from '../validation/campaignSchemas.js';

const router = Router();

// GET  /campaigns — list active campaigns (cached 2 min)
router.get('/', validateQuery(campaignListQuerySchema), cache({ ttl: 120, key: 'campaigns:list' }), listActiveCampaigns);

// POST /campaigns/request — create a campaign request (invalidates campaign caches)
router.post('/request', requireAuth, uploadCampaignFiles, prepareCampaignRequestAssets, validate(campaignRequestSchema), createCampaignRequest, async (_req, _res, next) => {
  await invalidateCache('campaigns:*');
  next();
});

router.get('/my-campaigns', requireAuth, listMyCampaigns);
router.get('/mine', requireAuth, listMyCampaigns);

// GET  /campaigns/:id — single campaign (cached 60 sec)
router.get('/:id', cache({ ttl: 60, key: 'campaigns:single' }), getCampaign);

export default router;

// Compatibility mounts for the API paths originally specified for the app.
export const legacyCampaignRoutes = Router();
legacyCampaignRoutes.post('/request', requireAuth, uploadCampaignFiles, prepareCampaignRequestAssets, validate(campaignRequestSchema), createCampaignRequest, async (_req, _res, next) => {
  await invalidateCache('campaigns:*');
  next();
});
legacyCampaignRoutes.get('/:id', cache({ ttl: 60, key: 'campaigns:single' }), getCampaign);

export const userCampaignRoutes = Router();
userCampaignRoutes.get('/my-campaigns', requireAuth, listMyCampaigns);
