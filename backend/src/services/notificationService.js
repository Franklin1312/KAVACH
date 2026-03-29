const axios = require('axios');

const WA_TOKEN    = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WA_BASE     = `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`;

// ─── Send a WhatsApp text message ─────────────────────────────────────────────
async function sendMessage(to, message) {
  // Format: 91XXXXXXXXXX (no +)
  const phone = to.replace(/\D/g, '');
  const recipient = phone.length === 10 ? `91${phone}` : phone;

  if (!WA_TOKEN || !WA_PHONE_ID) {
    // Dev mode — just log
    console.log(`📱 WhatsApp [${recipient}]: ${message}`);
    return { mock: true };
  }

  try {
    const { data } = await axios.post(
      WA_BASE,
      {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: message },
      },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    return data;
  } catch (err) {
    console.error('WhatsApp error:', err.response?.data || err.message);
    return { error: err.message };
  }
}

// ─── Notification templates ────────────────────────────────────────────────────

async function notifyPolicyActivated(worker, policy) {
  const msg =
    `✅ *KAVACH Policy Activated*\n\n` +
    `Namaste ${worker.name}!\n\n` +
    `Your income shield is active for this week.\n\n` +
    `📋 *Policy Details*\n` +
    `• Tier: ${policy.tier?.toUpperCase()}\n` +
    `• Coverage: ${policy.coveragePct * 100}% of predicted loss\n` +
    `• Max payout: ₹${policy.maxPayout?.toLocaleString('en-IN')}\n` +
    `• Valid till: ${new Date(policy.weekEnd).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n` +
    `Weekly premium: ₹${policy.premium?.finalAmount}\n\n` +
    `_KAVACH — AI Income Shield for Gig Workers_`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimAutoApproved(worker, claim, payout) {
  const msg =
    `💸 *KAVACH Payout Alert*\n\n` +
    `₹${claim.payoutAmount} has been sent to your UPI account.\n\n` +
    `📊 *Claim Details*\n` +
    `• Disruption: ${formatTriggerType(claim.triggerType)}\n` +
    `• Predicted loss: ₹${claim.predictedLoss}\n` +
    `• Your payout (${claim.policy?.coveragePct ? claim.policy.coveragePct * 100 : 70}%): ₹${claim.payoutAmount}\n` +
    `• UPI Ref: ${payout?.id || 'Processing'}\n\n` +
    `Money should arrive within 1-2 minutes.\n\n` +
    `_KAVACH — Always protecting your earnings_ ⛨`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimSoftFlag(worker, claim) {
  const msg =
    `⏳ *KAVACH Payout Processing*\n\n` +
    `Your ₹${claim.payoutAmount} payout is being processed.\n\n` +
    `We noticed your network signal was weak — this is completely normal in bad weather.\n\n` +
    `*No action needed from you.* Your money will arrive within 2 hours.\n\n` +
    `_KAVACH — We've got you covered_ ⛨`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimVerificationNeeded(worker, claim) {
  const msg =
    `📸 *KAVACH — Quick Verification Needed*\n\n` +
    `Your ₹${claim.payoutAmount} payout is almost ready!\n\n` +
    `To release your payment, please reply to this message with a *photo from your current location*.\n\n` +
    `This takes less than 10 seconds and your payout will be released within 5 minutes.\n\n` +
    `_If you're unable to send a photo, your claim will be reviewed manually within 24 hours._`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimManualReview(worker, claim) {
  const msg =
    `🔍 *KAVACH — Claim Under Review*\n\n` +
    `Your claim of ₹${claim.payoutAmount} is currently under a brief security review.\n\n` +
    `This usually takes less than 24 hours.\n\n` +
    `If you have any questions, simply reply to this message.\n\n` +
    `_KAVACH Support Team_ ⛨`;

  return sendMessage(worker.phone, msg);
}

async function notifyWeeklyPremiumDue(worker, policy) {
  const msg =
    `🔔 *KAVACH Weekly Renewal*\n\n` +
    `Namaste ${worker.name}!\n\n` +
    `Your new weekly policy is active.\n\n` +
    `• Premium: ₹${policy.premium?.finalAmount}\n` +
    `• Max coverage: ₹${policy.maxPayout?.toLocaleString('en-IN')}\n` +
    `• Valid: Mon–Sun this week\n\n` +
    `Stay safe out there! ⛨`;

  return sendMessage(worker.phone, msg);
}

async function notifyDisruptionAlert(worker, triggerType, level) {
  const msg =
    `⚠️ *KAVACH Disruption Alert*\n\n` +
    `${formatTriggerType(triggerType)} detected in your zone (Level ${level}).\n\n` +
    `Your income is protected. If deliveries stop, your payout will be processed *automatically* — no action needed from you.\n\n` +
    `Stay safe! ⛨`;

  return sendMessage(worker.phone, msg);
}

function formatTriggerType(type) {
  const map = {
    rain:            '🌧 Heavy Rainfall',
    aqi:             '💨 Severe Air Quality',
    flood:           '🌊 Flash Flood',
    curfew:          '🚫 Curfew / Section 144',
    platform_outage: '📵 Platform Outage',
    zone_freeze:     '❄ Zone Supply Freeze',
    heat:            '🌡 Extreme Heat',
  };
  return map[type] || type;
}

module.exports = {
  sendMessage,
  notifyPolicyActivated,
  notifyClaimAutoApproved,
  notifyClaimSoftFlag,
  notifyClaimVerificationNeeded,
  notifyClaimManualReview,
  notifyWeeklyPremiumDue,
  notifyDisruptionAlert,
};
