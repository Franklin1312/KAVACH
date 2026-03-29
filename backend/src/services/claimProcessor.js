const Claim    = require('../models/Claim');
const Policy   = require('../models/Policy');
const Worker   = require('../models/Worker');
const AuditLog = require('../models/AuditLog');
const { predictEarnings }                   = require('./ditService');
const { calculateFraudScore, getPayoutDecision } = require('./fraudService');
const { processPayout }                     = require('./paymentService');
const { LEVEL_MULTIPLIERS }                 = require('./triggerService');
const {
  notifyClaimAutoApproved,
  notifyClaimSoftFlag,
  notifyClaimVerificationNeeded,
  notifyClaimManualReview,
  notifyDisruptionAlert,
} = require('./notificationService');

async function autoProcessClaimForWorker(worker, triggerResult) {
  const { triggerType, triggerLevel, triggerSource } = triggerResult;

  // Get active policy
  const policy = await Policy.findOne({ worker: worker._id, status: 'active' });
  if (!policy) return;

  // Predict loss (last 2 hours)
  const windowStart   = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const windowEnd     = new Date();
  const predictedLoss = await predictEarnings(worker, windowStart, windowEnd);
  const netLoss       = predictedLoss;

  if (netLoss <= 0) return;

  const levelMultiplier = LEVEL_MULTIPLIERS[triggerLevel] || 1.0;
  const payoutAmount    = Math.round(policy.coveragePct * netLoss * levelMultiplier);

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
    meta:   { claimId: claim._id, triggerType, payoutAmount, fraudScore, ppcs, action },
  });

  return claim;
}

module.exports = { autoProcessClaimForWorker };