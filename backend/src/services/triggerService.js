const axios = require('axios');

// ─── Trigger level multipliers ────────────────────────────────────────────────
const LEVEL_MULTIPLIERS = {
  1: 0.60,  // Minor
  2: 0.85,  // Moderate
  3: 1.00,  // Major
  4: 1.00,  // Catastrophic (capped at policy max)
};

// ─── City coordinates for API calls ──────────────────────────────────────────
const CITY_COORDS = {
  chennai:   { lat: 13.0827, lon: 80.2707 },
  mumbai:    { lat: 19.0760, lon: 72.8777 },
  delhi:     { lat: 28.6139, lon: 77.2090 },
  bengaluru: { lat: 12.9716, lon: 77.5946 },
};

// ─── 1. RAIN TRIGGER — OpenWeatherMap (free tier) ─────────────────────────────
async function checkRainTrigger(city) {
  try {
    const { lat, lon } = CITY_COORDS[city] || CITY_COORDS.chennai;

    // Real API call — uses free OpenWeatherMap key
    // Replace YOUR_API_KEY with actual key from openweathermap.org
    const apiKey = process.env.OPENWEATHER_API_KEY || 'mock';

    if (apiKey === 'mock') {
      // Mock response for development
      return getMockRainData(city);
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const { data } = await axios.get(url, { timeout: 5000 });

    const rainfall = data.rain?.['1h'] || data.rain?.['3h'] || 0;
    return evaluateRain(rainfall, city);
  } catch (err) {
    console.error('Rain API error:', err.message);
    return { triggered: false, source: 'OpenWeatherMap', error: err.message };
  }
}

function evaluateRain(rainfallMm, city) {
  // Thresholds per 1 hour (scale: 35mm/3hr = ~12mm/hr)
  if (rainfallMm >= 33)  return { triggered: true,  level: 4, value: `${rainfallMm}mm/hr`, source: 'OpenWeatherMap' };
  if (rainfallMm >= 25)  return { triggered: true,  level: 3, value: `${rainfallMm}mm/hr`, source: 'OpenWeatherMap' };
  if (rainfallMm >= 17)  return { triggered: true,  level: 2, value: `${rainfallMm}mm/hr`, source: 'OpenWeatherMap' };
  if (rainfallMm >= 12)  return { triggered: true,  level: 1, value: `${rainfallMm}mm/hr`, source: 'OpenWeatherMap' };
  return { triggered: false, source: 'OpenWeatherMap', value: `${rainfallMm}mm/hr` };
}

function getMockRainData(city) {
  // Simulate heavy rain for Chennai during monsoon months
  const month = new Date().getMonth() + 1;
  const isChennaiMonsoon = city === 'chennai' && [10, 11, 12].includes(month);
  const isMumbaiMonsoon  = city === 'mumbai'  && [6, 7, 8, 9].includes(month);

  if (isChennaiMonsoon || isMumbaiMonsoon) {
    return { triggered: true, level: 3, value: '28mm/hr', source: 'OpenWeatherMap (mock)' };
  }
  return { triggered: false, source: 'OpenWeatherMap (mock)', value: '2mm/hr' };
}

// ─── 2. AQI TRIGGER — CPCB / mock ────────────────────────────────────────────
async function checkAQITrigger(city) {
  try {
    const apiKey = process.env.AQICN_API_KEY || 'mock';

    if (apiKey === 'mock') {
      return getMockAQIData(city);
    }

    const cityMap = {
      delhi:     'delhi',
      mumbai:    'mumbai',
      chennai:   'chennai',
      bengaluru: 'bangalore',
    };

    const url = `https://api.waqi.info/feed/${cityMap[city]}/?token=${apiKey}`;
    const { data } = await axios.get(url, { timeout: 5000 });

    const aqi = data.data?.aqi || 0;
    return evaluateAQI(aqi);
  } catch (err) {
    console.error('AQI API error:', err.message);
    return { triggered: false, source: 'CPCB AQI', error: err.message };
  }
}

function evaluateAQI(aqi) {
  if (aqi >= 400) return { triggered: true,  level: 4, value: `AQI ${aqi}`, source: 'CPCB AQI' };
  if (aqi >= 300) return { triggered: true,  level: 3, value: `AQI ${aqi}`, source: 'CPCB AQI' };
  if (aqi >= 200) return { triggered: true,  level: 2, value: `AQI ${aqi}`, source: 'CPCB AQI' };
  return { triggered: false, source: 'CPCB AQI', value: `AQI ${aqi}` };
}

function getMockAQIData(city) {
  const month = new Date().getMonth() + 1;
  const isDelhiSmog = city === 'delhi' && [11, 12, 1, 2].includes(month);
  if (isDelhiSmog) {
    return { triggered: true, level: 4, value: 'AQI 432', source: 'CPCB AQI (mock)' };
  }
  return { triggered: false, source: 'CPCB AQI (mock)', value: 'AQI 85' };
}

// ─── 3. PLATFORM OUTAGE TRIGGER — heartbeat check ─────────────────────────────
async function checkPlatformOutage(platform) {
  try {
    const endpoints = {
      zomato: 'https://api.zomato.com',
      swiggy: 'https://www.swiggy.com',
    };

    const url = endpoints[platform];
    if (!url) return { triggered: false, source: 'Platform Heartbeat' };

    const start = Date.now();
    await axios.get(url, { timeout: 8000 });
    const latency = Date.now() - start;

    // p95 latency > 8000ms = outage trigger
    if (latency > 8000) {
      return { triggered: true, level: 3, value: `${latency}ms latency`, source: 'Platform Heartbeat' };
    }
    return { triggered: false, source: 'Platform Heartbeat', value: `${latency}ms` };
  } catch (err) {
    // Timeout or connection refused = outage
    return {
      triggered: true,
      level: 3,
      value: 'Connection failed',
      source: 'Platform Heartbeat',
    };
  }
}

// ─── 4. CURFEW / CIVIL TRIGGER — mock (Phase 3: real govt API) ───────────────
async function checkCurfewTrigger(city) {
  // Mock — in production connect to:
  // State police Twitter API + PIB press release feed + news NLP classifier
  // For now returns false unless manually triggered via /api/triggers/simulate
  return { triggered: false, source: 'Civil Alert API (mock)', value: 'No active alerts' };
}

// ─── 5. FLOOD TRIGGER — CWC mock ─────────────────────────────────────────────
async function checkFloodTrigger(city) {
  // Mock — in production connect to CWC (Central Water Commission) river level API
  const floodProneCities = ['mumbai', 'chennai'];
  const month = new Date().getMonth() + 1;
  const isMonsoon = [6, 7, 8, 9, 10, 11].includes(month);

  if (floodProneCities.includes(city) && isMonsoon) {
    // 10% chance of flood trigger during monsoon for demo
    const triggered = Math.random() < 0.1;
    if (triggered) {
      return { triggered: true, level: 3, value: 'River level RED alert', source: 'CWC API (mock)' };
    }
  }
  return { triggered: false, source: 'CWC API (mock)', value: 'Normal levels' };
}

// ─── Master check: run all triggers for a worker ──────────────────────────────
async function runAllTriggers(worker, platforms) {
  const city = worker.city;
  const results = {};

  // Run all checks in parallel
  const [rain, aqi, flood, curfew] = await Promise.all([
    checkRainTrigger(city),
    checkAQITrigger(city),
    checkFloodTrigger(city),
    checkCurfewTrigger(city),
  ]);

  results.rain   = rain;
  results.aqi    = aqi;
  results.flood  = flood;
  results.curfew = curfew;

  // Platform outage checks
  for (const platform of platforms) {
    results[`${platform.name}_outage`] = await checkPlatformOutage(platform.name);
  }

  // Find highest active trigger
  const triggered = Object.entries(results)
    .filter(([, v]) => v.triggered)
    .sort(([, a], [, b]) => b.level - a.level);

  if (triggered.length === 0) {
    return {
      anyTriggered: false,
      triggerType: null,
      triggerLevel: null,
      triggerSource: null,
      allResults: results,
      results,
    };
  }

  const [topType, topData] = triggered[0];

  return {
    anyTriggered:  true,
    triggerType:   mapTriggerType(topType),
    triggerLevel:  topData.level,
    triggerSource: topData,
    allResults:    results,
  };
}

function mapTriggerType(key) {
  if (key.includes('rain'))    return 'rain';
  if (key.includes('aqi'))     return 'aqi';
  if (key.includes('flood'))   return 'flood';
  if (key.includes('curfew'))  return 'curfew';
  if (key.includes('outage'))  return 'platform_outage';
  return 'zone_freeze';
}

module.exports = {
  runAllTriggers,
  checkRainTrigger,
  checkAQITrigger,
  checkPlatformOutage,
  checkCurfewTrigger,
  checkFloodTrigger,
  LEVEL_MULTIPLIERS,
};
