const express  = require('express');
const router   = express.Router();
const Worker   = require('../models/Worker');
const Policy   = require('../models/Policy');
const Claim    = require('../models/Claim');
const AuditLog = require('../models/AuditLog');
const { processPayout }          = require('../services/paymentService');
const { notifyClaimAutoApproved, notifyClaimManualReview } = require('../services/notificationService');
const { getCityDisruptionProfile, getHistoricalRisk } = require('../services/historicalDisruption');

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
      Claim.aggregate([{ $match: { payoutStatus: { $in: ['paid', 'approved'] } } }, { $group: { _id: null, total: { $sum: '$payoutAmount' } } }]),
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
// Simulate monsoon scenario — project BCR impact with reinsurance modelling
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

    // Projected premiums for the same period (not just historical)
    // Weekly premium per worker × (days / 7) weeks × all active workers
    const avgWeeklyPremium = activePolicies.reduce((sum, p) => {
      return sum + (p.premium?.finalAmount || 0);
    }, 0) / (totalPolicies || 1);
    const projectedPremiums = avgWeeklyPremium * (days / 7) * totalPolicies;

    // Historical premiums (all-time)
    const premiumData     = await Policy.aggregate([{ $group: { _id: null, total: { $sum: '$premium.finalAmount' } } }]);
    const totalHistoricalPremiums = premiumData[0]?.total || 0;

    // Total premium pool = historical + projected incoming during the event
    const totalPremiumPool = totalHistoricalPremiums + projectedPremiums;

    // Existing payouts
    const payoutData      = await Claim.aggregate([{ $match: { payoutStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$payoutAmount' } } }]);
    const existingPayouts = payoutData[0]?.total || 0;

    // --- Without reinsurance ---
    const grossProjectedPayouts = existingPayouts + totalProjectedPayout;
    const grossBCR = totalPremiumPool > 0 ? grossProjectedPayouts / totalPremiumPool : 0;

    // --- With reinsurance (excess-of-loss treaty) ---
    // Reinsurer absorbs 60% of catastrophic payouts above the retention threshold
    const retentionThreshold = totalPremiumPool * 0.50; // Platform retains first 50% of premium pool
    const excessPayouts = Math.max(0, grossProjectedPayouts - retentionThreshold);
    const reinsurerAbsorbs = excessPayouts * 0.60; // Reinsurer covers 60% of excess
    const netProjectedPayouts = grossProjectedPayouts - reinsurerAbsorbs;
    const netBCR = totalPremiumPool > 0 ? netProjectedPayouts / totalPremiumPool : 0;

    const willSuspend = netBCR > 0.85;

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

        // Gross (without reinsurance)
        totalProjectedPayout:    Math.round(grossProjectedPayouts),
        currentPremiums:         Math.round(totalPremiumPool),
        grossBCR:                parseFloat((grossBCR * 100).toFixed(1)) + '%',

        // Net (with reinsurance)
        reinsurerAbsorbs:        Math.round(reinsurerAbsorbs),
        netProjectedPayout:      Math.round(netProjectedPayouts),
        projectedBCR:            parseFloat((netBCR * 100).toFixed(1)) + '%',

        willTriggerSuspension:   willSuspend,
        recommendation:          willSuspend
          ? `BCR will exceed 85% even with reinsurance — suspend new enrolments and activate catastrophe protocol`
          : `Platform remains solvent — reinsurer absorbs excess risk. Continue normal operations.`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/sustainability ────────────────────────────────────────────
// Business sustainability metrics: premium trends, P2P ratio, break-even, reinsurer triggers
router.get('/sustainability', async (req, res) => {
  try {
    // 8-week timeseries of premiums and payouts
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
    const weeklyPremiums = await Policy.aggregate([
      { $match: { createdAt: { $gte: eightWeeksAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%U', date: '$createdAt' } },
        premiums: { $sum: '$premium.finalAmount' },
        workerCount: { $addToSet: '$worker' },
      }},
      { $project: {
        _id: 1,
        premiums: 1,
        workerCount: { $size: '$workerCount' },
      }},
      { $sort: { _id: 1 } },
    ]);

    const weeklyPayouts = await Claim.aggregate([
      { $match: { createdAt: { $gte: eightWeeksAgo }, payoutStatus: { $in: ['paid', 'approved'] } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%U', date: '$createdAt' } },
        payouts: { $sum: '$payoutAmount' },
        claimCount: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    // Merge into weekly trend
    const payoutMap = {};
    weeklyPayouts.forEach(w => { payoutMap[w._id] = w; });

    const weeklyTrend = weeklyPremiums.map(w => {
      const payoutData = payoutMap[w._id] || { payouts: 0, claimCount: 0 };
      const ratio = w.premiums > 0 ? payoutData.payouts / w.premiums : 0;
      return {
        week: w._id,
        premiums: Math.round(w.premiums),
        payouts: Math.round(payoutData.payouts),
        ratio: parseFloat(ratio.toFixed(4)),
        workerCount: w.workerCount,
        claimCount: payoutData.claimCount,
        premiumPerWorker: w.workerCount > 0 ? Math.round(w.premiums / w.workerCount) : 0,
      };
    });

    // Rolling 4-week P2P ratio
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const [premiums4w] = await Policy.aggregate([
      { $match: { createdAt: { $gte: fourWeeksAgo } } },
      { $group: { _id: null, total: { $sum: '$premium.finalAmount' } } },
    ]);
    const [payouts4w] = await Claim.aggregate([
      { $match: { createdAt: { $gte: fourWeeksAgo }, payoutStatus: { $in: ['paid', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$payoutAmount' } } },
    ]);

    const totalPremiums4w = premiums4w?.total || 0;
    const totalPayouts4w = payouts4w?.total || 0;
    const payoutToPremiumRatio4w = totalPremiums4w > 0 ? totalPayouts4w / totalPremiums4w : 0;

    // Current portfolio stats
    const currentWorkerCount = await Worker.countDocuments({ isVerified: true });
    const currentActivePolicies = await Policy.countDocuments({ status: 'active' });
    const [allPremiums] = await Policy.aggregate([{ $group: { _id: null, total: { $sum: '$premium.finalAmount' } } }]);
    const [allPayouts] = await Claim.aggregate([
      { $match: { payoutStatus: { $in: ['paid', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$payoutAmount' } } },
    ]);

    const totalPrem = allPremiums?.total || 0;
    const totalPay = allPayouts?.total || 0;

    // Break-even projections at various portfolio sizes
    const avgPremiumPerWorker = currentWorkerCount > 0 ? totalPrem / currentWorkerCount : 50;
    const avgPayoutPerWorker = currentWorkerCount > 0 ? totalPay / currentWorkerCount : 30;
    const netPerWorker = avgPremiumPerWorker - avgPayoutPerWorker;

    const breakEvenProjections = {
      current: {
        portfolioSize: currentWorkerCount,
        premiums: Math.round(totalPrem),
        payouts: Math.round(totalPay),
        net: Math.round(totalPrem - totalPay),
      },
      at500: {
        portfolioSize: 500,
        premiums: Math.round(avgPremiumPerWorker * 500),
        payouts: Math.round(avgPayoutPerWorker * 500),
        net: Math.round(netPerWorker * 500),
      },
      at1000: {
        portfolioSize: 1000,
        premiums: Math.round(avgPremiumPerWorker * 1000),
        payouts: Math.round(avgPayoutPerWorker * 1000),
        net: Math.round(netPerWorker * 1000),
      },
      at5000: {
        portfolioSize: 5000,
        premiums: Math.round(avgPremiumPerWorker * 5000),
        payouts: Math.round(avgPayoutPerWorker * 5000),
        net: Math.round(netPerWorker * 5000),
      },
    };

    // Reinsurer trigger thresholds
    const currentBCR = totalPrem > 0 ? totalPay / totalPrem : 0;
    const singleEventMax = await Claim.aggregate([
      { $match: { payoutStatus: { $in: ['paid', 'approved'] } } },
      { $group: { _id: '$triggerType', total: { $sum: '$payoutAmount' } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]);
    const singleEventLimit = totalPrem * 0.40; // 40% of premiums cap per event type

    const reinsurerTriggers = {
      bcrThreshold85: currentBCR > 0.85,
      bcrCurrent: parseFloat((currentBCR * 100).toFixed(1)),
      singleEventCap: {
        current: Math.round(singleEventMax[0]?.total || 0),
        limit: Math.round(singleEventLimit),
        percentage: singleEventLimit > 0
          ? parseFloat(((singleEventMax[0]?.total || 0) / singleEventLimit * 100).toFixed(1))
          : 0,
        triggerType: singleEventMax[0]?._id || 'none',
      },
    };

    res.json({
      success: true,
      weeklyTrend,
      payoutToPremiumRatio4w: parseFloat(payoutToPremiumRatio4w.toFixed(4)),
      breakEvenProjections,
      reinsurerTriggers,
      premiumPerWorkerPerWeek: weeklyTrend.map(w => ({
        week: w.week,
        premiumPerWorker: w.premiumPerWorker,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/historical-risk/:city ─────────────────────────────────────
// Returns the 12-month disruption profile for a city
router.get('/historical-risk/:city', async (req, res) => {
  try {
    const city = req.params.city.toLowerCase().trim();
    const profile = getCityDisruptionProfile(city);
    res.json({ success: true, city, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
