const express  = require('express');
const router   = express.Router();
const Worker   = require('../models/Worker');
const Policy   = require('../models/Policy');
const Claim    = require('../models/Claim');
const AuditLog = require('../models/AuditLog');
const { processPayout }          = require('../services/paymentService');
const { notifyClaimAutoApproved, notifyClaimManualReview } = require('../services/notificationService');

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      totalWorkers, activePolicies, totalClaims,
      paidClaims, pendingClaims, rejectedClaims,
      premiumData, payoutData,
    ] = await Promise.all([
      Worker.countDocuments({ isVerified: true }),
      Policy.countDocuments({ status: 'active' }),
      Claim.countDocuments(),
      Claim.countDocuments({ payoutStatus: 'paid' }),
      Claim.countDocuments({ payoutStatus: { $in: ['pending', 'manual_review'] } }),
      Claim.countDocuments({ payoutStatus: 'rejected' }),
      Policy.aggregate([{ $group: { _id: null, total: { $sum: '$premium.finalAmount' } } }]),
      Claim.aggregate([{ $match: { payoutStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$payoutAmount' } } }]),
    ]);

    const totalPremiums = premiumData[0]?.total || 0;
    const totalPayouts  = payoutData[0]?.total  || 0;
    const bcr           = totalPremiums > 0 ? totalPayouts / totalPremiums : 0;
    const bcrPct        = (bcr * 100).toFixed(1);
    const bcrSuspend    = bcr > 0.85;

    const claimsByType = await Claim.aggregate([
      { $group: { _id: '$triggerType', count: { $sum: 1 }, totalPayout: { $sum: '$payoutAmount' } } },
      { $sort: { count: -1 } },
    ]);

    const claimsByCity = await Claim.aggregate([
      { $lookup: { from: 'workers', localField: 'worker', foreignField: '_id', as: 'w' } },
      { $unwind: '$w' },
      { $group: { _id: '$w.city', count: { $sum: 1 }, totalPayout: { $sum: '$payoutAmount' } } },
      { $sort: { count: -1 } },
    ]);

    const fraudDist = await Claim.aggregate([
      { $bucket: { groupBy: '$fraudScore', boundaries: [0, 30, 61, 81, 101], default: 'other', output: { count: { $sum: 1 } } } },
    ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyClaims  = await Claim.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, totalPayout: { $sum: '$payoutAmount' } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalWorkers, activePolicies, totalClaims,
        paidClaims, pendingClaims, rejectedClaims,
        totalPremiums, totalPayouts,
        bcr: parseFloat(bcr.toFixed(4)),
        bcrPct: parseFloat(bcrPct),
        bcrSuspend,
        lossRatio: parseFloat(bcrPct),
        fraudDetectionRate: totalClaims > 0 ? ((rejectedClaims / totalClaims) * 100).toFixed(1) : 0,
      },
      claimsByType, claimsByCity, fraudDist, dailyClaims,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/claims ────────────────────────────────────────────────────
router.get('/claims', async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('worker', 'name phone city zone upiId')
      .populate('policy',  'tier coveragePct')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/workers ───────────────────────────────────────────────────
router.get('/workers', async (req, res) => {
  try {
    const workers = await Worker.find({ isVerified: true })
      .select('name phone city zone platforms declaredWeeklyIncome zoneRiskFactor fraudScore claimsFreeWeeks createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, workers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/claims/:id/approve ────────────────────────────────────────
router.put('/claims/:id/approve', async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    const claim = await Claim.findById(req.params.id).populate('worker').populate('policy');
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    if (claim.payoutStatus === 'paid')
      return res.status(400).json({ error: 'Claim already paid' });
    if (!claim.policy?.premiumPaid)
      return res.status(400).json({ error: 'Policy premium is not marked as paid yet' });

    const [reserved] = await Claim.aggregate([
      {
        $match: {
          policy: claim.policy._id,
          _id: { $ne: claim._id },
          payoutStatus: { $in: ['approved', 'paid', 'pending', 'manual_review'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$payoutAmount' } } },
    ]);
    const remainingCoverage = Math.max(0, claim.policy.maxPayout - (reserved?.total || 0));
    if (remainingCoverage <= 0)
      return res.status(400).json({ error: 'Policy weekly max payout has already been exhausted' });

    const worker = claim.worker;
    claim.payoutAmount = Math.min(claim.payoutAmount, remainingCoverage);
    const payout = await processPayout(worker, claim.payoutAmount, claim._id);

    // Handle rollback scenario
    if (payout.status === 'rollback' || payout.status === 'hold') {
      claim.payoutStatus = 'pending';
      claim.reviewNotes  = `Manual approval attempted — payout failed: ${payout.reason}. Will retry.`;
      await claim.save();
      return res.json({ success: false, message: 'Payout failed — marked for retry', payout });
    }

    claim.payoutStatus     = 'paid';
    claim.razorpayPayoutId = payout.id;
    claim.paidAt           = new Date();
    claim.reviewNotes      = reviewNotes || 'Manually approved by admin';
    await claim.save();

    await notifyClaimAutoApproved(worker, claim, payout).catch(() => {});

    await AuditLog.create({
      worker: worker._id,
      event:  'CLAIM_MANUALLY_APPROVED',
      meta:   { claimId: claim._id, payoutAmount: claim.payoutAmount, reviewNotes },
    });

    res.json({ success: true, message: `₹${claim.payoutAmount} payout processed`, claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/claims/:id/reject ────────────────────────────────────────
router.put('/claims/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const claim = await Claim.findById(req.params.id).populate('worker');
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    if (claim.payoutStatus === 'paid')
      return res.status(400).json({ error: 'Cannot reject a paid claim' });

    claim.payoutStatus = 'rejected';
    claim.reviewNotes  = reason || 'Rejected by admin after manual review';
    await claim.save();

    // Notify worker
    const worker = claim.worker;
    const msg =
      `❌ *KAVACH — Claim Update*\n\n` +
      `Your claim of ₹${claim.payoutAmount} has not been approved after review.\n\n` +
      `Reason: ${reason || 'Did not meet verification criteria'}\n\n` +
      `If you believe this is incorrect, reply to this message to appeal.\n\n` +
      `_KAVACH Support Team_ ⛨`;

    const { sendMessage } = require('../services/notificationService');
    await sendMessage(worker.phone, msg).catch(() => {});

    await AuditLog.create({
      worker: worker._id,
      event:  'CLAIM_MANUALLY_REJECTED',
      meta:   { claimId: claim._id, reason },
    });

    res.json({ success: true, message: 'Claim rejected', claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/stress-test ──────────────────────────────────────────────
// Simulate 14-day monsoon — project BCR impact
router.post('/stress-test', async (req, res) => {
  try {
    const { days = 14, triggerType = 'rain', affectedPct = 0.7 } = req.body;

    const activePolicies = await Policy.find({ status: 'active' })
      .populate('worker', 'verifiedWeeklyIncome declaredWeeklyIncome coveragePct city');

    const totalPolicies   = activePolicies.length;
    const affectedCount   = Math.round(totalPolicies * affectedPct);

    // Average daily income = weekly / 6
    const avgDailyIncome  = activePolicies.reduce((sum, p) => {
      const income = p.worker?.verifiedWeeklyIncome || p.worker?.declaredWeeklyIncome || 5000;
      return sum + (income / 6);
    }, 0) / (totalPolicies || 1);

    // Payout per affected worker per day = coveragePct × daily income × level multiplier
    const avgCoveragePct     = 0.70;
    const levelMultiplier    = 0.85; // average of Level 2 + 3
    const payoutPerWorkerDay = avgDailyIncome * avgCoveragePct * levelMultiplier;
    const totalProjectedPayout = affectedCount * payoutPerWorkerDay * days;

    // Current premiums collected
    const premiumData     = await Policy.aggregate([{ $group: { _id: null, total: { $sum: '$premium.finalAmount' } } }]);
    const totalPremiums   = premiumData[0]?.total || 0;

    // Existing payouts
    const payoutData      = await Claim.aggregate([{ $match: { payoutStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$payoutAmount' } } }]);
    const existingPayouts = payoutData[0]?.total || 0;

    const projectedTotalPayouts = existingPayouts + totalProjectedPayout;
    const projectedBCR          = totalPremiums > 0 ? projectedTotalPayouts / totalPremiums : 0;
    const willSuspend            = projectedBCR > 0.85;

    res.json({
      success: true,
      scenario: {
        days,
        triggerType,
        affectedPct:             (affectedPct * 100).toFixed(0) + '%',
        totalActivePolicies:     totalPolicies,
        projectedAffectedWorkers: affectedCount,
        avgDailyIncomePerWorker: Math.round(avgDailyIncome),
        payoutPerWorkerPerDay:   Math.round(payoutPerWorkerDay),
        totalProjectedPayout:    Math.round(totalProjectedPayout),
        currentPremiums:         Math.round(totalPremiums),
        projectedBCR:            parseFloat((projectedBCR * 100).toFixed(1)) + '%',
        willTriggerSuspension:   willSuspend,
        recommendation:          willSuspend
          ? `⚠️ BCR will exceed 85% — suspend new enrolments and alert reinsurer`
          : `✅ BCR stays within target — platform remains solvent`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
