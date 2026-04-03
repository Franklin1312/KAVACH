const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const { runAllTriggers, checkRainTrigger, checkAQITrigger, checkPlatformOutage, checkFloodTrigger, buildSimulatedTrigger, deriveDisruptionWindow } = require('../services/triggerService');
const claimsRouter = require('./claims');

// GET /api/triggers/status — check all triggers for logged-in worker's city
router.get('/status', protect, async (req, res) => {
  try {
    const result = await runAllTriggers(req.worker, req.worker.platforms || []);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/triggers/simulate — manually simulate a disruption (for demo)
// Body: { triggerType: 'rain' | 'aqi' | 'flood' | 'curfew' | 'platform_outage', level: 1-4 }
router.post('/simulate', protect, async (req, res) => {
  try {
    const { triggerType, level } = req.body;

    const validTypes = ['rain', 'aqi', 'flood', 'curfew', 'platform_outage', 'zone_freeze', 'heat'];
    if (!validTypes.includes(triggerType)) {
      return res.status(400).json({ error: `Invalid trigger type. Use: ${validTypes.join(', ')}` });
    }

    const triggerLevel = level || 3;

    const mockSources = {
      rain:             [{ source: 'IMD (simulated)',            value: '45mm/hr',   confirmedAt: new Date() },
                         { source: 'OpenWeatherMap (simulated)', value: '43mm/hr',   confirmedAt: new Date() },
                         { source: 'Twitter geo (simulated)',    value: '284 posts', confirmedAt: new Date() }],
      aqi:              [{ source: 'CPCB AQI (simulated)',       value: 'AQI 428',   confirmedAt: new Date() },
                         { source: 'AirVisual (simulated)',      value: 'AQI 431',   confirmedAt: new Date() }],
      flood:            [{ source: 'CWC (simulated)',            value: 'RED alert', confirmedAt: new Date() }],
      curfew:           [{ source: 'Police API (simulated)',     value: 'Sec 144',   confirmedAt: new Date() },
                         { source: 'PIB (simulated)',            value: 'Confirmed', confirmedAt: new Date() }],
      platform_outage:  [{ source: 'Heartbeat (simulated)',      value: 'Timeout',   confirmedAt: new Date() },
                         { source: 'Downdetector (simulated)',   value: 'Score 623', confirmedAt: new Date() }],
      zone_freeze:      [{ source: 'Platform API (simulated)',   value: '0 orders/30min', confirmedAt: new Date() }],
      heat:             [{ source: 'IMD (simulated)',            value: 'Heat index 47°C', confirmedAt: new Date() }],
    };

    // Return trigger data — frontend or cron job then calls /api/claims/auto-process
    const simulated = buildSimulatedTrigger(triggerType, triggerLevel);

    res.json({
      success: true,
      message: `Disruption simulated: ${triggerType} level ${triggerLevel}`,
      triggerData: {
        triggerType: simulated.triggerType,
        triggerLevel: simulated.triggerLevel,
        triggerSources:  mockSources[triggerType] || [],
        disruptionStart: simulated.disruptionStart,
        disruptionEnd:   simulated.disruptionEnd,
        actualEarned:    0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/triggers/check/rain — check rain for worker's city
router.get('/check/rain', protect, async (req, res) => {
  try {
    const result = await checkRainTrigger(req.worker.city);
    res.json({ success: true, result, disruptionWindow: deriveDisruptionWindow('rain', result) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/triggers/check/aqi
router.get('/check/aqi', protect, async (req, res) => {
  try {
    const result = await checkAQITrigger(req.worker.city);
    res.json({ success: true, result, disruptionWindow: deriveDisruptionWindow('aqi', result) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
