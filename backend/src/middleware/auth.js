const jwt = require('jsonwebtoken');
const Worker = require('../models/Worker');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ error: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.worker = await Worker.findById(decoded.id).select('-otp -otpExpiry');
    if (!req.worker) return res.status(401).json({ error: 'Worker not found' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { protect };
