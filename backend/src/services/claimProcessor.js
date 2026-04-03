const Claim    = require('../models/Claim');
const Policy   = require('../models/Policy');
const Worker   = require('../models/Worker');
const AuditLog = require('../models/AuditLog');
const { enrichAndPredict }                  = require('./ditService');
const { calculateFraudScore, getPayoutDecision } = require('./fraudService');
const { processPayout }                     = require('./paymentService');
const { LEVEL_MULTIPLIERS }                 = require('./triggerService');
const { findActivePolicyForWorker }         = require('./policyAccessService');
const {
  notifyClaimAutoApproved,
  notifyClaimSoftFlag,
  notifyClaimVerificationNeeded,
  notifyClaimManualReview,
  notifyDisruptionAlert,
} = require('./notificationService');

const RESERVED_PAYOUT_STATUSES = ['approved', 'paid', 'pending', 'manual_review'];

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

async function autoProcessClaimForWorker(worker, triggerResult) {
  const { triggerType, triggerLevel, triggerSource } = triggerResult;

  // Get active policy
  const policy = await findActivePolicyForWorker(worker._id, new Date());
  if (!policy) return;
  if (!policy.premiumPaid) return;

  // Predict loss (last 2 hours)
  const windowStart   = triggerResult.disruptionStart ? new Date(triggerResult.disruptionStart) : new Date(Date.now() - 2 * 60 * 60 * 1000);
  const windowEnd     = triggerResult.disruptionEnd ? new Date(triggerResult.disruptionEnd) : new Date();

  const overlappingClaim = await Claim.findOne({
    worker: worker._id,
    policy: policy._id,
    payoutStatus: { $ne: 'rejected' },
    disruptionStart: { $lt: windowEnd },
    disruptionEnd: { $gt: windowStart },
  });
  if (overlappingClaim) return overlappingClaim;

  const {
    predictedEarnings: predictedLoss,
    confidence: mlConfidence,
    ordersPerHour,
    source: predictionSource,
  } = await enrichAndPredict(worker, windowStart, windowEnd, {
    triggerType,
    isFestival: false,
  });
  const netLoss = predictedLoss;

  if (netLoss <= 0) return;

  const levelMultiplier = LEVEL_MULTIPLIERS[triggerLevel] || 1.0;
  const grossPayoutAmount = Math.round(policy.coveragePct * netLoss * levelMultiplier);
  const reservedPayoutTotal = await getReservedPayoutTotal(policy._id);
  const remainingCoverage = Math.max(0, policy.maxPayout - reservedPayoutTotal);
  if (remainingCoverage <= 0) return;

  const payoutAmount = Math.min(grossPayoutAmount, remainingCoverage);

  const { score: fraudScore, flags: fraudFlags, ppcs } = await calculateFraudScore(
    worker, policy, { triggerType, actualEarned: 0, predictedLoss }
  );

  const { action, message } = getPayoutDecision(fraudScore, ppcs);

  const payoutStatus = action === 'auto_approve' ? 'approved'
                     : action === 'soft_flag'    ? 'approved'
                     : action === 'verify'       ? 'pending'
                     : 'manual_review';

  const claim = await Claim.create({
    worker:          worker._id,
    policy:          policy._id,
    triggerType,
    triggerLevel,
    triggerSources:  triggerSource ? [triggerSource] : [],
    disruptionStart: windowStart,
    disruptionEnd:   windowEnd,
    windowSummary: {
      verifiedDisruptionWindow: {
        start: windowStart,
        end: windowEnd,
        durationMinutes: Math.round((windowEnd - windowStart) / 60000),
        methodology: 'Window inferred by background trigger monitor from the latest active trigger.',
      },
      eligibleWorkWindow: {
        start: windowStart,
        end: windowEnd,
        totalEligibleMinutes: Math.round((windowEnd - windowStart) / 60000),
      },
      finalLossWindow: {
        start: windowStart,
        end: windowEnd,
        totalEligibleMinutes: Math.round((windowEnd - windowStart) / 60000),
      },
    },
    predictedLoss,
    actualEarned:    0,
    netLoss,
    payoutAmount,
    payoutStatus,
    fraudScore,
    ppcsScore:       ppcs,
    fraudFlags,
  });

  // Send disruption alert first
  await notifyDisruptionAlert(worker, triggerType, triggerLevel).catch(() => {});

  // Handle payout based on decision
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
    // Process payout after 2-hour hold
    setTimeout(async () => {
      const payout = await processPayout(worker, payoutAmount, claim._id);
      claim.payoutStatus     = 'paid';
      claim.razorpayPayoutId = payout.id;
      claim.paidAt           = new Date();
      await claim.save();
      await notifyClaimAutoApproved(worker, claim, payout).catch(() => {});
    }, 2 * 60 * 60 * 1000);

  } else if (action === 'verify') {
    await notifyClaimVerificationNeeded(worker, claim).catch(() => {});

  } else {
    await notifyClaimManualReview(worker, claim).catch(() => {});
  }

  await AuditLog.create({
    worker: worker._id,
    event:  'CLAIM_AUTO_PROCESSED',
    meta:   {
      claimId: claim._id,
      triggerType,
      payoutAmount,
      fraudScore,
      ppcs,
      action,
      predictionSource,
      mlConfidence,
      ordersPerHour,
    },
  });

  return claim;
}

module.exports = { autoProcessClaimForWorker };
