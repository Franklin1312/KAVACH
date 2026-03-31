const express  = require('express');
const router   = express.Router();
const Worker   = require('../models/Worker');
const Policy   = require('../models/Policy');
const Claim    = require('../models/Claim');
const AuditLog = require('../models/AuditLog');
const { processPayout } = require('../services/paymentService');
const { notifyClaimAutoApproved } = require('../services/notificationService');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalWorkers,
      activePolicies,
      totalClaims,
      paidClaims,
      pendingClaims,
      rejectedClaims,
      premiumData,
      payoutData,
    ] = await Promise.all([
      Worker.countDocuments({ isVerified: true }),
      Policy.countDocuments({ status: 'active' }),
      Claim.countDocuments(),
      Claim.countDocuments({ payoutStatus: 'paid' }),
      Claim.countDocuments({ payoutStatus: { $in: ['pending', 'manual_review'] } }),
      Claim.countDocuments({ payoutStatus: 'rejected' }),
      Policy.aggregate([{ $group: { _id: null, total: { $sum: '$premium.finalAmount' } } }]),
      Claim.aggregate([
        { $match: { payoutStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$payoutAmount' } } },
      ]),
    ]);

    const totalPremiums   = premiumData[0]?.total || 0;
    const totalPayouts    = payoutData[0]?.total  || 0;
    const lossRatio       = totalPremiums > 0 ? ((totalPayouts / totalPremiums) * 100).toFixed(1) : 0;

    // Claims by trigger type
    const claimsByType = await Claim.aggregate([
      { $group: { _id: '$triggerType', count: { $sum: 1 }, totalPayout: { $sum: '$payoutAmount' } } },
      { $sort: { count: -1 } },
    ]);

    // Claims by city
    const claimsByCity = await Claim.aggregate([
      { $lookup: { from: 'workers', localField: 'worker', foreignField: '_id', as: 'w' } },
      { $unwind: '$w' },
      { $group: { _id: '$w.city', count: { $sum: 1 }, totalPayout: { $sum: '$payoutAmount' } } },
      { $sort: { count: -1 } },
    ]);

    // Fraud score distribution
    const fraudDist = await Claim.aggregate([
      {
        $bucket: {
          groupBy: '$fraudScore',
          boundaries: [0, 30, 61, 81, 101],
          default: 'other',
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    // Last 7 days claims volume
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyClaims  = await Claim.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count:       { $sum: 1 },
          totalPayout: { $sum: '$payoutAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalWorkers,
        activePolicies,
        totalClaims,
        paidClaims,
        pendingClaims,
        rejectedClaims,
        totalPremiums,
        totalPayouts,
        lossRatio: parseFloat(lossRatio),
        fraudDetectionRate: totalClaims > 0
          ? ((rejectedClaims / totalClaims) * 100).toFixed(1)
          : 0,
      },
      claimsByType,
      claimsByCity,
      fraudDist,
      dailyClaims,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/claims — all claims with worker info
router.get('/claims', async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('worker', 'name phone city zone')
      .populate('policy',  'tier coveragePct')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/workers — all registered workers
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

// PUT /api/admin/claims/:id/resolve
router.put('/claims/:id/resolve', async (req, res) => {
  try {
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const claim = await Claim.findById(req.params.id).populate('worker');
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    if (!['pending', 'manual_review'].includes(claim.payoutStatus)) {
      return res.status(400).json({ error: 'Claim is not awaiting review' });
    }

    if (!claim.worker) {
      return res.status(400).json({ error: 'Worker record not found for claim' });
    }

    if (action === 'approve') {
      const payout = await processPayout(claim.worker, claim.payoutAmount, claim._id);
      claim.payoutStatus = 'paid';
      claim.razorpayPayoutId = payout.id;
      claim.paidAt = new Date();
      claim.reviewNotes = notes?.trim() || 'Approved by admin review';
      await claim.save();

      await notifyClaimAutoApproved(claim.worker, claim, payout).catch(() => {});
      await Worker.findByIdAndUpdate(claim.worker._id, { claimsFreeWeeks: 0 });
    } else {
      claim.payoutStatus = 'rejected';
      claim.reviewNotes = notes?.trim() || 'Rejected by admin review';
      await claim.save();
    }

    await AuditLog.create({
      worker: claim.worker._id,
      event: 'ADMIN_CLAIM_REVIEWED',
      meta: {
        claimId: claim._id,
        action,
        payoutStatus: claim.payoutStatus,
        reviewNotes: claim.reviewNotes,
      },
    });

    const refreshedClaim = await Claim.findById(claim._id)
      .populate('worker', 'name phone city zone')
      .populate('policy', 'tier coveragePct');

    res.json({
      success: true,
      message: action === 'approve' ? 'Claim approved and payout processed' : 'Claim rejected',
      claim: refreshedClaim,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
