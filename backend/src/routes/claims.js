const express    = require('express');
const router     = express.Router();
const { protect }         = require('../middleware/auth');
const Claim               = require('../models/Claim');
const Policy              = require('../models/Policy');
const Worker              = require('../models/Worker');
const AuditLog            = require('../models/AuditLog');
const { enrichAndPredict } = require('../services/ditService');
const { calculateFraudScore, getPayoutDecision } = require('../services/fraudService');
const { LEVEL_MULTIPLIERS, verifyTriggerForWorker, buildSimulatedTrigger } = require('../services/triggerService');
const { processPayout }   = require('../services/paymentService');
const { findActivePolicyForWorker, ensurePolicyMarkedPaidForDevelopment } = require('../services/policyAccessService');
const {
  notifyClaimAutoApproved,
  notifyClaimSoftFlag,
  notifyClaimVerificationNeeded,
  notifyClaimManualReview,
} = require('../services/notificationService');

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];
const RESERVED_PAYOUT_STATUSES = ['approved', 'paid', 'pending', 'manual_review'];

function parseShiftTime(value, fallback) {
  const [hours, minutes] = String(value || fallback).split(':').map(Number);
  return {
    hours: Number.isFinite(hours) ? hours : 10,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
}

function getWorkerShift(worker) {
  if (worker.usualShiftStart && worker.usualShiftEnd) {
    return {
      usualShiftStart: worker.usualShiftStart,
      usualShiftEnd: worker.usualShiftEnd,
      workingDays: worker.workingDays?.length ? worker.workingDays : DEFAULT_WORKING_DAYS,
    };
  }

  if (worker.workingHours === 'part') {
    return { usualShiftStart: '17:00', usualShiftEnd: '22:00', workingDays: DEFAULT_WORKING_DAYS };
  }

  if (worker.workingHours === 'extended') {
    return { usualShiftStart: '08:00', usualShiftEnd: '22:00', workingDays: DEFAULT_WORKING_DAYS };
  }

  return { usualShiftStart: '10:00', usualShiftEnd: '20:00', workingDays: DEFAULT_WORKING_DAYS };
}

function buildDateAtTime(baseDate, timeString) {
  const date = new Date(baseDate);
  const { hours, minutes } = parseShiftTime(timeString, '10:00');
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function getOverlap(startA, endA, startB, endB) {
  const start = new Date(Math.max(startA.getTime(), startB.getTime()));
  const end = new Date(Math.min(endA.getTime(), endB.getTime()));
  if (start >= end) return null;
  return { start, end };
}

function calculateFinalLossWindow(worker, disruptionStart, disruptionEnd) {
  const shift = getWorkerShift(worker);
  const workingDays = shift.workingDays || DEFAULT_WORKING_DAYS;
  const cursor = new Date(disruptionStart);
  cursor.setHours(0, 0, 0, 0);

  const segments = [];
  while (cursor <= disruptionEnd) {
    if (workingDays.includes(cursor.getDay())) {
      const shiftStart = buildDateAtTime(cursor, shift.usualShiftStart);
      let shiftEnd = buildDateAtTime(cursor, shift.usualShiftEnd);
      if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

      const overlap = getOverlap(disruptionStart, disruptionEnd, shiftStart, shiftEnd);
      if (overlap) segments.push(overlap);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (!segments.length) {
    return {
      shift,
      eligibleWorkWindow: null,
      finalLossWindow: null,
      totalEligibleMinutes: 0,
    };
  }

  const totalEligibleMinutes = segments.reduce((sum, segment) => sum + ((segment.end - segment.start) / 60000), 0);
  return {
    shift,
    eligibleWorkWindow: {
      start: segments[0].start,
      end: segments[segments.length - 1].end,
      segments,
    },
    finalLossWindow: {
      start: segments[0].start,
      end: segments[segments.length - 1].end,
      segments,
    },
    totalEligibleMinutes,
  };
}

function isSimulatedClaim(triggerSources = []) {
  return Array.isArray(triggerSources)
    && triggerSources.length > 0
    && triggerSources.every((source) => String(source.source || '').toLowerCase().includes('simulated'));
}

async function getReservedPayoutTotal(policyId, excludeClaimId = null) {
  const match = {
    policy: policyId,
    payoutStatus: { $in: RESERVED_PAYOUT_STATUSES },
  };

  if (excludeClaimId) {
    match._id = { $ne: excludeClaimId };
  }

  const [result] = await Claim.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$payoutAmount' } } },
  ]);

  return result?.total || 0;
}

async function findOverlappingClaim(workerId, policyId, windowStart, windowEnd) {
  return Claim.findOne({
    worker: workerId,
    policy: policyId,
    payoutStatus: { $ne: 'rejected' },
    disruptionStart: { $lt: windowEnd },
    disruptionEnd: { $gt: windowStart },
  }).sort({ createdAt: -1 });
}

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
    const { triggerType, triggerLevel, triggerSources, actualEarned, deviceSignals } = req.body;
    const worker = req.worker;

    const now = new Date();
    const policy = await findActivePolicyForWorker(worker._id, now);
    if (!policy) return res.status(400).json({ error: 'No active policy found' });
    if (!policy.premiumPaid) return res.status(400).json({ error: 'Policy premium is not marked as paid yet' });

    const verifiedTrigger = (process.env.NODE_ENV === 'development' && isSimulatedClaim(triggerSources))
      ? buildSimulatedTrigger(triggerType || 'rain', triggerLevel || 3)
      : await verifyTriggerForWorker(worker, triggerType);

    if (!verifiedTrigger.anyTriggered) {
      return res.status(400).json({
        error: 'No verified disruption detected for this worker right now',
        triggerType: triggerType || null,
        verification: verifiedTrigger,
      });
    }

    const verifiedDisruptionWindow = {
      start: new Date(verifiedTrigger.disruptionStart),
      end: new Date(verifiedTrigger.disruptionEnd),
      durationMinutes: verifiedTrigger.disruptionWindowMinutes,
      methodology: verifiedTrigger.windowMethodology,
    };

    const { shift, eligibleWorkWindow, finalLossWindow, totalEligibleMinutes } =
      calculateFinalLossWindow(worker, verifiedDisruptionWindow.start, verifiedDisruptionWindow.end);

    if (!finalLossWindow) {
      return res.status(400).json({
        error: 'Verified disruption did not overlap the worker shift window',
        verifiedDisruptionWindow,
        workerShift: shift,
      });
    }

    const overlappingClaim = await findOverlappingClaim(
      worker._id,
      policy._id,
      finalLossWindow.start,
      finalLossWindow.end
    );

    if (overlappingClaim) {
      return res.status(400).json({
        error: `Another disruption claim is already active for this window (${overlappingClaim.triggerType.replace('_', ' ')})`,
        existingClaimId: overlappingClaim._id,
      });
    }

    const {
      predictedEarnings: predictedLoss,
      confidence: mlConfidence,
      ordersPerHour,
      source: predictionSource,
    } = await enrichAndPredict(worker, finalLossWindow.start, finalLossWindow.end, {
      triggerType: verifiedTrigger.triggerType,
      isFestival: false,
    });
    const earned        = actualEarned || 0;
    const netLoss       = Math.max(0, predictedLoss - earned);

    if (netLoss === 0)
      return res.status(400).json({ error: 'No net income loss detected' });

    const levelMultiplier = LEVEL_MULTIPLIERS[verifiedTrigger.triggerLevel] || 1.0;
    const grossPayoutAmount = Math.round(policy.coveragePct * netLoss * levelMultiplier);
    const reservedPayoutTotal = await getReservedPayoutTotal(policy._id);
    const remainingCoverage = Math.max(0, policy.maxPayout - reservedPayoutTotal);
    if (remainingCoverage <= 0) {
      return res.status(400).json({ error: 'Policy weekly max payout has already been exhausted' });
    }

    const payoutAmount = Math.min(grossPayoutAmount, remainingCoverage);

    const { score: fraudScore, flags: fraudFlags, ppcs } = await calculateFraudScore(
      worker, policy, { triggerType: verifiedTrigger.triggerType, actualEarned: earned, predictedLoss, deviceSignals }
    );

    const { action, tier, message } = getPayoutDecision(fraudScore, ppcs);

    const payoutStatus = action === 'auto_approve' ? 'approved'
                       : action === 'soft_flag'    ? 'approved'
                       : action === 'verify'       ? 'pending'
                       : 'manual_review';

    const claim = await Claim.create({
      worker: worker._id, policy: policy._id,
      triggerType: verifiedTrigger.triggerType || 'rain', triggerLevel: verifiedTrigger.triggerLevel || 1,
      triggerSources: [verifiedTrigger.triggerSource].filter(Boolean),
      disruptionStart: finalLossWindow.start, disruptionEnd: finalLossWindow.end,
      windowSummary: {
        verifiedDisruptionWindow: {
          start: verifiedDisruptionWindow.start,
          end: verifiedDisruptionWindow.end,
          durationMinutes: verifiedDisruptionWindow.durationMinutes,
          methodology: verifiedDisruptionWindow.methodology,
        },
        eligibleWorkWindow: {
          start: eligibleWorkWindow.start,
          end: eligibleWorkWindow.end,
          totalEligibleMinutes,
        },
        finalLossWindow: {
          start: finalLossWindow.start,
          end: finalLossWindow.end,
          totalEligibleMinutes,
        },
      },
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
      meta: {
        claimId: claim._id,
        triggerType: verifiedTrigger.triggerType,
        payoutAmount,
        fraudScore,
        ppcs,
        action,
        predictionSource,
        mlConfidence,
        ordersPerHour,
      },
    });

    res.status(201).json({
      success: true, claim,
      decision: { action, tier, message },
      breakdown: {
        predictedLoss,
        actualEarned: earned,
        netLoss,
        coveragePct: policy.coveragePct,
        levelMultiplier,
        payoutAmount,
        grossPayoutAmount,
        remainingCoverage,
        fraudScore,
        ppcs,
        mlConfidence,
        ordersPerHour,
        predictionSource,
        verifiedDisruptionWindow: {
          start: verifiedDisruptionWindow.start,
          end: verifiedDisruptionWindow.end,
          durationMinutes: verifiedDisruptionWindow.durationMinutes,
          methodology: verifiedDisruptionWindow.methodology,
        },
        eligibleWorkWindow: {
          start: eligibleWorkWindow.start,
          end: eligibleWorkWindow.end,
          totalEligibleMinutes,
        },
        finalLossWindow: {
          start: finalLossWindow.start,
          end: finalLossWindow.end,
          totalEligibleMinutes,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/claims/:id/verify
router.put('/:id/verify', protect, async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, worker: req.worker._id }).populate('policy');
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    claim.policy = await ensurePolicyMarkedPaidForDevelopment(claim.policy);
    if (!claim.policy?.premiumPaid) return res.status(400).json({ error: 'Policy premium is not marked as paid yet' });
    if (claim.payoutStatus === 'paid') return res.status(400).json({ error: 'Claim already paid' });

    const reservedWithoutCurrent = await getReservedPayoutTotal(claim.policy._id, claim._id);
    const remainingCoverage = Math.max(0, claim.policy.maxPayout - reservedWithoutCurrent);
    if (remainingCoverage <= 0) {
      return res.status(400).json({ error: 'Policy weekly max payout has already been exhausted' });
    }

    claim.payoutAmount = Math.min(claim.payoutAmount, remainingCoverage);

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
