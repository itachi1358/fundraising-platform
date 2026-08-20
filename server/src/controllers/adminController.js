import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import CampaignRequest from '../models/CampaignRequest.js';
import User from '../models/User.js';
import Donation from '../models/Donation.js';
import { sendCampaignStatusEmail } from '../utils/email.js';
import { invalidateCache } from '../middleware/cache.js';

const campaignSortMap = {
  newest: { createdAt: -1 },
  endingSoon: { deadline: 1, createdAt: -1 },
  mostFunded: { raisedAmount: -1, createdAt: -1 }
};

function invalidId(res, label = 'resource') {
  return res.status(400).json({ message: `Invalid ${label} id` });
}

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function campaignFilters({ search, category }) {
  const filter = {};
  if (search) {
    const expression = new RegExp(escapedRegex(search), 'i');
    filter.$or = [{ title: expression }, { description: expression }];
  }
  if (category) filter.category = new RegExp(`^${escapedRegex(category)}$`, 'i');
  return filter;
}

async function refreshCampaignLifecycle() {
  await Campaign.closeEligibleCampaigns();
}

export async function listRequests(req, res, next) {
  try {
    const { page, limit, status, search, sort } = req.validatedQuery;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const expression = new RegExp(escapedRegex(search), 'i');
      filter.$or = [
        { 'campaignData.title': expression },
        { 'campaignData.category': expression },
        { 'requestedBy.name': expression }
      ];
    }
    // The requestedBy.name condition above cannot match before populate. Search
    // the submitted campaign fields here; user lookups remain available in data.
    if (filter.$or) filter.$or = filter.$or.slice(0, 2);

    const [requests, total] = await Promise.all([
      CampaignRequest.find(filter)
        .populate('requestedBy', 'name email')
        .populate('reviewedBy', 'name email')
        .populate('campaign', 'title status goalAmount raisedAmount deadline')
        .sort({ createdAt: sort === 'oldest' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      CampaignRequest.countDocuments(filter)
    ]);
    return res.json({ requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function getRequestDetails(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'request');
    const request = await CampaignRequest.findById(req.params.id)
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .populate('campaign');
    if (!request) return res.status(404).json({ message: 'Campaign request not found' });
    return res.json({ request });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'request');
    const request = await CampaignRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Campaign request not found' });
    if (request.status !== 'pending') {
      return res.status(409).json({ message: 'Only pending campaign requests can be approved' });
    }

    const storedData = request.campaignData.toObject();
    const campaignData = { ...storedData, ...(req.body.campaignData || {}) };
    if (new Date(campaignData.deadline).getTime() <= Date.now()) {
      return res.status(422).json({ message: 'Campaign deadline must still be in the future before approval' });
    }

    const documents = Array.isArray(campaignData.documents) ? campaignData.documents : [];
    const publicDocuments = Array.isArray(req.body.publicDocuments) ? req.body.publicDocuments : [];
    const invalidPublicDocuments = publicDocuments.filter((url) => !documents.includes(url));
    if (invalidPublicDocuments.length > 0) {
      return res.status(422).json({ message: 'Public documents must be chosen from the uploaded supporting documents' });
    }

    const campaign = await Campaign.create({
      ...campaignData,
      publicDocuments,
      creator: request.requestedBy,
      status: 'active',
      approvedBy: req.user._id,
      approvedAt: new Date()
    });
    const reviewedAt = new Date();
    const approvedRequest = await CampaignRequest.findOneAndUpdate(
      { _id: request._id, status: 'pending' },
      {
        $set: {
          status: 'approved',
          adminRemarks: req.body.adminRemarks,
          reviewedBy: req.user._id,
          reviewedAt,
          campaign: campaign._id
        }
      },
      { new: true }
    );

    // A second admin could have acted between the read and update. Remove the
    // just-created campaign so no unreviewed duplicate becomes public.
    if (!approvedRequest) {
      await Campaign.findByIdAndDelete(campaign._id);
      return res.status(409).json({ message: 'This campaign request was already reviewed' });
    }

    await User.findByIdAndUpdate(request.requestedBy, { $addToSet: { createdCampaigns: campaign._id } });
    const creator = await User.findById(request.requestedBy).select('name email');
    if (creator?.email) {
      void sendCampaignStatusEmail({
        type: 'approved', to: creator.email, recipientName: creator.name, campaignTitle: campaign.title
      });
    }
    await invalidateCache('campaigns:*');
    return res.json({ message: 'Campaign request approved', request: approvedRequest, campaign });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'request');
    const request = await CampaignRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          adminRemarks: req.body.adminRemarks,
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        }
      },
      { new: true }
    );
    if (!request) return res.status(409).json({ message: 'Campaign request is missing or has already been reviewed' });
    const creator = await User.findById(request.requestedBy).select('name email');
    if (creator?.email) {
      void sendCampaignStatusEmail({
        type: 'rejected', to: creator.email, recipientName: creator.name,
        campaignTitle: request.campaignData.title, reason: request.adminRemarks
      });
    }
    return res.json({ message: 'Campaign request rejected', request });
  } catch (error) {
    next(error);
  }
}

export async function listAdminCampaigns(req, res, next) {
  try {
    await refreshCampaignLifecycle();
    const { page, limit, status, sort, ...filters } = req.validatedQuery;
    const filter = campaignFilters(filters);
    if (status) filter.status = status;
    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate('creator', 'name email')
        .populate('approvedBy', 'name email')
        .sort(campaignSortMap[sort])
        .skip((page - 1) * limit)
        .limit(limit),
      Campaign.countDocuments(filter)
    ]);
    return res.json({ campaigns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCampaignDetails(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'campaign');
    await refreshCampaignLifecycle();
    const campaign = await Campaign.findById(req.params.id)
      .select('+documents +upiId +bankDetails +adminRemarks')
      .populate('creator', 'name email')
      .populate('approvedBy', 'name email');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    return res.json({ campaign });
  } catch (error) {
    next(error);
  }
}

export async function updateCampaign(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'campaign');
    const campaign = await Campaign.findById(req.params.id).select('+documents +upiId +bankDetails');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (req.body.goalAmount != null && req.body.goalAmount < campaign.raisedAmount) {
      return res.status(422).json({ message: 'Goal amount cannot be less than the amount already raised' });
    }
    if (req.body.publicDocuments != null) {
      const documents = Array.isArray(campaign.documents) ? campaign.documents : [];
      const invalidPublicDocuments = req.body.publicDocuments.filter((url) => !documents.includes(url));
      if (invalidPublicDocuments.length > 0) {
        return res.status(422).json({ message: 'Public documents must be chosen from the uploaded supporting documents' });
      }
    }
    campaign.set(req.body);
    await campaign.save();
    await invalidateCache('campaigns:*');
    return res.json({ message: 'Campaign updated', campaign });
  } catch (error) {
    next(error);
  }
}

export async function stopCampaign(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'campaign');
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { $set: { status: 'stopped', stoppedAt: new Date(), adminRemarks: req.body.adminRemarks } },
      { new: true }
    );
    if (!campaign) return res.status(409).json({ message: 'Only active campaigns can be stopped' });
    const creator = await User.findById(campaign.creator).select('name email');
    if (creator?.email) {
      void sendCampaignStatusEmail({
        type: 'stopped', to: creator.email, recipientName: creator.name,
        campaignTitle: campaign.title, reason: req.body.adminRemarks
      });
    }
    return res.json({ message: 'Campaign stopped', campaign });
  } catch (error) {
    next(error);
  }
}

export async function resumeCampaign(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'campaign');
    const campaign = await Campaign.findById(req.params.id).select('+adminRemarks');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'stopped') {
      return res.status(409).json({ message: 'Only stopped campaigns can be resumed' });
    }
    if (campaign.deadline.getTime() <= Date.now()) {
      return res.status(422).json({ message: 'Expired campaigns cannot be resumed' });
    }
    if (campaign.raisedAmount >= campaign.goalAmount) {
      return res.status(422).json({ message: 'Campaign goal has already been reached' });
    }
    campaign.status = 'active';
    campaign.resumedAt = new Date();
    campaign.adminRemarks = req.body.adminRemarks;
    await campaign.save();
    return res.json({ message: 'Campaign resumed', campaign });
  } catch (error) {
    next(error);
  }
}

export async function deleteCampaign(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'campaign');
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    await Promise.all([
      User.findByIdAndUpdate(campaign.creator, { $pull: { createdCampaigns: campaign._id } }),
      CampaignRequest.updateMany({ campaign: campaign._id }, { $unset: { campaign: 1 } })
    ]);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(_req, res, next) {
  try {
    await refreshCampaignLifecycle();
    const [campaignStatus, requestStatus, totalCampaigns, recentRequests, donationStats, recentDonations] = await Promise.all([
      Campaign.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            raisedAmount: { $sum: '$raisedAmount' }
          }
        }
      ]),
      CampaignRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Campaign.aggregate([
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            totalFundsRaised: { $sum: '$raisedAmount' }
          }
        }
      ]),
      CampaignRequest.find()
        .populate('requestedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(5),
      Donation.aggregate([
        { $match: { status: 'success' } },
        { $group: { _id: null, totalDonations: { $sum: 1 }, totalDonationVolume: { $sum: '$amount' } } }
      ]),
      Donation.find({ status: 'success' })
        .populate('donor', 'name')
        .populate('campaignId', 'title')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('amount donor campaignId createdAt')
    ]);

    const byCampaignStatus = Object.fromEntries(campaignStatus.map((item) => [item._id, item]));
    const byRequestStatus = Object.fromEntries(requestStatus.map((item) => [item._id, item.count]));
    const totals = totalCampaigns[0] || { totalCampaigns: 0, totalFundsRaised: 0 };
    const donations = donationStats[0] || { totalDonations: 0, totalDonationVolume: 0 };
    return res.json({
      summary: {
        totalCampaigns: totals.totalCampaigns,
        totalFundsRaised: totals.totalFundsRaised,
        activeCampaigns: byCampaignStatus.active?.count || 0,
        stoppedCampaigns: byCampaignStatus.stopped?.count || 0,
        closedCampaigns: byCampaignStatus.closed?.count || 0,
        rejectedCampaigns: byCampaignStatus.rejected?.count || 0,
        pendingRequests: byRequestStatus.pending || 0,
        approvedRequests: byRequestStatus.approved || 0,
        rejectedRequests: byRequestStatus.rejected || 0,
        totalDonations: donations.totalDonations
      },
      campaignStatus,
      requestStatus,
      recentRequests,
      totalDonations: donations.totalDonations,
      recentDonations
    });
  } catch (error) {
    next(error);
  }
}
