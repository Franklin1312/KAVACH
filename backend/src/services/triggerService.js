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

// ─── Ward-level zone coordinates ─────────────────────────────────────────────
// Precise lat/lon for each zone, used for hyper-local weather/AQI queries.
// Falls back to CITY_COORDS when zone is unknown.
const ZONE_COORDS = {
  // Chennai
  chennai: {
    anna_nagar:      { lat: 13.0850, lon: 80.2101 },
    t_nagar:         { lat: 13.0418, lon: 80.2341 },
    adyar:           { lat: 13.0067, lon: 80.2565 },
    marina:          { lat: 13.0500, lon: 80.2824 },
    tambaram:        { lat: 12.9249, lon: 80.1000 },
    velachery:       { lat: 12.9815, lon: 80.2180 },
    sholinganallur:  { lat: 12.9010, lon: 80.2279 },
    porur:           { lat: 13.0382, lon: 80.1564 },
    ambattur:        { lat: 13.0982, lon: 80.1620 },
    perungudi:       { lat: 12.9614, lon: 80.2465 },
  },
  // Mumbai
  mumbai: {
    bandra:    { lat: 19.0596, lon: 72.8295 },
    andheri:   { lat: 19.1136, lon: 72.8697 },
    dharavi:   { lat: 19.0434, lon: 72.8526 },
    kurla:     { lat: 19.0726, lon: 72.8796 },
    dadar:     { lat: 19.0177, lon: 72.8428 },
    borivali:  { lat: 19.2288, lon: 72.8544 },
    worli:     { lat: 19.0176, lon: 72.8152 },
    colaba:    { lat: 18.9067, lon: 72.8147 },
    powai:     { lat: 19.1176, lon: 72.9060 },
    vikhroli:  { lat: 19.1097, lon: 72.9273 },
  },
  // Delhi
  delhi: {
    connaught_place: { lat: 28.6315, lon: 77.2167 },
    lajpat_nagar:    { lat: 28.5700, lon: 77.2400 },
    dwarka:          { lat: 28.5921, lon: 77.0460 },
    rohini:          { lat: 28.7495, lon: 77.0565 },
    saket:           { lat: 28.5244, lon: 77.2066 },
    noida_sec_62:    { lat: 28.6270, lon: 77.3650 },
    karol_bagh:      { lat: 28.6514, lon: 77.1907 },
    janakpuri:       { lat: 28.6219, lon: 77.0878 },
    pitampura:       { lat: 28.7017, lon: 77.1316 },
    vasant_kunj:     { lat: 28.5216, lon: 77.1527 },
  },
  // Bengaluru
  bengaluru: {
    koramangala:      { lat: 12.9352, lon: 77.6245 },
    indiranagar:      { lat: 12.9784, lon: 77.6408 },
    whitefield:       { lat: 12.9698, lon: 77.7500 },
    hsr_layout:       { lat: 12.9116, lon: 77.6389 },
    electronic_city:  { lat: 12.8440, lon: 77.6568 },
    mg_road:          { lat: 12.9758, lon: 77.6045 },
    jayanagar:        { lat: 12.9308, lon: 77.5838 },
    marathahalli:     { lat: 12.9591, lon: 77.6974 },
    hebbal:           { lat: 13.0358, lon: 77.5970 },
    yelahanka:        { lat: 13.1007, lon: 77.5963 },
  },
  // Hyderabad
  hyderabad: {
    gachibowli:    { lat: 17.4401, lon: 78.3489 },
    hitec_city:    { lat: 17.4435, lon: 78.3772 },
    banjara_hills: { lat: 17.4156, lon: 78.4347 },
    jubilee_hills: { lat: 17.4325, lon: 78.4073 },
    uppal:         { lat: 17.4065, lon: 78.5593 },
    secunderabad:  { lat: 17.4399, lon: 78.4983 },
    kukatpally:    { lat: 17.4849, lon: 78.3913 },
    madhapur:      { lat: 17.4486, lon: 78.3908 },
    ameerpet:      { lat: 17.4375, lon: 78.4483 },
    lb_nagar:      { lat: 17.3457, lon: 78.5522 },
  },
  // Pune
  pune: {
    hinjewadi:      { lat: 18.5912, lon: 73.7390 },
    magarpatta:     { lat: 18.5139, lon: 73.9265 },
    koregaon_park:  { lat: 18.5362, lon: 73.8932 },
    viman_nagar:    { lat: 18.5679, lon: 73.9143 },
    kothrud:        { lat: 18.5074, lon: 73.8077 },
    wakad:          { lat: 18.5998, lon: 73.7603 },
    baner:          { lat: 18.5590, lon: 73.7868 },
    hadapsar:       { lat: 18.5089, lon: 73.9260 },
    pimpri:         { lat: 18.6279, lon: 73.8009 },
    chinchwad:      { lat: 18.6298, lon: 73.7997 },
  },
  // Kolkata
  kolkata: {
    salt_lake:   { lat: 22.5797, lon: 88.4120 },
    new_town:    { lat: 22.5923, lon: 88.4831 },
    park_street:  { lat: 22.5513, lon: 88.3524 },
    howrah:      { lat: 22.5958, lon: 88.2636 },
    dum_dum:     { lat: 22.6557, lon: 88.4269 },
    behala:      { lat: 22.4876, lon: 88.3172 },
    jadavpur:    { lat: 22.4968, lon: 88.3715 },
    garia:       { lat: 22.4640, lon: 88.3838 },
    rajarhat:    { lat: 22.6133, lon: 88.4735 },
    ballygunge:  { lat: 22.5285, lon: 88.3639 },
  },
  // Ahmedabad
  ahmedabad: {
    navrangpura:   { lat: 23.0372, lon: 72.5598 },
    satellite:     { lat: 23.0246, lon: 72.5297 },
    bopal:         { lat: 23.0355, lon: 72.4690 },
    prahlad_nagar: { lat: 23.0135, lon: 72.5109 },
    maninagar:     { lat: 23.0004, lon: 72.6070 },
    vastrapur:     { lat: 23.0345, lon: 72.5282 },
    gota:          { lat: 23.1054, lon: 72.5444 },
    chandkheda:    { lat: 23.1145, lon: 72.5828 },
    thaltej:       { lat: 23.0519, lon: 72.5074 },
    bodakdev:      { lat: 23.0405, lon: 72.5073 },
  },
  // Jaipur
  jaipur: {
    malviya_nagar:   { lat: 26.8535, lon: 75.8056 },
    vaishali_nagar:  { lat: 26.9111, lon: 75.7253 },
    'c-scheme':      { lat: 26.9124, lon: 75.7873 },
    mansarovar:      { lat: 26.8624, lon: 75.7547 },
    tonk_road:       { lat: 26.8503, lon: 75.7927 },
    sirsi_road:      { lat: 26.9200, lon: 75.7380 },
    sodala:          { lat: 26.9024, lon: 75.7596 },
    jagatpura:       { lat: 26.8208, lon: 75.8534 },
    sanganer:        { lat: 26.8143, lon: 75.7885 },
    pratap_nagar:    { lat: 26.8413, lon: 75.7665 },
  },
  // Lucknow
  lucknow: {
    gomti_nagar:        { lat: 26.8498, lon: 80.9915 },
    hazratganj:         { lat: 26.8500, lon: 80.9500 },
    aliganj:            { lat: 26.8970, lon: 80.9390 },
    indira_nagar:       { lat: 26.8738, lon: 80.9905 },
    alambagh:           { lat: 26.8159, lon: 80.8972 },
    rajajipuram:        { lat: 26.8550, lon: 80.8900 },
    vikas_nagar:        { lat: 26.8782, lon: 80.9450 },
    chinhat:            { lat: 26.8726, lon: 81.0254 },
    sushant_golf_city:  { lat: 26.7844, lon: 81.0140 },
    mahanagar:          { lat: 26.8720, lon: 80.9364 },
  },
  // Surat
  surat: {
    vesu:      { lat: 21.1542, lon: 72.7701 },
    adajan:    { lat: 21.2015, lon: 72.7852 },
    piplod:    { lat: 21.1467, lon: 72.7790 },
    pal:       { lat: 21.1818, lon: 72.7616 },
    athwa:     { lat: 21.1760, lon: 72.8021 },
    varachha:  { lat: 21.2183, lon: 72.8525 },
    katargam:  { lat: 21.2165, lon: 72.8292 },
    udhna:     { lat: 21.1680, lon: 72.8436 },
    rander:    { lat: 21.2100, lon: 72.7927 },
    althan:    { lat: 21.1641, lon: 72.7983 },
  },
  // Kochi
  kochi: {
    kakkanad:        { lat: 10.0158, lon: 76.3550 },
    edapally:        { lat: 10.0239, lon: 76.3086 },
    aluva:           { lat: 10.1004, lon: 76.3570 },
    fort_kochi:      { lat: 9.9658, lon: 76.2425 },
    thrippunithura:  { lat: 9.9464, lon: 76.3549 },
    kalamassery:     { lat: 10.0498, lon: 76.3221 },
    perumbavoor:     { lat: 10.1076, lon: 76.4750 },
    angamaly:        { lat: 10.1961, lon: 76.3867 },
    vyttila:         { lat: 9.9676, lon: 76.3203 },
    palarivattom:    { lat: 10.0067, lon: 76.3137 },
  },
  // Chandigarh
  chandigarh: {
    sector_17:       { lat: 30.7417, lon: 76.7868 },
    sector_22:       { lat: 30.7335, lon: 76.7774 },
    sector_35:       { lat: 30.7239, lon: 76.7667 },
    mohali_phase_7:  { lat: 30.7116, lon: 76.7178 },
    panchkula_sec_20:{ lat: 30.7006, lon: 76.8579 },
    manimajra:       { lat: 30.7317, lon: 76.8247 },
    it_park:         { lat: 30.7216, lon: 76.7387 },
    sector_43:       { lat: 30.7274, lon: 76.7545 },
    zirakpur:        { lat: 30.6429, lon: 76.8174 },
    kharar:          { lat: 30.7422, lon: 76.6457 },
  },
  // Indore
  indore: {
    vijay_nagar:     { lat: 22.7527, lon: 75.8834 },
    palasia:         { lat: 22.7231, lon: 75.8827 },
    rajwada:         { lat: 22.7185, lon: 75.8564 },
    super_corridor:  { lat: 22.6847, lon: 75.9027 },
    ab_road:         { lat: 22.6890, lon: 75.8703 },
    bhawarkua:       { lat: 22.7313, lon: 75.8653 },
    scheme_54:       { lat: 22.7410, lon: 75.8940 },
    niranjanpur:     { lat: 22.7000, lon: 75.8400 },
    rau:             { lat: 22.6594, lon: 75.8181 },
    sanwer_road:     { lat: 22.7600, lon: 75.8250 },
  },
  // Nagpur
  nagpur: {
    dharampeth:      { lat: 21.1451, lon: 79.0696 },
    sitabuldi:       { lat: 21.1458, lon: 79.0882 },
    sadar:           { lat: 21.1530, lon: 79.0756 },
    wardha_road:     { lat: 21.1150, lon: 79.1082 },
    amravati_road:   { lat: 21.1620, lon: 79.0300 },
    hingna:          { lat: 21.0956, lon: 79.0053 },
    manish_nagar:    { lat: 21.1230, lon: 79.0580 },
    pratap_nagar:    { lat: 21.1100, lon: 79.0700 },
    trimurti_nagar:  { lat: 21.1390, lon: 79.0440 },
    besa:            { lat: 21.0828, lon: 79.0667 },
  },
  // Coimbatore
  coimbatore: {
    gandhipuram:     { lat: 11.0168, lon: 76.9558 },
    rs_puram:        { lat: 11.0045, lon: 76.9510 },
    saibaba_colony:  { lat: 11.0248, lon: 76.9326 },
    singanallur:     { lat: 10.9925, lon: 77.0110 },
    peelamedu:       { lat: 11.0310, lon: 77.0020 },
    kuniyamuthur:    { lat: 10.9649, lon: 76.9474 },
    vadavalli:       { lat: 10.9950, lon: 76.9140 },
    hopes_college:   { lat: 11.0090, lon: 76.9610 },
    ukkadam:         { lat: 10.9930, lon: 76.9610 },
    podanur:         { lat: 10.9528, lon: 76.9898 },
  },
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

// ─── Zone-aware coordinate lookup ────────────────────────────────────────────
// Returns the most precise lat/lon available: zone-level > city-level > default
function getZoneCoords(city, zone) {
  const normalizedCity = (city || '').toLowerCase().trim();
  const normalizedZone = (zone || '').toLowerCase().trim().replace(/\s+/g, '_');

  // Try zone-level first
  if (normalizedCity && normalizedZone && ZONE_COORDS[normalizedCity]?.[normalizedZone]) {
    return ZONE_COORDS[normalizedCity][normalizedZone];
  }
  // Fallback to city-level
  return CITY_COORDS[normalizedCity] || CITY_COORDS.chennai;
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
async function checkRainTrigger(city, zone) {
  try {
    if (process.env.NODE_ENV === 'development') {
      return getMockRainData(city);
    }

    const { lat, lon } = getZoneCoords(city, zone);

    // Real API call — uses free OpenWeatherMap key
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
async function checkAQITrigger(city, zone) {
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

// ─── 6. SKYMET TRIGGER — third rain validation source (mocked) ────────────────
// Skymet does NOT offer a free self-service API key — access requires an
// enterprise inquiry via skymetweather.com. Kept mocked until API key obtained.
async function checkSkymetTrigger(city, zone) {
  try {
    const apiKey = process.env.SKYMET_API_KEY || 'mock';
    if (apiKey === 'mock') {
      return getMockSkymetData(city);
    }

    // Production: call Skymet weather API
    const { lat, lon } = getZoneCoords(city, zone);
    const url = `https://api.skymetweather.com/v1/current?lat=${lat}&lon=${lon}&key=${apiKey}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const rainfall = data.rainfall_mm || 0;
    return withObservation(evaluateRain(rainfall, city));
  } catch (err) {
    console.error('Skymet API error:', err.message);
    return withObservation({ triggered: false, source: 'Skymet Weather', error: err.message });
  }
}

function getMockSkymetData(city) {
  const month = new Date().getMonth() + 1;
  const isChennaiMonsoon = city === 'chennai' && [10, 11, 12].includes(month);
  const isMumbaiMonsoon  = city === 'mumbai'  && [6, 7, 8, 9].includes(month);

  if (isChennaiMonsoon || isMumbaiMonsoon) {
    return withObservation({ triggered: true, level: 2, value: '22mm/hr', source: 'Skymet Weather (mock)' });
  }
  return withObservation({ triggered: false, source: 'Skymet Weather (mock)', value: '3mm/hr' });
}

// ─── 7. TWITTER GEO-TAGGED NLP — social signal validation (stub) ──────────────
// Phase 4: Stream geo-tagged tweets → NLP classifier → confirm disruption events.
// Requires Twitter/X API Bearer Token (free tier: 500K tweets/month).
async function checkTwitterGeoTrigger(city, triggerType) {
  try {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN || 'mock';
    if (bearerToken === 'mock') {
      return withObservation({
        triggered: false,
        source: 'Twitter Geo NLP (stub)',
        value: 'No geo-tagged alerts detected',
      });
    }

    // Production: query Twitter/X streaming API with geo bounding box
    // → run through NLP classifier (flood/rain/curfew detection)
    // → return { triggered: bool, level, value, source }
    return withObservation({
      triggered: false,
      source: 'Twitter Geo NLP',
      value: 'Not implemented',
    });
  } catch (err) {
    console.error('Twitter Geo error:', err.message);
    return withObservation({ triggered: false, source: 'Twitter Geo NLP', error: err.message });
  }
}

// ─── Master check: run all triggers for a worker ──────────────────────────────
async function runAllTriggers(worker, platforms) {
  const city = worker.city;
  const zone = worker.zone;
  const results = {};

  // Run all checks in parallel — including Skymet + Twitter geo sources
  const [rain, aqi, flood, curfew, skymet, twitterGeo] = await Promise.all([
    checkRainTrigger(city, zone),
    checkAQITrigger(city, zone),
    checkFloodTrigger(city),
    checkCurfewTrigger(city),
    checkSkymetTrigger(city, zone),
    checkTwitterGeoTrigger(city, 'rain'),
  ]);

  results.rain       = rain;
  results.aqi        = aqi;
  results.flood      = flood;
  results.curfew     = curfew;
  results.skymet     = skymet;
  results.twitter_geo = twitterGeo;

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

  // Count how many rain sources confirm (for multi-source validation)
  const rainSourcesConfirmed = ['rain', 'skymet', 'twitter_geo']
    .filter(key => results[key]?.triggered).length;

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
    rainSourcesConfirmed,
    allResults:    results,
  };
}

async function verifyTriggerForWorker(worker, requestedTriggerType) {
  const triggerType = requestedTriggerType || 'rain';
  const zone = worker.zone;
  let triggerData;

  switch (triggerType) {
    case 'rain':
      triggerData = await checkRainTrigger(worker.city, zone);
      break;
    case 'aqi':
      triggerData = await checkAQITrigger(worker.city, zone);
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
  // The disruption "just ended now" — most natural simulation behaviour.
  // At 4:00 PM with a rain L3 (180 min), the window is 1:00 PM → 4:00 PM IST.
  // calculateFinalLossWindow then intersects this with the worker's actual shift,
  // e.g. if shift is 10:00 AM – 8:00 PM the overlap is 1:00 PM → 4:00 PM ✓.
  const nowUTC = new Date();

  const durationMinutes = DEFAULT_TRIGGER_WINDOWS[triggerType]?.[level] || 180;
  const windowStart = new Date(nowUTC.getTime() - durationMinutes * 60 * 1000);

  const simulatedSource = {
    triggered: true,
    level,
    source: `${triggerType} simulated`,
    value: 'Simulated trigger',
    confirmedAt: nowUTC.toISOString(),
  };

  return {
    anyTriggered: true,
    triggerType,
    triggerLevel: level,
    triggerSource: simulatedSource,
    disruptionStart: windowStart,
    disruptionEnd: nowUTC,
    disruptionWindowMinutes: durationMinutes,
    windowMethodology: `Simulated ${durationMinutes}min window ending now — intersected with your active shift.`,
  };
}

function mapTriggerType(key) {
  if (key.includes('rain'))    return 'rain';
  if (key.includes('skymet'))  return 'rain';
  if (key.includes('aqi'))     return 'aqi';
  if (key.includes('flood'))   return 'flood';
  if (key.includes('curfew'))  return 'curfew';
  if (key.includes('outage'))  return 'platform_outage';
  if (key.includes('twitter')) return 'rain';
  return 'zone_freeze';
}

module.exports = {
  runAllTriggers,
  checkRainTrigger,
  checkAQITrigger,
  checkPlatformOutage,
  checkCurfewTrigger,
  checkFloodTrigger,
  checkSkymetTrigger,
  checkTwitterGeoTrigger,
  deriveDisruptionWindow,
  verifyTriggerForWorker,
  buildSimulatedTrigger,
  getZoneCoords,
  LEVEL_MULTIPLIERS,
  ZONE_COORDS,
};
