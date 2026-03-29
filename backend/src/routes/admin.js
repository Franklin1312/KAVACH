const express  = require('express');
const router   = express.Router();
const Worker   = require('../models/Worker');
const Policy   = require('../models/Policy');
const Claim    = require('../models/Claim');

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

module.exports = router;
