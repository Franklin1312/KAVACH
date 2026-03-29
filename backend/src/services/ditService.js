// ─── Digital Income Twin (DIT) — Earning Prediction ─────────────────────────
// In production: XGBoost model trained per worker via Python FastAPI service
// For Phase 2: rule-based model using worker's income + time patterns

const axios = require('axios');

// Peak hours by platform type
const PEAK_HOURS = {
  zomato: [
    { start: 12, end: 14, multiplier: 1.4 },  // Lunch
    { start: 19, end: 22, multiplier: 1.5 },  // Dinner
    { start: 8,  end: 10, multiplier: 0.8 },  // Morning
  ],
  swiggy: [
    { start: 12, end: 14, multiplier: 1.3 },
    { start: 19, end: 22, multiplier: 1.5 },
    { start: 15, end: 17, multiplier: 0.9 },  // Snack time
  ],
  blinkit: [
    { start: 9,  end: 21, multiplier: 1.0 },  // All day uniform
  ],
};

// Day of week multipliers (0=Sun, 1=Mon ... 6=Sat)
const DAY_MULTIPLIERS = {
  0: 1.2,  // Sunday — high orders
  1: 0.85, // Monday — quiet
  2: 0.85,
  3: 0.90,
  4: 0.95,
  5: 1.15, // Friday — rising
  6: 1.3,  // Saturday — peak
};

function getHourMultiplier(hour, platform) {
  const peaks = PEAK_HOURS[platform] || PEAK_HOURS.zomato;
  for (const peak of peaks) {
    if (hour >= peak.start && hour < peak.end) return peak.multiplier;
  }
  return 0.6; // off-peak
}

// ─── Predict earnings for a time window ──────────────────────────────────────
async function predictEarnings(worker, windowStartTime, windowEndTime) {
  try {
    // Try ML service first (Python FastAPI)
    if (process.env.ML_SERVICE_URL && process.env.ML_SERVICE_URL !== 'http://localhost:8000') {
      const { data } = await axios.post(
        `${process.env.ML_SERVICE_URL}/predict`,
        {
          worker_id:       worker._id,
          weekly_income:   worker.verifiedWeeklyIncome || worker.declaredWeeklyIncome,
          city:            worker.city,
          zone:            worker.zone,
          window_start:    windowStartTime,
          window_end:      windowEndTime,
          platforms:       worker.platforms.map((p) => p.name),
        },
        { timeout: 3000 }
      );
      return data.predicted_earnings;
    }
  } catch {
    // Fall back to rule-based model
  }

  return ruleBasedPrediction(worker, windowStartTime, windowEndTime);
}

function ruleBasedPrediction(worker, windowStart, windowEnd) {
  const income     = worker.verifiedWeeklyIncome || worker.declaredWeeklyIncome || 5000;
  const dailyBase  = income / 6; // assume 6 working days
  const hourlyBase = dailyBase / 10; // assume 10 working hours

  const start   = new Date(windowStart);
  const end     = new Date(windowEnd);
  const hours   = Math.max(0.5, (end - start) / (1000 * 60 * 60));

  const dayMult  = DAY_MULTIPLIERS[start.getDay()] || 1.0;
  const platform = worker.platforms?.[0]?.name || 'zomato';
  const hourMult = getHourMultiplier(start.getHours(), platform);

  const predicted = Math.round(hourlyBase * hours * dayMult * hourMult);
  return Math.max(50, predicted); // minimum ₹50 prediction
}

module.exports = { predictEarnings };
