import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    // New signups start unverified (register() sets this to false explicitly).
    // Defaults to true so pre-existing accounts remain verified.
    isVerified: { type: Boolean, default: true },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date },
    otpResendAt: { type: Date },
    otpAttempts: { type: Number, default: 0 },
    createdCampaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }],
    donations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Donation' }]
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
