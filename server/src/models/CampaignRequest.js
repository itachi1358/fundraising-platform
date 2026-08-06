import mongoose from 'mongoose';

const { Schema } = mongoose;

const campaignDataSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    goalAmount: { type: Number, required: true, min: 1, max: 100000000 },
    deadline: { type: Date, required: true },
    bannerImage: { type: String, trim: true, maxlength: 2048, default: undefined },
    documents: { type: [{ type: String, trim: true, maxlength: 2048 }], default: [] },
    upiId: { type: String, trim: true, maxlength: 160 },
    bankDetails: { type: String, trim: true, maxlength: 1000 },
    contactNumber: { type: String, required: true, trim: true, maxlength: 25 },
    reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 }
  },
  { _id: false }
);

const campaignRequestSchema = new Schema(
  {
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campaignData: { type: campaignDataSchema, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    adminRemarks: { type: String, trim: true, maxlength: 1000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign' }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false }
  }
);

campaignRequestSchema.index({ status: 1, createdAt: -1 });
campaignRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export default mongoose.model('CampaignRequest', campaignRequestSchema);
