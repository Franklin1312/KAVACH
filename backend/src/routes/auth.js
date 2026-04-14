const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const Worker  = require('../models/Worker');
const AuditLog = require('../models/AuditLog');
const { sendMessage } = require('../services/notificationService');

const generateWorkerToken = (id) =>
  jwt.sign({ id, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

const generateAdminToken = (username) =>
  jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });

const ADMIN_PHONE = process.env.ADMIN_PHONE || '9999900000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Kavach@Admin2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

const getDefaultShiftConfig = (workingHours = 'full') => {
  if (workingHours === 'part') {
    return { usualShiftStart: '17:00', usualShiftEnd: '22:00', workingDays: [1, 2, 3, 4, 5, 6] };
  }

  if (workingHours === 'extended') {
    return { usualShiftStart: '08:00', usualShiftEnd: '22:00', workingDays: [1, 2, 3, 4, 5, 6] };
  }

  return { usualShiftStart: '10:00', usualShiftEnd: '20:00', workingDays: [1, 2, 3, 4, 5, 6] };
};

const serializeWorker = (worker) => ({
  id: worker._id,
  name: worker.name,
  phone: worker.phone,
  city: worker.city,
  zone: worker.zone,
  platforms: worker.platforms,
  declaredWeeklyIncome: worker.declaredWeeklyIncome,
  verifiedWeeklyIncome: worker.verifiedWeeklyIncome,
  zoneRiskFactor: worker.zoneRiskFactor,
  claimsFreeWeeks: worker.claimsFreeWeeks,
  isVerified: worker.isVerified,
  upiId: worker.upiId,
  workingHours: worker.workingHours,
  usualShiftStart: worker.usualShiftStart,
  usualShiftEnd: worker.usualShiftEnd,
  workingDays: worker.workingDays,
});

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await Worker.findOneAndUpdate(
      { phone },
      { otp, otpExpiry },
      { upsert: true, new: true }
    );

    console.log(`OTP for ${phone}: ${otp}`);
    
    // Dispatch WhatsApp verification code
    const msg = `KAVACH Secure Login\n\nYour OTP code is: *${otp}*\n\nThis code expires in 10 minutes. Please do not share it with anyone.`;
    sendMessage(phone, msg).catch(err => console.error('Failed to send OTP via WA:', err.message));

    res.json({
      success: true,
      message: 'OTP sent',
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password required' });
    }

    if (phone !== ADMIN_PHONE || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    res.json({
      success: true,
      token: generateAdminToken(ADMIN_USERNAME),
      admin: {
        username: ADMIN_USERNAME,
        phone: ADMIN_PHONE,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });

    const worker = await Worker.findOne({ phone });
    if (!worker)              return res.status(404).json({ error: 'Worker not found' });
    if (worker.otp !== otp)   return res.status(400).json({ error: 'Invalid OTP' });
    if (worker.otpExpiry < new Date()) return res.status(400).json({ error: 'OTP expired' });

    worker.otp = undefined;
    worker.otpExpiry = undefined;
    await worker.save();

    res.json({
      success: true,
      token: generateWorkerToken(worker._id),
      isNewWorker: !worker.isVerified,
      worker: serializeWorker(worker),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const {
      phone, name, aadhaarLast4, platforms,
      city, zone, declaredWeeklyIncome, workingHours, upiId, usualShiftStart, usualShiftEnd, workingDays,
    } = req.body;

    if (!phone || !name || !aadhaarLast4 || !platforms?.length || !city || !zone || !declaredWeeklyIncome)
      return res.status(400).json({ error: 'All fields are required' });

    const zoneRiskFactor = getZoneRisk(city, zone);
    const normalizedWorkingHours = workingHours || 'full';
    const shiftConfig = getDefaultShiftConfig(normalizedWorkingHours);

    // 7-day minimum activity check (mock — in production verified via platform API)
    // Workers registered less than 7 days ago get a lower tier flag
    const platformJoinDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // mock: assume joined 30 days ago
    const activeDaysMock   = 14; // mock active days — real value from Zomato/Swiggy API
    const meetsActivityReq = activeDaysMock >= 7;

    const worker = await Worker.findOneAndUpdate(
      { phone },
      {
        name, aadhaarLast4, platforms, city, zone,
        declaredWeeklyIncome,
        verifiedWeeklyIncome: declaredWeeklyIncome,
        workingHours: normalizedWorkingHours,
        usualShiftStart: usualShiftStart || shiftConfig.usualShiftStart,
        usualShiftEnd: usualShiftEnd || shiftConfig.usualShiftEnd,
        workingDays: Array.isArray(workingDays) && workingDays.length ? workingDays : shiftConfig.workingDays,
        upiId, isVerified: true, zoneRiskFactor,
        // Activity tier — workers with <7 active days get lower tier
        activityTier: meetsActivityReq ? 'standard' : 'lower',
        claimsFreeWeeks: 0,
      },
      { new: true }
    );

    await AuditLog.create({
      worker: worker._id,
      event: 'REGISTRATION',
      meta: { city, zone, platforms: platforms.map((p) => p.name) },
    });

    res.status(201).json({
      success: true,
      token: generateWorkerToken(worker._id),
      worker: serializeWorker(worker),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getZoneRisk(city, zone) {
  const high = ['marina', 'adyar', 'dharavi', 'kurla', 'fort', 'colaba', 'parel',
                'low_lying', 'riverside', 'flood_prone', 'worli', 'sewri',
                'govandi', 'mankhurd', 'vikhroli'];
  const low  = ['tambaram', 'whitefield', 'electronic_city', 'noida', 'dwarka',
                'hinjewadi', 'magarpatta', 'gachibowli', 'uppal', 'perungudi',
                'sholinganallur', 'porur', 'ambattur'];
  const key  = zone.toLowerCase().replace(/\s/g, '_');
  if (high.some((h) => key.includes(h))) return 1.3;
  if (low.some((l) => key.includes(l)))  return 0.85;
  return 1.0;
}


module.exports = router;
