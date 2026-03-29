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
  const month = new Date().getMonth() + 1; // 1–12

  const seasons = {
    chennai: {
      // NE Monsoon: Oct–Dec
      neMonsoon: [10, 11, 12],
      // SW Monsoon: Jun–Sep
      swMonsoon: [6, 7, 8, 9],
    },
    mumbai: {
      swMonsoon: [6, 7, 8, 9],
    },
    bengaluru: {
      neMonsoon: [10, 11, 12],
      swMonsoon: [6, 7, 8, 9],
    },
    delhi: {
      // Winter smog: Nov–Feb
      smog: [11, 12, 1, 2],
    },
  };

  const citySeasons = seasons[city] || {};

  if (citySeasons.neMonsoon?.includes(month)) return 1.45;
  if (citySeasons.swMonsoon?.includes(month)) return 1.55;
  if (citySeasons.smog?.includes(month))      return 1.20;
  return 0.80; // dry / off-season
}

// Claims-free discount
function getClaimsFreeDiscount(claimsFreeWeeks) {
  if (claimsFreeWeeks >= 8) return 0.15;
  if (claimsFreeWeeks >= 4) return 0.08;
  return 0;
}

// Surge loading based on weather forecast risk (mock — Phase 3 will use real 7-day forecast)
function getSurgeLoading(city, zoneRiskFactor) {
  // High risk zone in monsoon season gets surge loading
  const seasonMultiplier = getSeasonMultiplier(city);
  if (zoneRiskFactor >= 1.3 && seasonMultiplier >= 1.45) return 14;
  if (zoneRiskFactor >= 1.3 || seasonMultiplier >= 1.45) return 8;
  return 0;
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
