import mongoose from 'mongoose';

const { Schema } = mongoose;

const campaignSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    goalAmount: { type: Number, required: true, min: 1, max: 100000000 },
    // raisedAmount is the canonical persisted total. currentAmount is exposed
    // as a virtual below for compatibility with clients that use that name.
    raisedAmount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'closed', 'rejected', 'stopped'],
      default: 'active',
      index: true
    },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bannerImage: { type: String, trim: true, maxlength: 2048, default: undefined },
    // Supporting documents and payout details are intentionally not selected
    // by public campaign queries.
    documents: { type: [{ type: String, trim: true, maxlength: 2048 }], default: [], select: false },
    // Gallery photos shown on the public campaign page.
    photos: { type: [{ type: String, trim: true, maxlength: 2048 }], default: [] },
    // Admin-approved subset of `documents` that is safe to display publicly.
    publicDocuments: { type: [{ type: String, trim: true, maxlength: 2048 }], default: [] },
    upiId: { type: String, trim: true, maxlength: 160, select: false },
    bankDetails: { type: String, trim: true, maxlength: 1000, select: false },
    contactNumber: { type: String, trim: true, maxlength: 25 },
    reason: { type: String, trim: true, maxlength: 3000 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    stoppedAt: Date,
    resumedAt: Date,
    closedAt: Date,
    adminRemarks: { type: String, trim: true, maxlength: 1000, select: false }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false }
  }
);

campaignSchema.index({ status: 1, deadline: 1 });
campaignSchema.index({ creator: 1, createdAt: -1 });

campaignSchema.virtual('currentAmount')
  .get(function getCurrentAmount() {
    return this.raisedAmount;
  })
  .set(function setCurrentAmount(value) {
    this.raisedAmount = value;
  });

campaignSchema.pre('validate', function closeWhenGoalIsReached(next) {
  if (
    this.goalAmount != null &&
    this.raisedAmount >= this.goalAmount &&
    ['active', 'stopped'].includes(this.status)
  ) {
    this.status = 'closed';
    this.closedAt ||= new Date();
  }
  next();
});

// Donation processing can call this after its atomic increment. It also makes
// reads resilient if an earlier payment update did not run the lifecycle step.
campaignSchema.statics.closeEligibleCampaigns = async function closeEligibleCampaigns() {
  const now = new Date();
  await Promise.all([
    this.updateMany(
      { status: 'active', deadline: { $lte: now } },
      { $set: { status: 'closed', closedAt: now } }
    ),
    this.updateMany(
      {
        status: { $in: ['active', 'stopped'] },
        $expr: { $gte: ['$raisedAmount', '$goalAmount'] }
      },
      { $set: { status: 'closed', closedAt: now } }
    )
  ]);
};

export default mongoose.model('Campaign', campaignSchema);
