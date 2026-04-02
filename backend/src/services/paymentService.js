const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Create UPI AutoPay subscription for weekly premium ───────────────────────
async function createPremiumSubscription(worker, weeklyAmount) {
  if (process.env.NODE_ENV === 'development') {
    return { id: `mock_sub_${Date.now()}`, status: 'created', mock: true };
  }
  try {
    const plan = await razorpay.plans.create({
      period: 'weekly', interval: 1,
      item: { name: 'KAVACH Weekly Income Shield', amount: weeklyAmount * 100, currency: 'INR' },
    });
    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.id, total_count: 52, quantity: 1, customer_notify: 1,
      notes: { worker_id: worker._id.toString(), worker_name: worker.name },
    });
    return subscription;
  } catch (err) {
    console.error('Razorpay subscription error:', err.message);
    return { id: null, mock: true, error: err.message };
  }
}

// ─── Process payout with rollback logic ───────────────────────────────────────
async function processPayout(worker, amount, claimId) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`💸 Mock payout: ₹${amount} → ${worker.upiId || 'no-upi'} (claim: ${claimId})`);
    return { id: `mock_payout_${Date.now()}`, status: 'processed', mock: true };
  }

  // Try UPI first, fall back to IMPS
  if (worker.upiId) {
    return await processUPIPayout(worker, amount, claimId);
  } else {
    return await processIMPSPayout(worker, amount, claimId);
  }
}

// ─── UPI Payout ───────────────────────────────────────────────────────────────
async function processUPIPayout(worker, amount, claimId) {
  try {
    const contact = await razorpay.contacts.create({
      name: worker.name, contact: worker.phone,
      type: 'employee', reference_id: worker._id.toString(),
    });

    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contact.id, account_type: 'vpa',
      vpa: { address: worker.upiId },
    });

    const payout = await razorpay.payouts.create({
      account_number:       process.env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id:      fundAccount.id,
      amount:               amount * 100,
      currency:             'INR',
      mode:                 'UPI',
      purpose:              'payout',
      queue_if_low_balance: true,
      reference_id:         `KAVACH_${claimId}`,
      narration:            'KAVACH Income Protection Payout',
    });

    return { ...payout, channel: 'UPI' };
  } catch (err) {
    console.error('UPI payout failed, trying IMPS fallback:', err.message);
    // Rollback: try IMPS
    return await processIMPSPayout(worker, amount, claimId, err.message);
  }
}

// ─── IMPS Fallback ────────────────────────────────────────────────────────────
async function processIMPSPayout(worker, amount, claimId, upiError = null) {
  // If no bank account on file, hold for manual processing
  if (!worker.bankAccount?.accountNumber) {
    console.error(`No UPI or bank account for worker ${worker._id} — holding for manual`);
    return {
      id:      `hold_${claimId}`,
      status:  'hold',
      channel: 'MANUAL',
      reason:  upiError || 'No payment method on file',
    };
  }

  try {
    const contact = await razorpay.contacts.create({
      name: worker.name, contact: worker.phone, type: 'employee',
    });

    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contact.id, account_type: 'bank_account',
      bank_account: {
        name:           worker.name,
        ifsc:           worker.bankAccount.ifsc,
        account_number: worker.bankAccount.accountNumber,
      },
    });

    const payout = await razorpay.payouts.create({
      account_number:       process.env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id:      fundAccount.id,
      amount:               amount * 100,
      currency:             'INR',
      mode:                 'IMPS',
      purpose:              'payout',
      queue_if_low_balance: true,
      reference_id:         `KAVACH_IMPS_${claimId}`,
      narration:            'KAVACH Income Protection (IMPS)',
    });

    return { ...payout, channel: 'IMPS' };
  } catch (err) {
    console.error('IMPS also failed:', err.message);
    // Rollback — mark for manual retry in 30 minutes
    return {
      id:      `rollback_${claimId}_${Date.now()}`,
      status:  'rollback',
      channel: 'RETRY',
      reason:  err.message,
    };
  }
}

// ─── Retry failed payouts (called by cron or manually) ────────────────────────
async function retryFailedPayout(claim, worker) {
  console.log(`🔄 Retrying payout for claim ${claim._id}`);
  return await processPayout(worker, claim.payoutAmount, claim._id);
}

// ─── Verify webhook signature ─────────────────────────────────────────────────
function verifyWebhookSignature(body, signature) {
  const crypto  = require('crypto');
  const secret  = process.env.RAZORPAY_WEBHOOK_SECRET || 'kavach_webhook_secret';
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  return expected === signature;
}

module.exports = { createPremiumSubscription, processPayout, retryFailedPayout, verifyWebhookSignature };
