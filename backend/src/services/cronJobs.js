const cron   = require('node-cron');
const Worker = require('../models/Worker');
const Policy = require('../models/Policy');
const { calculatePremium } = require('./premiumService');
const { notifyWeeklyPremiumDue } = require('./notificationService');
const { createPremiumSubscription } = require('./paymentService');

// ─── Helper: get Monday 00:01 to Sunday 23:59 for current week ────────────────
function getWeekWindow() {
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

// ─── Job 1: Every Monday 00:01 — renew active policies ────────────────────────
// Expires last week's policies + creates new ones for workers on auto-renew
function scheduleWeeklyRenewal() {
  // Runs every Monday at 00:01 AM IST
  cron.schedule('1 0 * * 1', async () => {
    console.log('⏰ [CRON] Weekly policy renewal starting...');
    try {
      // 1. Expire all active policies from last week
      const { weekStart } = getWeekWindow();
      const expired = await Policy.updateMany(
        { status: 'active', weekEnd: { $lt: weekStart } },
        { status: 'expired' }
      );
      console.log(`✅ [CRON] Expired ${expired.modifiedCount} old policies`);

      // 2. Update claims-free weeks for workers with no claims last week
      const workersWithClaims = await Policy.distinct('worker', {
        status: 'expired',
        weekEnd: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      await Worker.updateMany(
        { _id: { $nin: workersWithClaims }, isVerified: true },
        { $inc: { claimsFreeWeeks: 1 } }
      );

      // 3. Auto-renew policies for verified workers (simplified — in production tied to Razorpay subscription)
      const workers = await Worker.find({ isVerified: true, isActive: true });
      const { weekEnd } = getWeekWindow();
      let renewed = 0;

      for (const worker of workers) {
        // Check if worker already has a policy this week
        const existing = await Policy.findOne({ worker: worker._id, weekStart: { $gte: weekStart } });
        if (existing) continue;

        const { finalAmount, coveragePct, maxPayout, breakdown, tier } = calculatePremium({
          weeklyIncome:    worker.verifiedWeeklyIncome || worker.declaredWeeklyIncome,
          zoneRiskFactor:  worker.zoneRiskFactor,
          city:            worker.city,
          claimsFreeWeeks: worker.claimsFreeWeeks,
          tier:            'standard',
        });

        const subscription = await createPremiumSubscription(worker, finalAmount).catch(() => ({ id: null }));

        const policy = await Policy.create({
          worker:     worker._id,
          tier:       'standard',
          coveragePct,
          premium: {
            baseRate:           parseFloat(breakdown.baseRate),
            zoneRiskFactor:     breakdown.zoneRiskFactor,
            seasonMultiplier:   breakdown.seasonMultiplier,
            claimsFreeDiscount: parseFloat(breakdown.claimsFreeDiscount),
            surgeLoading:       breakdown.surgeLoading,
            tierMultiplier:     breakdown.tierMultiplier,
            finalAmount,
          },
          weekStart,
          weekEnd,
          maxPayout,
          razorpaySubscriptionId: subscription?.id,
          status:      'active',
          premiumPaid: Boolean(subscription?.mock),
        });

        // Send WhatsApp notification
        await notifyWeeklyPremiumDue(worker, policy).catch(() => {});
        renewed++;
      }

      console.log(`✅ [CRON] Renewed ${renewed} policies for this week`);
    } catch (err) {
      console.error('❌ [CRON] Weekly renewal error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('📅 Weekly renewal cron scheduled (Monday 00:01 IST)');
}

// ─── Job 2: Every 30 minutes — check live triggers for all active zones ────────
function scheduleTriggerMonitor() {
  cron.schedule('*/30 * * * *', async () => {
    console.log('🔍 [CRON] Running trigger monitor...');
    try {
      const { runAllTriggers } = require('./triggerService');
      const { autoProcessClaimForWorker } = require('./claimProcessor');

      // Get unique cities with active policies
      const activeCities = await Policy.distinct('worker', { status: 'active' });
      if (activeCities.length === 0) return;

      // Sample up to 10 workers to check trigger conditions (rate limit API calls)
      const workers = await Worker.find({
        _id: { $in: activeCities },
        isVerified: true,
      }).limit(10);

      for (const worker of workers) {
        const result = await runAllTriggers(worker, worker.platforms || []);
        if (result.anyTriggered) {
          console.log(`⚡ [CRON] Trigger detected for ${worker.name} (${worker.city}): ${result.triggerType}`);
          await autoProcessClaimForWorker(worker, result).catch(() => {});
        }
      }
    } catch (err) {
      console.error('❌ [CRON] Trigger monitor error:', err.message);
    }
  });

  console.log('⏱ Trigger monitor cron scheduled (every 30 minutes)');
}

// ─── Job 3: Daily at midnight — clean up and analytics ────────────────────────
function scheduleDailyCleanup() {
  cron.schedule('0 0 * * *', async () => {
    console.log('🧹 [CRON] Daily cleanup running...');
    try {
      // Mark stale pending claims as manual_review after 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const Claim = require('../models/Claim');
      await Claim.updateMany(
        { payoutStatus: 'pending', createdAt: { $lt: yesterday } },
        { payoutStatus: 'manual_review', reviewNotes: 'Auto-escalated: no response in 24 hours' }
      );
      console.log('✅ [CRON] Stale claims escalated');
    } catch (err) {
      console.error('❌ [CRON] Cleanup error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('🗓 Daily cleanup cron scheduled (midnight IST)');
}

function startAllCrons() {
  scheduleWeeklyRenewal();
  scheduleTriggerMonitor();
  scheduleDailyCleanup();
  scheduleWorkerBaselineUpdate();
}

// ─── Job 4: Every Monday 01:00 — update per-worker behavioral baselines ───────
// Computes rolling 4-week avg orders/hour and earnings/hour for each worker
// from their claim history. Used by the velocity anomaly fraud layer.
function scheduleWorkerBaselineUpdate() {
  cron.schedule('0 1 * * 1', async () => {
    console.log('📊 [CRON] Updating worker behavioral baselines...');
    try {
      const Claim = require('../models/Claim');
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

      const workers = await Worker.find({ isVerified: true, isActive: true });
      let updated = 0;

      for (const worker of workers) {
        const claims = await Claim.find({
          worker: worker._id,
          payoutStatus: { $in: ['approved', 'paid'] },
          createdAt: { $gte: fourWeeksAgo },
        }).select('predictedLoss disruptionStart disruptionEnd');

        // Need at least 3 claims for a meaningful baseline
        if (claims.length < 3) continue;

        let totalHours = 0;
        let totalEarnings = 0;

        for (const claim of claims) {
          const hours = Math.max(0.5,
            (new Date(claim.disruptionEnd) - new Date(claim.disruptionStart)) / (1000 * 60 * 60)
          );
          totalHours += hours;
          totalEarnings += (claim.predictedLoss || 0);
        }

        if (totalHours > 0) {
          await Worker.findByIdAndUpdate(worker._id, {
            avgEarningsPerHour: Math.round((totalEarnings / totalHours) * 100) / 100,
            avgOrdersPerHour: Math.round((claims.length / totalHours) * 100) / 100,
            lastBaselineUpdate: new Date(),
          });
          updated++;
        }
      }

      console.log(`✅ [CRON] Updated baselines for ${updated} workers`);
    } catch (err) {
      console.error('❌ [CRON] Baseline update error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('📊 Worker baseline update cron scheduled (Monday 01:00 IST)');
}

module.exports = { startAllCrons };
