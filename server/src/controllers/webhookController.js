import Campaign from '../models/Campaign.js';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import { PaymentConfigurationError, verifyWebhookSignature } from '../services/paymentService.js';
import { sendCampaignStatusEmail } from '../utils/email.js';

async function settleCapturedDonation(donation, payment) {
  const now = new Date();
  const campaign = await Campaign.findOneAndUpdate(
    {
      _id: donation.campaignId,
      status: 'active',
      $or: [{ deadline: { $gte: now } }, { deadline: null }, { deadline: { $exists: false } }]
    },
    [
      { $set: { raisedAmount: { $round: [{ $add: [{ $ifNull: ['$raisedAmount', 0] }, donation.amount] }, 2] } } },
      { $set: { status: { $cond: [{ $gte: ['$raisedAmount', '$goalAmount'] }, 'closed', '$status'] } } }
    ],
    { new: true }
  );
  if (!campaign) {
    await Donation.updateOne({ _id: donation._id, status: 'processing' }, { $set: { status: 'pending' } });
    return;
  }
  const completed = await Donation.findOneAndUpdate(
    { _id: donation._id, status: 'processing' },
    { $set: { status: 'success', paymentId: payment.id, paidAt: now }, $unset: { failureReason: 1 } },
    { new: true }
  );
  if (!completed) return;
  await User.updateOne({ _id: donation.donor }, { $addToSet: { donations: completed._id } });
  if (campaign.status === 'closed') {
    const creator = await User.findById(campaign.creator).select('name email');
    if (creator?.email) void sendCampaignStatusEmail({ type: 'goalReached', to: creator.email, recipientName: creator.name, campaignTitle: campaign.title });
  }
}

// Razorpay sends this endpoint a signed raw JSON body. It deliberately does
// not rely on the client-side callback, which may be lost when a browser tab
// closes after a successful payment.
export async function handleRazorpayWebhook(req, res) {
  try {
    const signature = req.get('x-razorpay-signature');
    if (!verifyWebhookSignature(req.body, signature)) return res.status(400).json({ message: 'Invalid webhook signature' });
    const event = JSON.parse(req.body.toString('utf8'));
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id) return res.status(200).json({ received: true });

    if (event.event === 'payment.failed') {
      await Donation.updateOne(
        { orderId: payment.order_id, status: { $in: ['pending', 'processing'] } },
        { $set: { status: 'failed', failureReason: payment.error_description || 'Payment failed' } }
      );
      return res.status(200).json({ received: true });
    }

    if (event.event !== 'payment.captured' || payment.status !== 'captured') return res.status(200).json({ received: true });
    const donation = await Donation.findOne({ orderId: payment.order_id, paymentProvider: 'razorpay' });
    if (!donation || donation.status === 'success') return res.status(200).json({ received: true });
    if (Number(payment.amount) !== Math.round(donation.amount * 100) || payment.currency !== donation.currency) {
      console.error(`Razorpay webhook amount mismatch for order ${payment.order_id}`);
      return res.status(400).json({ message: 'Payment amount mismatch' });
    }
    const claimed = await Donation.findOneAndUpdate(
      { _id: donation._id, status: 'pending' },
      { $set: { status: 'processing' } },
      { new: true }
    );
    if (claimed) await settleCapturedDonation(claimed, payment);
    return res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof PaymentConfigurationError) return res.status(503).json({ message: error.message });
    console.error('Razorpay webhook processing failed', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
}
