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

    city: { type: String, enum: ['chennai', 'mumbai', 'delhi', 'bengaluru'] },
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

    zoneRiskFactor:  { type: Number, default: 1.0 },
    fraudScore:      { type: Number, default: 0 },
    claimsFreeWeeks: { type: Number, default: 0 },

    otp:       { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

WorkerSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Worker', WorkerSchema);
