const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    policy: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true },

    triggerType: {
      type: String,
      enum: ['rain', 'aqi', 'flood', 'curfew', 'platform_outage', 'zone_freeze', 'heat'],
      required: true,
    },
    triggerLevel: { type: Number, enum: [1, 2, 3, 4], required: true },

    triggerSources: [
      {
        source:      String,
        value:       String,
        confirmedAt: Date,
      },
    ],

    disruptionStart: { type: Date, required: true },
    disruptionEnd:   { type: Date },
    windowSummary: {
      verifiedDisruptionWindow: {
        start: Date,
        end: Date,
        durationMinutes: Number,
        methodology: String,
      },
      eligibleWorkWindow: {
        start: Date,
        end: Date,
        totalEligibleMinutes: Number,
      },
      finalLossWindow: {
        start: Date,
        end: Date,
        totalEligibleMinutes: Number,
      },
    },

    predictedLoss: { type: Number, required: true },
    actualEarned:  { type: Number, default: 0 },
    netLoss:       { type: Number, required: true },
    payoutAmount:  { type: Number, required: true },

    payoutStatus: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected', 'manual_review'],
      default: 'pending',
    },

    razorpayPayoutId: String,
    paidAt:           Date,

    fraudScore:  { type: Number, default: 0 },
    ppcsScore:   { type: Number, default: 100 },
    fraudFlags:  [String],
    reviewNotes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Claim', ClaimSchema);
