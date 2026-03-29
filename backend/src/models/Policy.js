const mongoose = require('mongoose');

const PolicySchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },

    tier:        { type: String, enum: ['basic', 'standard', 'premium'], default: 'standard' },
    coveragePct: { type: Number, enum: [0.5, 0.7, 0.85], default: 0.7 },

    premium: {
      baseRate:            Number,
      zoneRiskFactor:      Number,
      seasonMultiplier:    Number,
      claimsFreeDiscount:  Number,
      surgeLoading:        Number,
      tierMultiplier:      Number,
      finalAmount:         { type: Number, required: true },
    },

    weekStart:  { type: Date, required: true },
    weekEnd:    { type: Date, required: true },
    maxPayout:  { type: Number, required: true },

    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },

    razorpaySubscriptionId: String,
    premiumPaid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Policy', PolicySchema);
