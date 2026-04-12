const Claim  = require('../models/Claim');
const Worker = require('../models/Worker');

// ─── Fraud scoring engine — 7 independent layers ─────────────────────────────
// Each layer adds to the fraud score (0–100). Auto-approve if score < 30.

async function calculateFraudScore(worker, policy, claimData) {
  let score = 0;
  const flags = [];

  // ─── Layer 1: GPS Zone Validation ─────────────────────────────────────────
  const zoneMatch = worker.zone && worker.city;
  if (!zoneMatch) {
    score += 20;
    flags.push('ZONE_NOT_VERIFIED');
  }

  // ─── Layer 2: Platform Activity Cross-Validation ──────────────────────────
  const actualEarned  = claimData?.actualEarned  || 0;
  const predictedLoss = claimData?.predictedLoss || 0;
  if (actualEarned > predictedLoss * 0.5) {
    score += 25;
    flags.push('EARNING_DURING_DISRUPTION');
  }

  // ─── Layer 3: New Account Cooling-Off ─────────────────────────────────────
  const accountAgeDays = (Date.now() - new Date(worker.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < 7) {
    score += 30;
    flags.push('NEW_ACCOUNT_WEEK_1');
  } else if (accountAgeDays < 14) {
    score += 15;
    flags.push('NEW_ACCOUNT_WEEK_2');
  }

  // ─── Layer 4: Historical Behavioral Baseline ──────────────────────────────
  // Check claim frequency — more than 3 claims in last 4 weeks is suspicious
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const recentClaims = await Claim.countDocuments({
    worker: worker._id,
    createdAt: { $gte: fourWeeksAgo },
    payoutStatus: { $in: ['approved', 'paid'] },
  });

  if (recentClaims >= 4) {
    score += 20;
    flags.push('HIGH_CLAIM_FREQUENCY');
  } else if (recentClaims >= 3) {
    score += 10;
    flags.push('ELEVATED_CLAIM_FREQUENCY');
  }

  // ─── Layer 4.5: Per-Worker Velocity Anomaly ───────────────────────────────
  // Compare the current claim's predicted hourly earnings against the
  // worker's own 4-week rolling average. Flags claims where the predicted
  // loss rate is suspiciously high relative to the worker's personal baseline.
  if (worker.avgEarningsPerHour && worker.avgEarningsPerHour > 0) {
    const claimWindowHours = claimData.windowHours ||
      ((claimData.disruptionEnd && claimData.disruptionStart)
        ? (new Date(claimData.disruptionEnd) - new Date(claimData.disruptionStart)) / (1000 * 60 * 60)
        : 2);
    const claimHourlyRate = (claimData.predictedLoss || 0) / Math.max(0.5, claimWindowHours);
    const velocityRatio = claimHourlyRate / worker.avgEarningsPerHour;

    if (velocityRatio > 2.5) {
      score += 20;
      flags.push('VELOCITY_ANOMALY_SEVERE');
    } else if (velocityRatio > 2.0) {
      score += 15;
      flags.push('VELOCITY_ANOMALY');
    } else if (velocityRatio > 1.7) {
      score += 5;
      flags.push('VELOCITY_ELEVATED');
    }
  }
  // Workers with null baseline (cold start, <3 claims) skip this layer

  // ─── Layer 5: Duplicate Claim Prevention ──────────────────────────────────
  // No two claims for the same trigger window
  const duplicateClaim = await Claim.findOne({
    worker:          worker._id,
    policy:          policy._id,
    triggerType:     claimData.triggerType,
    disruptionStart: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }, // last 6 hours
    payoutStatus:    { $nin: ['rejected'] },
  });

  if (duplicateClaim) {
    score += 50;
    flags.push('DUPLICATE_CLAIM');
  }

  // ─── Layer 6: Last-Minute Policy Purchase ─────────────────────────────────
  // Policy created less than 24 hours ago
  const policyAgeHours = (Date.now() - new Date(policy.createdAt).getTime()) / (1000 * 60 * 60);
  if (policyAgeHours < 24) {
    score += 25;
    flags.push('POLICY_SEASONING_PERIOD');
  }

  // ─── Layer 7: Payout Destination Clustering (ring detection) ─────────────
  // Check if multiple workers with same UPI prefix claimed in same window
  if (worker.upiId) {
    const upiPrefix = worker.upiId.split('@')[1]; // bank identifier
    const recentClaimsFromBank = await Claim.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // last 1 hour
          payoutStatus: { $nin: ['rejected'] },
        },
      },
      {
        $lookup: {
          from:         'workers',
          localField:   'worker',
          foreignField: '_id',
          as:           'workerData',
        },
      },
      { $unwind: '$workerData' },
      {
        $match: {
          'workerData.upiId': { $regex: `@${upiPrefix}$`, $options: 'i' },
          'workerData.city':  worker.city,
        },
      },
      { $count: 'total' },
    ]);

    const clusterCount = recentClaimsFromBank[0]?.total || 0;
    if (clusterCount > 20) {
      score += 30;
      flags.push('UPI_CLUSTER_RING_DETECTED');
    }
  }

  // ─── Physical Presence Confidence Score (PPCS) ────────────────────────────
  // Calculated from device signals sent from mobile app
  // In production these come from the Android SDK
  // For now we compute a mock PPCS
  const ppcs = calculatePPCS(claimData?.deviceSignals || {});

  if (ppcs < 30) {
    score += 25;
    flags.push('LOW_PPCS_GPS_SPOOFING_SUSPECTED');
  } else if (ppcs < 50) {
    score += 10;
    flags.push('MODERATE_PPCS');
  }

  // Cap at 100
  score = Math.min(score, 100);

  return { score, flags, ppcs };
}

// ─── PPCS — Physical Presence Confidence Score ────────────────────────────────
function calculatePPCS(deviceSignals) {
  let ppcs = 100;

  // Signal 1: GPS jitter (0 = spoofed/smooth, 1 = natural)
  if (deviceSignals.gpsJitter !== undefined) {
    if (deviceSignals.gpsJitter < 0.05) { ppcs -= 30; } // unnaturally smooth
    else if (deviceSignals.gpsJitter < 0.1) { ppcs -= 10; }
  }

  // Signal 2: Device motion continuity
  if (deviceSignals.motionContinuity !== undefined) {
    if (!deviceSignals.motionContinuity) { ppcs -= 25; } // no prior trajectory
  }

  // Signal 3: Cell tower matches zone (not home tower)
  if (deviceSignals.cellTowerMatchesZone !== undefined) {
    if (!deviceSignals.cellTowerMatchesZone) { ppcs -= 25; } // home tower detected
  }

  // Signal 4: Platform app heartbeat active
  if (deviceSignals.appHeartbeatActive !== undefined) {
    if (!deviceSignals.appHeartbeatActive) { ppcs -= 20; } // app not polling
  }

  return Math.max(0, ppcs);
}

// ─── Determine payout action from fraud score + PPCS ─────────────────────────
function getPayoutDecision(fraudScore, ppcs) {
  if (fraudScore <= 30 && ppcs >= 80) {
    return { action: 'auto_approve', tier: 1, message: 'Auto-approved' };
  }
  if (fraudScore <= 60 && ppcs >= 50) {
    return { action: 'soft_flag',    tier: 2, message: 'Approved — held 2 hours for reconciliation' };
  }
  if (fraudScore <= 80) {
    return { action: 'verify',       tier: 3, message: 'Please send a photo of your current location via WhatsApp' };
  }
  return   { action: 'manual_review', tier: 4, message: 'Claim under security review — up to 24 hours' };
}

module.exports = { calculateFraudScore, getPayoutDecision, calculatePPCS };
