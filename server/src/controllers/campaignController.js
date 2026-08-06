import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import CampaignRequest from '../models/CampaignRequest.js';
import { uploadCampaignAssets } from '../services/uploadService.js';

const sortMap = {
  newest: { createdAt: -1 },
  endingSoon: { deadline: 1, createdAt: -1 },
  mostFunded: { raisedAmount: -1, createdAt: -1 }
};

const invalidId = (res) => res.status(400).json({ message: 'Invalid campaign id' });

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

// Multipart fields arrive as strings. Upload Cloudinary assets before schema
// validation so the persisted request only contains trusted HTTPS URLs.
export async function prepareCampaignRequestAssets(req, _res, next) {
  try {
    if (req.body.payoutDetails && !req.body.bankDetails && !req.body.upiId) {
      req.body.bankDetails = req.body.payoutDetails;
    }
    delete req.body.payoutDetails;
    const assets = await uploadCampaignAssets(req.files);
    if (assets.bannerImage) req.body.bannerImage = assets.bannerImage.url;
    if (assets.documents.length) req.body.documents = assets.documents.map((document) => document.url);
    if (req.body.documents == null || req.body.documents === '') req.body.documents = [];
    if (typeof req.body.documents === 'string') {
      try { req.body.documents = JSON.parse(req.body.documents); }
      catch { req.body.documents = [req.body.documents]; }
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function listActiveCampaigns(req, res, next) {
  try {
    await refreshCampaignLifecycle();
    const { page, limit, sort, ...filters } = req.validatedQuery;
    const filter = {
      ...campaignFilters(filters),
      status: 'active',
      deadline: { $gt: new Date() },
      $expr: { $lt: ['$raisedAmount', '$goalAmount'] }
    };
    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate('creator', 'name')
        .sort(sortMap[sort])
        .skip((page - 1) * limit)
        .limit(limit),
      Campaign.countDocuments(filter)
    ]);
    return res.json({
      campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCampaign(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);
    await refreshCampaignLifecycle();
    const query = Campaign.findOne({ _id: req.params.id, status: { $ne: 'rejected' } });
    if (req.user?.role === 'admin') {
      query.select('+documents +upiId +bankDetails');
    }
    const campaign = await query.populate('creator', 'name').exec();
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    return res.json({ campaign });
  } catch (error) {
    next(error);
  }
}

export async function createCampaignRequest(req, res, next) {
  try {
    const request = await CampaignRequest.create({
      requestedBy: req.user._id,
      campaignData: req.body
    });
    return res.status(201).json({ message: 'Campaign request submitted for review', request });
  } catch (error) {
    next(error);
  }
}

export async function listMyCampaigns(req, res, next) {
  try {
    await refreshCampaignLifecycle();
    const [campaigns, requests] = await Promise.all([
      Campaign.find({ creator: req.user._id }).sort({ createdAt: -1 }),
      CampaignRequest.find({ requestedBy: req.user._id })
        .populate('campaign')
        .sort({ createdAt: -1 })
    ]);
    return res.json({ campaigns, requests });
  } catch (error) {
    next(error);
  }
}
