const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const Worker  = require('../models/Worker');

// GET /api/workers/me
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, worker: req.worker });
});

// PUT /api/workers/me
router.put('/me', protect, async (req, res) => {
  try {
    const updates = req.body;
    const worker = await Worker.findByIdAndUpdate(req.worker._id, updates, { new: true });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
