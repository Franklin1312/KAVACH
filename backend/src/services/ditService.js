const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || '8000', 10);

const CITY_TYPE_MAP = {
  mumbai: 'Metropolitian',
  delhi: 'Metropolitian',
  bengaluru: 'Metropolitian',
  bangalore: 'Metropolitian',
  kolkata: 'Metropolitian',
  chennai: 'Urban',
  hyderabad: 'Urban',
  pune: 'Urban',
  ahmedabad: 'Urban',
  surat: 'Urban',
  lucknow: 'Urban',
  kochi: 'Urban',
  coimbatore: 'Urban',
  indore: 'Urban',
  nagpur: 'Urban',
  chandigarh: 'Semi-Urban',
  jaipur: 'Semi-Urban'
};

const PEAK_HOURS = {
  zomato: [
    { start: 12, end: 14, multiplier: 1.4 },
    { start: 19, end: 22, multiplier: 1.5 },
    { start: 8, end: 10, multiplier: 0.8 }
  ],
  swiggy: [
    { start: 12, end: 14, multiplier: 1.3 },
    { start: 19, end: 22, multiplier: 1.5 },
    { start: 15, end: 17, multiplier: 0.9 }
  ],
  blinkit: [
    { start: 9, end: 21, multiplier: 1.0 }
  ]
};

const DAY_MULTIPLIERS = {
  0: 1.2,
  1: 0.85,
  2: 0.85,
  3: 0.9,
  4: 0.95,
  5: 1.15,
  6: 1.3
};

const TRIGGER_TO_WEATHER = {
  rain: 'Stormy',
  flood: 'Stormy',
  aqi: 'Fog',
  heat: 'Sunny',
  curfew: 'Sunny',
  platform_outage: 'Cloudy',
  zone_freeze: 'Cloudy',
  default: 'Sunny'
};

const TRIGGER_TO_TRAFFIC = {
  flood: 'Jam',
  curfew: 'Jam',
  zone_freeze: 'Jam',
  rain: 'High',
  aqi: 'High',
  platform_outage: 'Medium',
  heat: 'Medium',
  default: 'Medium'
};

function getHourMultiplier(hour, platform) {
  const peaks = PEAK_HOURS[platform] || PEAK_HOURS.zomato;
  for (const peak of peaks) {
    if (hour >= peak.start && hour < peak.end) return peak.multiplier;
  }
  return 0.6;
}

function ruleBasedPrediction(worker, windowStart, windowEnd) {
  const income = worker.verifiedWeeklyIncome || worker.declaredWeeklyIncome || 5000;
  const dailyBase = income / 6;
  const hourlyBase = dailyBase / 10;

  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const hours = Math.max(0.5, (end - start) / (1000 * 60 * 60));
  const dayMult = DAY_MULTIPLIERS[start.getDay()] || 1.0;
  const platform = worker.platforms?.[0]?.name || 'zomato';
  const hourMult = getHourMultiplier(start.getHours(), platform);

  const predicted = Math.round(hourlyBase * hours * dayMult * hourMult);
  return Math.max(50, predicted);
}

function buildPredictionPayload(worker, windowStartTime, windowEndTime, triggerContext = {}) {
  const income = worker.verifiedWeeklyIncome || worker.declaredWeeklyIncome || 5000;
  const platforms = worker.platforms?.map((p) => p.name).filter(Boolean) || ['zomato'];
  const normalizedCity = String(worker.city || '').toLowerCase();
  const cityType = CITY_TYPE_MAP[normalizedCity] || 'Urban';
  const triggerType = triggerContext.triggerType || 'default';

  return {
    worker_id: String(worker._id),
    weekly_income: income,
    city: cityType,
    zone: worker.zone || 'unknown',
    window_start: new Date(windowStartTime).toISOString(),
    window_end: new Date(windowEndTime).toISOString(),
    platforms,
    weather_condition: triggerContext.weatherCondition || TRIGGER_TO_WEATHER[triggerType] || TRIGGER_TO_WEATHER.default,
    road_traffic_density: triggerContext.roadTrafficDensity || TRIGGER_TO_TRAFFIC[triggerType] || TRIGGER_TO_TRAFFIC.default,
    delivery_rating: triggerContext.deliveryRating || 4.0,
    multiple_deliveries: triggerContext.multipleDeliveries || 1,
    vehicle_type: triggerContext.vehicleType || 'motorcycle',
    delivery_person_age: triggerContext.deliveryPersonAge || 28,
    is_festival: Boolean(triggerContext.isFestival)
  };
}

async function requestMlPrediction(payload) {
  const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, payload, { timeout: ML_TIMEOUT_MS });
  return data;
}

async function predictEarnings(worker, windowStartTime, windowEndTime) {
  const payload = buildPredictionPayload(worker, windowStartTime, windowEndTime);

  try {
    const data = await requestMlPrediction(payload);
    return data.predicted_earnings;
  } catch (err) {
    const reason = err.code === 'ECONNREFUSED' ? 'ML service not running'
      : err.code === 'ECONNABORTED' ? 'ML service timeout'
      : err.response?.data?.detail || err.message;
    console.warn(`[DIT] ML service unavailable (${reason}), using rule-based fallback`);
    return ruleBasedPrediction(worker, windowStartTime, windowEndTime);
  }
}

async function enrichAndPredict(worker, windowStartTime, windowEndTime, triggerContext = {}) {
  const payload = buildPredictionPayload(worker, windowStartTime, windowEndTime, triggerContext);

  try {
    const data = await requestMlPrediction(payload);
    return {
      predictedEarnings: data.predicted_earnings,
      confidence: data.confidence,
      ordersPerHour: data.orders_per_hour_estimate,
      source: 'ml'
    };
  } catch {
    return {
      predictedEarnings: ruleBasedPrediction(worker, windowStartTime, windowEndTime),
      confidence: 0.6,
      ordersPerHour: null,
      source: 'rule_based'
    };
  }
}

async function checkMLHealth() {
  try {
    const { data } = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

module.exports = { predictEarnings, enrichAndPredict, checkMLHealth };
