import { Router } from 'express';
import {
  approveRequest,
  deleteCampaign,
  getAdminCampaignDetails,
  getAnalytics,
  getRequestDetails,
  listAdminCampaigns,
  listRequests,
  rejectRequest,
  resumeCampaign,
  stopCampaign,
  updateCampaign
} from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  adminApprovalSchema,
  adminCampaignListQuerySchema,
  adminCampaignPatchSchema,
  adminRemarksSchema,
  adminRequestListQuerySchema
} from '../validation/campaignSchemas.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/analytics', getAnalytics);
router.get('/requests', validateQuery(adminRequestListQuerySchema), listRequests);
router.get('/requests/:id', getRequestDetails);
router.put('/requests/:id/approve', validate(adminApprovalSchema), approveRequest);
router.put('/requests/:id/reject', validate(adminRemarksSchema), rejectRequest);

router.get('/campaigns', validateQuery(adminCampaignListQuerySchema), listAdminCampaigns);
router.get('/campaigns/:id', getAdminCampaignDetails);
router.patch('/campaigns/:id', validate(adminCampaignPatchSchema), updateCampaign);
router.put('/campaigns/:id/stop', validate(adminRemarksSchema), stopCampaign);
router.put('/campaigns/:id/resume', validate(adminRemarksSchema), resumeCampaign);
router.delete('/campaigns/:id', deleteCampaign);

export default router;
