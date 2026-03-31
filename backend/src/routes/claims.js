const express    = require('express');
const router     = express.Router();
const { protect }         = require('../middleware/auth');
const Claim               = require('../models/Claim');
const Policy              = require('../models/Policy');
const Worker              = require('../models/Worker');
const AuditLog            = require('../models/AuditLog');
const { predictEarnings } = require('../services/ditService');
const { calculateFraudScore, getPayoutDecision } = require('../services/fraudService');
const { LEVEL_MULTIPLIERS } = require('../services/triggerService');
const { processPayout }   = require('../services/paymentService');
const {
  notifyClaimAutoApproved,
  notifyClaimSoftFlag,
  notifyClaimVerificationNeeded,
  notifyClaimManualReview,
} = require('../services/notificationService');

// GET /api/claims
router.get('/', protect, async (req, res) => {
  try {
    const claims = await Claim.find({ worker: req.worker._id })
      .populate('policy', 'tier coveragePct weekStart weekEnd')
      .sort({ createdAt: -1 });
    res.json({ success: true, claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/claims/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, worker: req.worker._id }).populate('policy');
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json({ success: true, claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/claims/auto-process
router.post('/auto-process', protect, async (req, res) => {
  try {
    const { triggerType, triggerLevel, triggerSources, disruptionStart, disruptionEnd, actualEarned, deviceSignals } = req.body;
    const worker = req.worker;

    const now = new Date();
    const policy = await Policy.findOne({
      worker: worker._id,
      status: 'active',
      weekStart: { $lte: now },
      weekEnd: { $gte: now },
    });
    if (!policy) return res.status(400).json({ error: 'No active policy found' });

    const windowStart   = disruptionStart ? new Date(disruptionStart) : new Date(Date.now() - 2 * 60 * 60 * 1000);
    const windowEnd     = disruptionEnd   ? new Date(disruptionEnd)   : new Date();
    const predictedLoss = await predictEarnings(worker, windowStart, windowEnd);
    const earned        = actualEarned || 0;
    const netLoss       = Math.max(0, predictedLoss - earned);

    if (netLoss === 0)
      return res.status(400).json({ error: 'No net income loss detected' });

    const levelMultiplier = LEVEL_MULTIPLIERS[triggerLevel] || 1.0;
    const payoutAmount    = Math.round(policy.coveragePct * netLoss * levelMultiplier);

    const { score: fraudScore, flags: fraudFlags, ppcs } = await calculateFraudScore(
      worker, policy, { triggerType, actualEarned: earned, predictedLoss, deviceSignals }
    );

    const { action, tier, message } = getPayoutDecision(fraudScore, ppcs);

    const payoutStatus = action === 'auto_approve' ? 'approved'
                       : action === 'soft_flag'    ? 'approved'
                       : action === 'verify'       ? 'pending'
                       : 'manual_review';

    const claim = await Claim.create({
      worker: worker._id, policy: policy._id,
      triggerType: triggerType || 'rain', triggerLevel: triggerLevel || 1,
      triggerSources: triggerSources || [],
      disruptionStart: windowStart, disruptionEnd: windowEnd,
      predictedLoss, actualEarned: earned, netLoss,
      payoutAmount, payoutStatus, fraudScore, ppcsScore: ppcs, fraudFlags,
    });

    // Handle payout + notifications
    if (action === 'auto_approve') {
      const payout = await processPayout(worker, payoutAmount, claim._id);
      claim.payoutStatus     = 'paid';
      claim.razorpayPayoutId = payout.id;
      claim.paidAt           = new Date();
      await claim.save();
      await notifyClaimAutoApproved(worker, claim, payout).catch(() => {});
      await Worker.findByIdAndUpdate(worker._id, { claimsFreeWeeks: 0 });

    } else if (action === 'soft_flag') {
      await notifyClaimSoftFlag(worker, claim).catch(() => {});
      setTimeout(async () => {
        try {
          const payout = await processPayout(worker, payoutAmount, claim._id);
          claim.payoutStatus = 'paid'; claim.razorpayPayoutId = payout.id; claim.paidAt = new Date();
          await claim.save();
          await notifyClaimAutoApproved(worker, claim, payout).catch(() => {});
        } catch (e) { console.error('Delayed payout error:', e.message); }
      }, 2 * 60 * 60 * 1000);

    } else if (action === 'verify') {
      await notifyClaimVerificationNeeded(worker, claim).catch(() => {});
    } else {
      await notifyClaimManualReview(worker, claim).catch(() => {});
    }

    await AuditLog.create({
      worker: worker._id, event: 'CLAIM_PROCESSED',
      meta: { claimId: claim._id, triggerType, payoutAmount, fraudScore, ppcs, action },
    });

    res.status(201).json({
      success: true, claim,
      decision: { action, tier, message },
      breakdown: { predictedLoss, actualEarned: earned, netLoss, coveragePct: policy.coveragePct, levelMultiplier, payoutAmount, fraudScore, ppcs },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/claims/:id/verify
router.put('/:id/verify', protect, async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, worker: req.worker._id });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    const payout = await processPayout(req.worker, claim.payoutAmount, claim._id);
    claim.payoutStatus     = 'paid';
    claim.razorpayPayoutId = payout.id;
    claim.paidAt           = new Date();
    claim.reviewNotes      = 'Photo verification passed';
    await claim.save();

    await notifyClaimAutoApproved(req.worker, claim, payout).catch(() => {});
    res.json({ success: true, message: 'Verification accepted — payout processing', claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
