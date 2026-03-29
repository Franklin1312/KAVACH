const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const Policy   = require('../models/Policy');
const Worker   = require('../models/Worker');
const AuditLog = require('../models/AuditLog');
const { calculatePremium }            = require('../services/premiumService');
const { notifyPolicyActivated }       = require('../services/notificationService');
const { createPremiumSubscription }   = require('../services/paymentService');

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
    const policy = await Policy.findOne({ worker: req.worker._id, status: 'active' });
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

    const existing = await Policy.findOne({ worker: worker._id, status: 'active', weekStart: { $gte: weekStart } });
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
      premiumPaid: false,
    });

    // WhatsApp notification
    await notifyPolicyActivated(worker, policy).catch(() => {});

    await AuditLog.create({
      worker: worker._id, event: 'POLICY_CREATED',
      meta: { policyId: policy._id, tier: selectedTier, finalAmount, maxPayout },
    });

    res.status(201).json({ success: true, policy });
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
