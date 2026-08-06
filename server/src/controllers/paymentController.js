import Campaign from '../models/Campaign.js';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import {
  createPaymentOrder,
  getPaymentProvider,
  PaymentConfigurationError,
  verifyPaymentSignature
} from '../services/paymentService.js';
import { sendCampaignStatusEmail } from '../utils/email.js';

const ACTIVE_STATUSES = ['active', 'Active'];

const campaignSelect = 'title bannerImage goalAmount raisedAmount deadline status category creator';

const normalizeStatus = (status) => String(status || '').toLowerCase();
const isCampaignOpen = (campaign) =>
  campaign &&
  normalizeStatus(campaign.status) === 'active' &&
  (!campaign.deadline || new Date(campaign.deadline).getTime() >= Date.now());

function respondPaymentConfigurationError(res, error) {
  if (error instanceof PaymentConfigurationError) {
    res.status(503).json({ message: error.message });
    return true;
  }
  return false;
}

function publicOrder(order) {
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt,
    provider: order.provider,
    ...(order.provider === 'razorpay' ? { keyId: order.keyId } : {})
  };
}

async function getDonationWithCampaign(donationId) {
  return Donation.findById(donationId)
    .populate({ path: 'campaignId', select: campaignSelect })
    .select('-paymentSignature');
}

export async function createDonationOrder(req, res, next) {
  try {
    let paymentProvider;
    try {
      paymentProvider = getPaymentProvider();
    } catch (error) {
      if (respondPaymentConfigurationError(res, error)) return;
      throw error;
    }

    const { campaignId, amount } = req.body;
    const campaign = await Campaign.findById(campaignId).select(campaignSelect);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (!isCampaignOpen(campaign)) {
      return res.status(409).json({ message: 'This campaign is not accepting donations' });
    }

    const receipt = `cc_${Date.now().toString(36)}_${req.user._id.toString().slice(-8)}`;
    const donation = await Donation.create({
      campaignId: campaign._id,
      donor: req.user._id,
      amount,
      currency: 'INR',
      paymentProvider: paymentProvider.provider,
      receipt,
      status: 'pending'
    });

    try {
      const order = await createPaymentOrder({
        amount,
        currency: 'INR',
        receipt,
        notes: { campaignId: campaign._id.toString(), donorId: req.user._id.toString() }
      });
      donation.orderId = order.id;
      await donation.save();

      return res.status(201).json({
        donation: donation.toJSON(),
        order: publicOrder(order)
      });
    } catch (error) {
      donation.status = 'failed';
      donation.failureReason = 'Unable to create a payment order';
      await donation.save();
      if (respondPaymentConfigurationError(res, error)) return;
      console.error('Unable to create payment order', error);
      return res.status(502).json({ message: 'Unable to start payment checkout. Please try again.' });
    }
  } catch (error) {
    next(error);
  }
}

export async function verifyDonationPayment(req, res, next) {
  try {
    const { campaignId, orderId, paymentId, signature } = req.body;
    const donation = await Donation.findOne({ orderId, donor: req.user._id });
    if (!donation) return res.status(404).json({ message: 'Payment order not found' });
    if (campaignId && donation.campaignId.toString() !== campaignId) {
      return res.status(400).json({ message: 'The campaign does not match this payment order' });
    }

    if (donation.status === 'success') {
      const completedDonation = await getDonationWithCampaign(donation._id);
      return res.json({
        message: 'Payment was already confirmed',
        donation: completedDonation,
        campaign: completedDonation.campaignId,
        goalReached: normalizeStatus(completedDonation.campaignId?.status) === 'closed'
      });
    }
    if (donation.status === 'processing') {
      return res.status(409).json({ message: 'This payment is already being confirmed. Please refresh in a moment.' });
    }
    if (donation.status === 'failed') {
      return res.status(409).json({ message: 'This payment order is no longer valid. Start a new donation.' });
    }

    let signatureIsValid;
    try {
      signatureIsValid = verifyPaymentSignature({
        provider: donation.paymentProvider,
        orderId,
        paymentId,
        signature
      });
    } catch (error) {
      if (respondPaymentConfigurationError(res, error)) return;
      throw error;
    }
    if (!signatureIsValid) return res.status(400).json({ message: 'Payment signature verification failed' });

    // Claim the pending order first. This prevents duplicate browser requests
    // from incrementing the campaign total more than once.
    const claimedDonation = await Donation.findOneAndUpdate(
      { _id: donation._id, status: 'pending' },
      {
        $set: {
          status: 'processing',
          // Reserve the gateway payment id before raising the campaign amount.
          // Its unique index prevents a successful gateway payment from being
          // reused against a second donation.
          paymentId,
          paymentSignature: signature || undefined
        }
      },
      { new: true }
    );
    if (!claimedDonation) {
      const currentDonation = await Donation.findById(donation._id);
      if (currentDonation?.status === 'success') {
        const completedDonation = await getDonationWithCampaign(donation._id);
        return res.json({
          message: 'Payment was already confirmed',
          donation: completedDonation,
          campaign: completedDonation.campaignId,
          goalReached: normalizeStatus(completedDonation.campaignId?.status) === 'closed'
        });
      }
      return res.status(409).json({ message: 'This payment is already being confirmed. Please refresh in a moment.' });
    }

    // The pipeline both increments the amount and transitions the campaign to
    // closed using the updated amount. It is atomic at the campaign document.
    const now = new Date();
    const campaign = await Campaign.findOneAndUpdate(
      {
        _id: claimedDonation.campaignId,
        status: { $in: ACTIVE_STATUSES },
        $or: [{ deadline: { $gte: now } }, { deadline: null }, { deadline: { $exists: false } }]
      },
      [
        {
          $set: {
            raisedAmount: {
              $round: [{ $add: [{ $ifNull: ['$raisedAmount', 0] }, claimedDonation.amount] }, 2]
            }
          }
        },
        {
          $set: {
            status: {
              $cond: [
                { $gte: ['$raisedAmount', { $ifNull: ['$goalAmount', Number.MAX_SAFE_INTEGER] }] },
                'closed',
                '$status'
              ]
            }
          }
        }
      ],
      { new: true }
    );

    if (!campaign) {
      await Donation.updateOne(
        { _id: claimedDonation._id, status: 'processing' },
        { $set: { status: 'pending' }, $unset: { paymentId: 1, paymentSignature: 1 } }
      );
      return res.status(409).json({ message: 'This campaign is no longer accepting donations' });
    }

    const completedDonation = await Donation.findOneAndUpdate(
      { _id: claimedDonation._id, status: 'processing' },
      {
        $set: {
          status: 'success',
          paidAt: now
        },
        $unset: { failureReason: 1 }
      },
      { new: true }
    );

    if (!completedDonation) {
      // This is deliberately loud: campaign amount has already been updated
      // and the pending donation needs operational reconciliation.
      console.error(`Donation ${claimedDonation._id} was charged but could not be marked as successful`);
      return res.status(500).json({ message: 'Payment confirmation is being reconciled. Please check your donation history shortly.' });
    }

    await User.updateOne({ _id: req.user._id }, { $addToSet: { donations: completedDonation._id } });
    const populatedDonation = await getDonationWithCampaign(completedDonation._id);
    const goalReached = normalizeStatus(campaign.status) === 'closed';

    if (goalReached) {
      const campaignCreator = await Campaign.findById(campaign._id).populate('creator', 'name email');
      if (campaignCreator?.creator?.email) {
        void sendCampaignStatusEmail({
          type: 'goalReached',
          to: campaignCreator.creator.email,
          recipientName: campaignCreator.creator.name,
          campaignTitle: campaignCreator.title
        });
      }
    }

    return res.json({
      message: 'Payment confirmed. Thank you for your donation!',
      donation: populatedDonation,
      campaign,
      goalReached
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'This payment has already been recorded' });
    }
    next(error);
  }
}

function paginationFrom(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export async function getDonationHistory(req, res, next) {
  try {
    const { page, limit, skip } = paginationFrom(req.query);
    const query = { donor: req.user._id };
    const [donations, total] = await Promise.all([
      Donation.find(query)
        .populate({ path: 'campaignId', select: 'title bannerImage goalAmount raisedAmount status' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-paymentSignature'),
      Donation.countDocuments(query)
    ]);
    return res.json({ donations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function getCampaignDonationHistory(req, res, next) {
  try {
    const { page, limit, skip } = paginationFrom(req.query);
    const query = { campaignId: req.params.campaignId, status: 'success' };
    const [donations, total] = await Promise.all([
      Donation.find(query)
        .populate({ path: 'donor', select: 'name' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('donor amount currency paymentId status createdAt'),
      Donation.countDocuments(query)
    ]);
    return res.json({ donations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}
