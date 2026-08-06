import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true
    },
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', uppercase: true, trim: true, maxlength: 3 },
    paymentProvider: { type: String, enum: ['razorpay', 'mock'], required: true },
    orderId: { type: String, unique: true, sparse: true, trim: true },
    paymentId: { type: String, unique: true, sparse: true, trim: true },
    paymentSignature: { type: String, select: false },
    receipt: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed'],
      default: 'pending',
      index: true
    },
    failureReason: { type: String, trim: true, maxlength: 500 },
    paidAt: Date
  },
  { timestamps: true }
);

donationSchema.index({ donor: 1, createdAt: -1 });
donationSchema.index({ campaignId: 1, createdAt: -1 });

donationSchema.set('toJSON', {
  transform: (_document, returned) => {
    delete returned.paymentSignature;
    delete returned.__v;
    return returned;
  }
});

export default mongoose.model('Donation', donationSchema);
