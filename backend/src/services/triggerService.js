const axios = require('axios');

// ─── Trigger level multipliers ────────────────────────────────────────────────
const LEVEL_MULTIPLIERS = {
  1: 0.60,  // Minor
  2: 0.85,  // Moderate
  3: 1.00,  // Major
  4: 1.00,  // Catastrophic (capped at policy max)
};

const DEFAULT_TRIGGER_WINDOWS = {
  rain:            { 1: 60,  2: 120, 3: 180, 4: 240 },
  aqi:             { 1: 240, 2: 360, 3: 480, 4: 720 },
  flood:           { 1: 360, 2: 480, 3: 720, 4: 1440 },
  curfew:          { 1: 240, 2: 480, 3: 720, 4: 1440 },
  platform_outage: { 1: 45,  2: 90,  3: 180, 4: 360 },
  zone_freeze:     { 1: 60,  2: 120, 3: 180, 4: 360 },
  heat:            { 1: 180, 2: 240, 3: 360, 4: 480 },
};

// ─── City coordinates for API calls ──────────────────────────────────────────
const CITY_COORDS = {
  chennai:    { lat: 13.0827, lon: 80.2707 },
  mumbai:     { lat: 19.0760, lon: 72.8777 },
  delhi:      { lat: 28.6139, lon: 77.2090 },
  bengaluru:  { lat: 12.9716, lon: 77.5946 },
  hyderabad:  { lat: 17.3850, lon: 78.4867 },
  pune:       { lat: 18.5204, lon: 73.8567 },
  kolkata:    { lat: 22.5726, lon: 88.3639 },
  ahmedabad:  { lat: 23.0225, lon: 72.5714 },
  jaipur:     { lat: 26.9124, lon: 75.7873 },
  lucknow:    { lat: 26.8467, lon: 80.9462 },
  surat:      { lat: 21.1702, lon: 72.8311 },
  kochi:      { lat: 9.9312, lon: 76.2673 },
  chandigarh: { lat: 30.7333, lon: 76.7794 },
  indore:     { lat: 22.7196, lon: 75.8577 },
  nagpur:     { lat: 21.1458, lon: 79.0882 },
  coimbatore: { lat: 11.0168, lon: 76.9558 },
};

const AQI_CITY_MAP = {
  chennai: 'chennai',
  mumbai: 'mumbai',
  delhi: 'delhi',
  bengaluru: 'bangalore',
  hyderabad: 'hyderabad',
  pune: 'pune',
  kolkata: 'kolkata',
  ahmedabad: 'ahmedabad',
  jaipur: 'jaipur',
  lucknow: 'lucknow',
  surat: 'surat',
  kochi: 'kochi',
  chandigarh: 'chandigarh',
  indore: 'indore',
  nagpur: 'nagpur',
  coimbatore: 'coimbatore',
};

function withObservation(result, observedAt = new Date()) {
  return {
    ...result,
    confirmedAt: new Date(observedAt).toISOString(),
  };
}

function deriveDisruptionWindow(triggerType, triggerData = {}, referenceTime = new Date()) {
  const normalizedType = triggerType || 'zone_freeze';
  const level = Math.max(1, Math.min(4, Number(triggerData.level) || 1));
  const observedAt = triggerData.confirmedAt ? new Date(triggerData.confirmedAt) : new Date(referenceTime);
  const end = new Date(Math.max(observedAt.getTime(), new Date(referenceTime).getTime()));
  const durationMinutes = DEFAULT_TRIGGER_WINDOWS[normalizedType]?.[level] || 120;
  const start = new Date(end.getTime() - durationMinutes * 60 * 1000);

  return {
    disruptionStart: start,
    disruptionEnd: end,
    durationMinutes,
    inferredFrom: triggerData.source || 'latest trigger observation',
    methodology: `Window inferred on the backend from the current ${normalizedType} trigger severity and observation time.`,
  };
}

// ─── 1. RAIN TRIGGER — OpenWeatherMap (free tier) ─────────────────────────────
async function checkRainTrigger(city) {
  try {
    if (process.env.NODE_ENV === 'development') {
      return getMockRainData(city);
    }

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
    return withObservation(evaluateRain(rainfall, city), data.dt ? new Date(data.dt * 1000) : new Date());
  } catch (err) {
    console.error('Rain API error:', err.message);
    return withObservation({ triggered: false, source: 'OpenWeatherMap', error: err.message });
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
    return withObservation({ triggered: true, level: 3, value: '28mm/hr', source: 'OpenWeatherMap (mock)' });
  }
  return withObservation({ triggered: false, source: 'OpenWeatherMap (mock)', value: '2mm/hr' });
}

// ─── 2. AQI TRIGGER — CPCB / mock ────────────────────────────────────────────
async function checkAQITrigger(city) {
  try {
    if (process.env.NODE_ENV === 'development') {
      return getMockAQIData(city);
    }

    const apiKey = process.env.AQICN_API_KEY || 'mock';

    if (apiKey === 'mock') {
      return getMockAQIData(city);
    }

    const cityKey = AQI_CITY_MAP[city] || city;
    const url = `https://api.waqi.info/feed/${cityKey}/?token=${apiKey}`;
    const { data } = await axios.get(url, { timeout: 5000 });

    const aqi = data.data?.aqi || 0;
    return withObservation(evaluateAQI(aqi), data.data?.time?.iso || new Date());
  } catch (err) {
    console.error('AQI API error:', err.message);
    return withObservation({ triggered: false, source: 'CPCB AQI', error: err.message });
  }
}

function evaluateAQI(aqi) {
  if (aqi >= 400) return { triggered: true,  level: 4, value: `AQI ${aqi}`, source: 'CPCB AQI' };
  if (aqi >= 300) return { triggered: true,  level: 3, value: `AQI ${aqi}`, source: 'CPCB AQI' };
  if (aqi >= 200) return { triggered: true,  level: 2, value: `AQI ${aqi}`, source: 'CPCB AQI' };
  if (aqi >= 150) return { triggered: true,  level: 1, value: `AQI ${aqi}`, source: 'CPCB AQI' };
  return { triggered: false, source: 'CPCB AQI', value: `AQI ${aqi}` };
}

function getMockAQIData(city) {
  const month = new Date().getMonth() + 1;
  const isDelhiSmog = city === 'delhi' && [11, 12, 1, 2].includes(month);
  if (isDelhiSmog) {
    return withObservation({ triggered: true, level: 3, value: 'AQI 342', source: 'CPCB AQI (mock)' });
  }
  return withObservation({ triggered: false, source: 'CPCB AQI (mock)', value: 'AQI 85' });
}

// ─── 3. PLATFORM OUTAGE TRIGGER — heartbeat check ─────────────────────────────
async function checkPlatformOutage(platform) {
  try {
    const endpoints = {
      zomato: 'https://api.zomato.com',
      swiggy: 'https://www.swiggy.com',
    };

    const url = endpoints[platform];
    if (!url) return withObservation({ triggered: false, source: 'Platform Heartbeat' });

    const start = Date.now();
    await axios.get(url, { timeout: 8000 });
    const latency = Date.now() - start;

    // p95 latency > 8000ms = outage trigger
    if (latency > 8000) {
      return withObservation({ triggered: true, level: 3, value: `${latency}ms latency`, source: 'Platform Heartbeat' });
    }
    return withObservation({ triggered: false, source: 'Platform Heartbeat', value: `${latency}ms` });
  } catch (err) {
    // Timeout or connection refused = outage
    return withObservation({
      triggered: true,
      level: 3,
      value: 'Connection failed',
      source: 'Platform Heartbeat',
    });
  }
}

// ─── 4. CURFEW / CIVIL TRIGGER — mock (Phase 3: real govt API) ───────────────
async function checkCurfewTrigger(city) {
  // Mock — in production connect to:
  // State police Twitter API + PIB press release feed + news NLP classifier
  // For now returns false unless manually triggered via /api/triggers/simulate
  return withObservation({ triggered: false, source: 'Civil Alert API (mock)', value: 'No active alerts' });
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
      return withObservation({ triggered: true, level: 3, value: 'River level RED alert', source: 'CWC API (mock)' });
    }
  }
  return withObservation({ triggered: false, source: 'CWC API (mock)', value: 'Normal levels' });
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
    return { anyTriggered: false, results };
  }

  const [topType, topData] = triggered[0];
  const triggerType = mapTriggerType(topType);
  const window = deriveDisruptionWindow(triggerType, topData);

  return {
    anyTriggered:  true,
    triggerType,
    triggerLevel:  topData.level,
    triggerSource: topData,
    disruptionStart: window.disruptionStart,
    disruptionEnd: window.disruptionEnd,
    disruptionWindowMinutes: window.durationMinutes,
    windowMethodology: window.methodology,
    allResults:    results,
  };
}

async function verifyTriggerForWorker(worker, requestedTriggerType) {
  const triggerType = requestedTriggerType || 'rain';
  let triggerData;

  switch (triggerType) {
    case 'rain':
      triggerData = await checkRainTrigger(worker.city);
      break;
    case 'aqi':
      triggerData = await checkAQITrigger(worker.city);
      break;
    case 'flood':
      triggerData = await checkFloodTrigger(worker.city);
      break;
    case 'curfew':
      triggerData = await checkCurfewTrigger(worker.city);
      break;
    case 'platform_outage': {
      const platformResults = await Promise.all((worker.platforms || []).map((platform) => checkPlatformOutage(platform.name)));
      const triggered = platformResults.filter((result) => result.triggered).sort((a, b) => (b.level || 0) - (a.level || 0));
      triggerData = triggered[0] || withObservation({ triggered: false, source: 'Platform Heartbeat', value: 'No outage detected' });
      break;
    }
    default:
      return runAllTriggers(worker, worker.platforms || []);
  }

  if (!triggerData?.triggered) {
    return { anyTriggered: false, triggerType, triggerSource: triggerData };
  }

  const window = deriveDisruptionWindow(triggerType, triggerData);

  return {
    anyTriggered: true,
    triggerType,
    triggerLevel: triggerData.level,
    triggerSource: triggerData,
    disruptionStart: window.disruptionStart,
    disruptionEnd: window.disruptionEnd,
    disruptionWindowMinutes: window.durationMinutes,
    windowMethodology: window.methodology,
  };
}

function buildSimulatedTrigger(triggerType, level = 3) {
  const simulatedSource = withObservation({
    triggered: true,
    level,
    source: `${triggerType} simulated`,
    value: 'Simulated trigger',
  });
  const window = deriveDisruptionWindow(triggerType, simulatedSource);

  return {
    anyTriggered: true,
    triggerType,
    triggerLevel: level,
    triggerSource: simulatedSource,
    disruptionStart: window.disruptionStart,
    disruptionEnd: window.disruptionEnd,
    disruptionWindowMinutes: window.durationMinutes,
    windowMethodology: window.methodology,
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
  deriveDisruptionWindow,
  verifyTriggerForWorker,
  buildSimulatedTrigger,
  LEVEL_MULTIPLIERS,
};
