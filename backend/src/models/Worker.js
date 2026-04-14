const mongoose = require('mongoose');

const WorkerSchema = new mongoose.Schema(
  {
    phone:        { type: String, required: true, unique: true, trim: true },
    name:         { type: String, trim: true },
    aadhaarLast4: { type: String },
    upiId:        { type: String, trim: true },

    platforms: [
      {
        name:      { type: String, enum: ['zomato', 'swiggy', 'blinkit'] },
        partnerId: { type: String },
        verified:  { type: Boolean, default: false },
      },
    ],

    city: {
      type: String,
      enum: [
        'chennai', 'mumbai', 'delhi', 'bengaluru',
        'hyderabad', 'pune', 'kolkata', 'ahmedabad',
        'jaipur', 'lucknow', 'surat', 'kochi',
        'chandigarh', 'indore', 'nagpur', 'coimbatore',
      ],
    },
    zone: { type: String },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },

    declaredWeeklyIncome: { type: Number },
    verifiedWeeklyIncome: { type: Number },
    workingHours: {
      type: String,
      enum: ['part', 'full', 'extended'],
      default: 'full',
    },
    usualShiftStart: { type: String, default: '10:00' },
    usualShiftEnd:   { type: String, default: '20:00' },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5, 6],
      validate: {
        validator: (days) => Array.isArray(days) && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        message: 'workingDays must be integers between 0 and 6',
      },
    },

    zoneRiskFactor:  { type: Number, default: 1.0 },
    fraudScore:      { type: Number, default: 0 },
    claimsFreeWeeks: { type: Number, default: 0 },

    // Per-worker behavioral baseline (updated weekly by cron)
    avgOrdersPerHour:   { type: Number, default: null },
    avgEarningsPerHour: { type: Number, default: null },
    lastBaselineUpdate: { type: Date },

    otp:       { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: true },

    // SS Code 2020 — 90/120-day engagement tracking
    platformActiveDays: { type: Number, default: 0 },
    engagementQualified: { type: Boolean, default: false }, // true if >= 90 days (single) or 120 days (multi)

    // DPDP Act 2023 — consent audit trail
    dpdpConsent: {
      gps:       { type: Boolean, default: false },
      bank:      { type: Boolean, default: false },
      platform:  { type: Boolean, default: false },
      consentedAt: { type: Date },
    },
  },
  { timestamps: true }
);

WorkerSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Worker', WorkerSchema);
