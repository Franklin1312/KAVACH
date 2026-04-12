const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const Policy   = require('../models/Policy');
const Worker   = require('../models/Worker');
const AuditLog = require('../models/AuditLog');
const { calculatePremium }            = require('../services/premiumService');
const { notifyPolicyActivated }       = require('../services/notificationService');
const { createPremiumSubscription }   = require('../services/paymentService');
const { findActivePolicyForWorker }   = require('../services/policyAccessService');

function getCurrentWeekWindow() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 1, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 0);
  return { weekStart, weekEnd };
}

// GET /api/policies/quote
router.get('/quote', protect, async (req, res) => {
  try {
    const { tier } = req.query;
    const worker   = req.worker;
    const result = calculatePremium({
      weeklyIncome:    worker.verifiedWeeklyIncome || worker.declaredWeeklyIncome,
      zoneRiskFactor:  worker.zoneRiskFactor,
      city:            worker.city,
      claimsFreeWeeks: worker.claimsFreeWeeks,
      tier:            tier || 'standard',
    });
    res.json({ success: true, quote: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/policies
router.get('/', protect, async (req, res) => {
  try {
    const policies = await Policy.find({ worker: req.worker._id }).sort({ createdAt: -1 });
    res.json({ success: true, policies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/policies/active
router.get('/active', protect, async (req, res) => {
  try {
    const now = new Date();
    const policy = await findActivePolicyForWorker(req.worker._id, now);

    if (!policy) {
      await Policy.updateMany(
        {
          worker: req.worker._id,
          status: 'active',
          weekEnd: { $lt: now },
        },
        { status: 'expired' }
      );
    }

    res.json({ success: true, policy: policy || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/policies
router.post('/', protect, async (req, res) => {
  try {
    const { tier } = req.body;
    const worker   = req.worker;
    const { weekStart, weekEnd } = getCurrentWeekWindow();

    const existing = await findActivePolicyForWorker(worker._id, new Date());
    if (existing) return res.status(400).json({ error: 'You already have an active policy this week', policy: existing });

    const { breakdown, finalAmount, coveragePct, maxPayout, tier: selectedTier } =
      calculatePremium({
        weeklyIncome:    worker.verifiedWeeklyIncome || worker.declaredWeeklyIncome,
        zoneRiskFactor:  worker.zoneRiskFactor,
        city:            worker.city,
        claimsFreeWeeks: worker.claimsFreeWeeks,
        tier:            tier || 'standard',
      });

    // Create Razorpay subscription
    const subscription = await createPremiumSubscription(worker, finalAmount).catch(() => ({ id: null }));

    // Create a Razorpay Order for the frontend checkout popup
    const Razorpay = require('razorpay');
    const isMock = process.env.ENABLE_MOCK === 'true';
    let razorpayOrder = null;

    if (!isMock) {
      try {
        const rzp = new Razorpay({
          key_id:     process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        razorpayOrder = await rzp.orders.create({
          amount:   Math.round(finalAmount * 100), // paise
          currency: 'INR',
          receipt:  `kavach_${Date.now()}`,
          notes:    { worker_id: worker._id.toString(), tier: selectedTier },
        });
      } catch (orderErr) {
        console.error('Razorpay order creation failed:', orderErr.message);
      }
    }

    const policy = await Policy.create({
      worker: worker._id, tier: selectedTier, coveragePct,
      premium: {
        baseRate:           parseFloat(breakdown.baseRate),
        zoneRiskFactor:     breakdown.zoneRiskFactor,
        seasonMultiplier:   breakdown.seasonMultiplier,
        claimsFreeDiscount: parseFloat(breakdown.claimsFreeDiscount),
        surgeLoading:       breakdown.surgeLoading,
        tierMultiplier:     breakdown.tierMultiplier,
        finalAmount,
      },
      weekStart, weekEnd, maxPayout, status: 'active',
      razorpaySubscriptionId: subscription?.id,
      premiumPaid: isMock ? true : false, // Will be set true via webhook or checkout handler
    });

    // WhatsApp notification
    await notifyPolicyActivated(worker, policy).catch(() => {});

    await AuditLog.create({
      worker: worker._id, event: 'POLICY_CREATED',
      meta: { policyId: policy._id, tier: selectedTier, finalAmount, maxPayout },
    });

    res.status(201).json({
      success: true,
      policy,
      // Frontend uses these to launch Razorpay Checkout
      razorpayOrder: razorpayOrder ? {
        orderId: razorpayOrder.id,
        amount:  razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId:   process.env.RAZORPAY_KEY_ID,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/policies/:id/cancel
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const policy = await Policy.findOne({ _id: req.params.id, worker: req.worker._id });
    if (!policy)                    return res.status(404).json({ error: 'Policy not found' });
    if (policy.status !== 'active') return res.status(400).json({ error: 'Policy is not active' });
    policy.status = 'cancelled';
    await policy.save();
    await AuditLog.create({ worker: req.worker._id, event: 'POLICY_CANCELLED', meta: { policyId: policy._id } });
    res.json({ success: true, message: 'Policy cancelled', policy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
