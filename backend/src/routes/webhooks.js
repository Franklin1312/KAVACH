// ─── Razorpay Webhook Handler ─────────────────────────────────────────────────
// Receives asynchronous status updates from Razorpay for payouts and
// subscription payments. Works in both Sandbox (Test Mode) and Live.
//
// Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://your-domain.com/api/webhooks/razorpay
//   Secret: (must match RAZORPAY_WEBHOOK_SECRET in .env)
//   Events: payout.processed, payout.reversed, payout.failed,
//           subscription.charged, subscription.halted

const express = require('express');
const router  = express.Router();
const Claim   = require('../models/Claim');
const Policy  = require('../models/Policy');
const AuditLog = require('../models/AuditLog');
const { verifyWebhookSignature } = require('../services/paymentService');

// ─── POST /api/webhooks/razorpay ──────────────────────────────────────────────
router.post('/razorpay', async (req, res) => {
  try {
    // 1. Verify the webhook signature to ensure it's genuinely from Razorpay
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.warn('[Webhook] Missing x-razorpay-signature header');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const isValid = verifyWebhookSignature(req.body, signature);
    if (!isValid) {
      console.warn('[Webhook] Invalid Razorpay signature — possible spoofed request');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event   = req.body.event;
    const payload = req.body.payload;

    console.log(`[Webhook] Received: ${event}`);

    // 2. Route the event to the appropriate handler
    switch (event) {
      // ── Payout Events ──────────────────────────────────────────────────────
      case 'payout.processed': {
        const payoutEntity = payload.payout?.entity;
        if (!payoutEntity) break;

        // Extract claim ID from reference_id: "KAVACH_<claimId>" or "KAVACH_IMPS_<claimId>"
        const refId = payoutEntity.reference_id || '';
        const claimId = refId.replace('KAVACH_IMPS_', '').replace('KAVACH_', '');

        if (!claimId) {
          console.warn('[Webhook] payout.processed — no claimId in reference_id:', refId);
          break;
        }

        const claim = await Claim.findById(claimId);
        if (!claim) {
          console.warn(`[Webhook] payout.processed — claim ${claimId} not found`);
          break;
        }

        // Update claim status
        claim.payoutStatus     = 'paid';
        claim.razorpayPayoutId = payoutEntity.id;
        claim.paidAt           = new Date(payoutEntity.processed_at || Date.now());
        claim.reviewNotes      = (claim.reviewNotes || '') + ` | Razorpay confirmed: ${payoutEntity.id}`;
        await claim.save();

        await AuditLog.create({
          worker: claim.worker,
          event:  'PAYOUT_CONFIRMED_VIA_WEBHOOK',
          meta: {
            claimId:       claim._id,
            razorpayId:    payoutEntity.id,
            amount:        payoutEntity.amount / 100, // Razorpay sends paise
            mode:          payoutEntity.mode,          // UPI / IMPS
            utr:           payoutEntity.utr,           // Unique Transaction Reference
          },
        });

        console.log(`[Webhook] Claim ${claimId} marked PAID — ₹${payoutEntity.amount / 100} via ${payoutEntity.mode}`);
        break;
      }

      case 'payout.failed': {
        const payoutEntity = payload.payout?.entity;
        if (!payoutEntity) break;

        const refId   = payoutEntity.reference_id || '';
        const claimId = refId.replace('KAVACH_IMPS_', '').replace('KAVACH_', '');

        if (!claimId) break;

        const claim = await Claim.findById(claimId);
        if (!claim) break;

        // Mark for manual review — don't auto-reject since the payout can be retried
        claim.payoutStatus = 'manual_review';
        claim.reviewNotes  = (claim.reviewNotes || '') +
          ` | Payout FAILED: ${payoutEntity.failure_reason || 'Unknown'}. Will retry.`;
        await claim.save();

        await AuditLog.create({
          worker: claim.worker,
          event:  'PAYOUT_FAILED_VIA_WEBHOOK',
          meta: {
            claimId:       claim._id,
            razorpayId:    payoutEntity.id,
            failureReason: payoutEntity.failure_reason,
            amount:        payoutEntity.amount / 100,
          },
        });

        console.warn(`[Webhook] Claim ${claimId} payout FAILED — ${payoutEntity.failure_reason}`);
        break;
      }

      case 'payout.reversed': {
        const payoutEntity = payload.payout?.entity;
        if (!payoutEntity) break;

        const refId   = payoutEntity.reference_id || '';
        const claimId = refId.replace('KAVACH_IMPS_', '').replace('KAVACH_', '');
        if (!claimId) break;

        const claim = await Claim.findById(claimId);
        if (!claim) break;

        // Reversal — money came back to our account
        claim.payoutStatus = 'manual_review';
        claim.reviewNotes  = (claim.reviewNotes || '') +
          ` | REVERSED: ${payoutEntity.failure_reason || 'Bank returned funds'}. Needs re-processing.`;
        await claim.save();

        await AuditLog.create({
          worker: claim.worker,
          event:  'PAYOUT_REVERSED_VIA_WEBHOOK',
          meta: {
            claimId:       claim._id,
            razorpayId:    payoutEntity.id,
            amount:        payoutEntity.amount / 100,
          },
        });

        console.warn(`[Webhook] Claim ${claimId} payout REVERSED`);
        break;
      }

      // ── Subscription Events (Premium Collection) ──────────────────────────
      case 'subscription.charged': {
        const subEntity = payload.subscription?.entity;
        const payEntity = payload.payment?.entity;
        if (!subEntity) break;

        // Find the policy with this subscription ID
        const policy = await Policy.findOne({ razorpaySubscriptionId: subEntity.id });
        if (!policy) {
          console.warn(`[Webhook] subscription.charged — no policy for subscription ${subEntity.id}`);
          break;
        }

        // Mark premium as paid for this billing cycle
        policy.premiumPaid = true;
        await policy.save();

        await AuditLog.create({
          worker: policy.worker,
          event:  'PREMIUM_CHARGED_VIA_WEBHOOK',
          meta: {
            policyId:      policy._id,
            subscriptionId: subEntity.id,
            paymentId:     payEntity?.id,
            amount:        (payEntity?.amount || 0) / 100,
          },
        });

        console.log(`[Webhook] Policy ${policy._id} premium charged — ₹${(payEntity?.amount || 0) / 100}`);
        break;
      }

      case 'subscription.halted': {
        const subEntity = payload.subscription?.entity;
        if (!subEntity) break;

        const policy = await Policy.findOne({ razorpaySubscriptionId: subEntity.id });
        if (!policy) break;

        // Subscription halted — premium not collected, mark policy as at risk
        policy.premiumPaid = false;
        policy.status      = 'cancelled';
        await policy.save();

        await AuditLog.create({
          worker: policy.worker,
          event:  'SUBSCRIPTION_HALTED_VIA_WEBHOOK',
          meta: {
            policyId:      policy._id,
            subscriptionId: subEntity.id,
            reason:        'Payment method failed multiple times',
          },
        });

        console.warn(`[Webhook] Policy ${policy._id} subscription HALTED — policy cancelled`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
    }

    // Always return 200 to acknowledge receipt — Razorpay retries on non-2xx
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[Webhook] Error processing Razorpay webhook:', err.message);
    // Still return 200 to prevent infinite retries
    res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
