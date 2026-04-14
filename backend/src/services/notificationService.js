const axios = require('axios');

const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WA_BASE = `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`;

function shouldUseMockWhatsApp() {
  // If the user explicitly disabled mock mode and provided keys, prioritize the real API
  if (process.env.ENABLE_MOCK === 'false' && WA_TOKEN && WA_PHONE_ID) {
    return false;
  }
  return (
    process.env.NODE_ENV === 'development'
    || !WA_TOKEN
    || !WA_PHONE_ID
    || WA_TOKEN.includes('your_whatsapp_token')
    || WA_PHONE_ID.includes('your_phone_id')
  );
}

async function sendMessage(to, message) {
  const phone = to.replace(/\D/g, '');
  const recipient = phone.length === 10 ? `91${phone}` : phone;

  if (shouldUseMockWhatsApp()) {
    console.log(`WhatsApp [${recipient}]: ${message}`);
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
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 3000,
      }
    );
    console.log(`[LIVE] WhatsApp sent successfully to ${recipient}`);
    return data;
  } catch (err) {
    console.error('WhatsApp error:', err.response?.data || err.message);
    return { error: err.message };
  }
}

async function notifyPolicyActivated(worker, policy) {
  const msg =
    `Policy Activated\n\n` +
    `Namaste ${worker.name}!\n\n` +
    `Your income shield is active for this week.\n\n` +
    `Policy Details\n` +
    `- Tier: ${policy.tier?.toUpperCase()}\n` +
    `- Coverage: ${policy.coveragePct * 100}% of predicted loss\n` +
    `- Max payout: Rs${policy.maxPayout?.toLocaleString('en-IN')}\n` +
    `- Valid till: ${new Date(policy.weekEnd).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n` +
    `Weekly premium: Rs${policy.premium?.finalAmount}\n\n` +
    `KAVACH - AI Income Shield for Gig Workers`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimAutoApproved(worker, claim, payout) {
  const msg =
    `Payout Alert\n\n` +
    `Rs${claim.payoutAmount} has been sent to your UPI account.\n\n` +
    `Claim Details\n` +
    `- Disruption: ${formatTriggerType(claim.triggerType)}\n` +
    `- Predicted loss: Rs${claim.predictedLoss}\n` +
    `- Your payout (${claim.policy?.coveragePct ? claim.policy.coveragePct * 100 : 70}%): Rs${claim.payoutAmount}\n` +
    `- UPI Ref: ${payout?.id || 'Processing'}\n\n` +
    `Money should arrive within 1-2 minutes.\n\n` +
    `KAVACH - Always protecting your earnings`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimSoftFlag(worker, claim) {
  const msg =
    `Payout Processing\n\n` +
    `Your Rs${claim.payoutAmount} payout is being processed.\n\n` +
    `We noticed your network signal was weak.\n\n` +
    `No action needed from you. Your money will arrive within 2 hours.\n\n` +
    `KAVACH - We've got you covered`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimVerificationNeeded(worker, claim) {
  const msg =
    `Quick Verification Needed\n\n` +
    `Your Rs${claim.payoutAmount} payout is almost ready.\n\n` +
    `To release your payment, please reply to this message with a photo from your current location.\n\n` +
    `This takes less than 10 seconds and your payout will be released within 5 minutes.\n\n` +
    `If you are unable to send a photo, your claim will be reviewed manually within 24 hours.`;

  return sendMessage(worker.phone, msg);
}

async function notifyClaimManualReview(worker, claim) {
  const msg =
    `Claim Under Review\n\n` +
    `Your claim of Rs${claim.payoutAmount} is currently under a brief security review.\n\n` +
    `This usually takes less than 24 hours.\n\n` +
    `If you have any questions, simply reply to this message.\n\n` +
    `KAVACH Support Team`;

  return sendMessage(worker.phone, msg);
}

async function notifyWeeklyPremiumDue(worker, policy) {
  const msg =
    `Weekly Renewal\n\n` +
    `Namaste ${worker.name}!\n\n` +
    `Your new weekly policy is active.\n\n` +
    `- Premium: Rs${policy.premium?.finalAmount}\n` +
    `- Max coverage: Rs${policy.maxPayout?.toLocaleString('en-IN')}\n` +
    `- Valid: Mon-Sun this week\n\n` +
    `Stay safe out there!`;

  return sendMessage(worker.phone, msg);
}

async function notifyDisruptionAlert(worker, triggerType, level) {
  const msg =
    `Disruption Alert\n\n` +
    `${formatTriggerType(triggerType)} detected in your zone (Level ${level}).\n\n` +
    `Your income is protected. If deliveries stop, your payout will be processed automatically - no action needed from you.\n\n` +
    `Stay safe!`;

  return sendMessage(worker.phone, msg);
}

function formatTriggerType(type) {
  const map = {
    rain: 'Heavy Rainfall',
    aqi: 'Severe Air Quality',
    flood: 'Flash Flood',
    curfew: 'Curfew / Section 144',
    platform_outage: 'Platform Outage',
    zone_freeze: 'Zone Supply Freeze',
    heat: 'Extreme Heat',
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
