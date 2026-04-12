// ─── Premium Calculation Engine ───────────────────────────────────────────────
// Formula:
// Premium = (baseRate × zoneRiskFactor × seasonMultiplier - claimsFreeDiscount) × tierMultiplier + surgeLoading

const TIER_CONFIG = {
  basic:    { coveragePct: 0.50, tierMultiplier: 0.70 },
  standard: { coveragePct: 0.70, tierMultiplier: 1.00 },
  premium:  { coveragePct: 0.85, tierMultiplier: 1.35 },
};

// Base rate by weekly income band
function getBaseRate(weeklyIncome) {
  if (weeklyIncome <= 3500) return 0.0085;
  if (weeklyIncome <= 5500) return 0.0080;
  if (weeklyIncome <= 8000) return 0.0075;
  return 0.0070;
}

// Season multiplier by city + current month
function getSeasonMultiplier(city) {
  const month = new Date().getMonth() + 1;
  const seasons = {
    chennai:    { neMonsoon: [10,11,12], swMonsoon: [6,7,8,9] },
    mumbai:     { swMonsoon: [6,7,8,9] },
    bengaluru:  { neMonsoon: [10,11,12], swMonsoon: [6,7,8,9] },
    delhi:      { smog: [11,12,1,2] },
    hyderabad:  { swMonsoon: [6,7,8,9] },
    pune:       { swMonsoon: [6,7,8,9] },
    kolkata:    { swMonsoon: [6,7,8,9] },
    ahmedabad:  { swMonsoon: [6,7,8,9] },
    surat:      { swMonsoon: [6,7,8,9] },
    kochi:      { swMonsoon: [6,7,8,9] },
    coimbatore: { neMonsoon: [10,11,12] },
    nagpur:     { swMonsoon: [6,7,8,9] },
    indore:     { swMonsoon: [6,7,8,9] },
    jaipur:     { smog: [11,12,1,2] },
    lucknow:    { smog: [11,12,1,2] },
    chandigarh: { smog: [11,12,1,2] },
  };
  const citySeasons = seasons[city] || {};
  if (citySeasons.neMonsoon?.includes(month)) return 1.45;
  if (citySeasons.swMonsoon?.includes(month)) return 1.55;
  if (citySeasons.smog?.includes(month))      return 1.20;
  return 0.80;
}

// Claims-free discount
function getClaimsFreeDiscount(claimsFreeWeeks) {
  if (claimsFreeWeeks >= 8) return 0.15;
  if (claimsFreeWeeks >= 4) return 0.08;
  return 0;
}

// Surge loading calibrated from IMD historical disruption data
// Uses trigger probability per city per season instead of flat rules
function getSurgeLoading(city, zoneRiskFactor) {
  const { getSeasonalTriggerProbability } = require('./historicalDisruption');
  const triggerProb = getSeasonalTriggerProbability(city);
  const seasonMultiplier = getSeasonMultiplier(city);

  // Scale surge loading by historical trigger probability
  // Base: ₹0 at 0% trigger probability, up to ₹20 at 50%+ probability
  const baseSurge = Math.round(triggerProb * 40);

  // Zone risk factor amplifies surge for high-risk zones
  const zoneAmplifier = zoneRiskFactor >= 1.3 ? 1.5 : zoneRiskFactor >= 1.0 ? 1.0 : 0.7;

  // Season factor for extreme months
  const seasonAmplifier = seasonMultiplier >= 1.45 ? 1.3 : 1.0;

  return Math.min(20, Math.round(baseSurge * zoneAmplifier * seasonAmplifier));
}

// ─── Main calculation function ─────────────────────────────────────────────────
function calculatePremium({ weeklyIncome, zoneRiskFactor, city, claimsFreeWeeks, tier }) {
  const income       = weeklyIncome || 5000;
  const zoneFactor   = zoneRiskFactor || 1.0;
  const cfWeeks      = claimsFreeWeeks || 0;
  const selectedTier = tier || 'standard';

  const { coveragePct, tierMultiplier } = TIER_CONFIG[selectedTier];

  const baseRate          = getBaseRate(income);
  const baseAmount        = income * baseRate;
  const afterZone         = baseAmount * zoneFactor;
  const seasonMultiplier  = getSeasonMultiplier(city);
  const afterSeason       = afterZone * seasonMultiplier;
  const discountPct       = getClaimsFreeDiscount(cfWeeks);
  const discountAmount    = afterSeason * discountPct;
  const afterDiscount     = afterSeason - discountAmount;
  const surgeLoading      = getSurgeLoading(city, zoneFactor);
  const beforeTier        = afterDiscount + surgeLoading;
  const finalAmount       = Math.max(15, Math.round(beforeTier * tierMultiplier));
  const maxPayout         = Math.round(income * coveragePct);

  return {
    breakdown: {
      weeklyIncome:       income,
      baseRate:           (baseRate * 100).toFixed(2) + '%',
      baseAmount:         +baseAmount.toFixed(2),
      zoneRiskFactor:     zoneFactor,
      afterZone:          +afterZone.toFixed(2),
      seasonMultiplier,
      afterSeason:        +afterSeason.toFixed(2),
      claimsFreeDiscount: (discountPct * 100) + '%',
      discountAmount:     +discountAmount.toFixed(2),
      surgeLoading,
      tierMultiplier,
      finalAmount,
    },
    finalAmount,
    coveragePct,
    maxPayout,
    tier: selectedTier,
  };
}

module.exports = { calculatePremium, TIER_CONFIG, getSeasonMultiplier };
