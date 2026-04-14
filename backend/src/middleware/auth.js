const jwt = require('jsonwebtoken');
const Worker = require('../models/Worker');

const getBearerToken = (headers = {}) => {
  if (headers.authorization?.startsWith('Bearer')) {
    return headers.authorization.split(' ')[1];
  }
  return null;
};

const protect = async (req, res, next) => {
  const token = getBearerToken(req.headers);
  if (!token) return res.status(401).json({ error: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role && decoded.role !== 'worker') {
      return res.status(401).json({ error: 'Invalid worker token' });
    }
    req.worker = await Worker.findById(decoded.id).select('-otp -otpExpiry');
    if (!req.worker) return res.status(401).json({ error: 'Worker not found' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const protectAdmin = (req, res, next) => {
  const token = getBearerToken(req.headers);
  if (!token) return res.status(401).json({ error: 'Admin authorization required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = {
      username: decoded.username,
      role: decoded.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid admin token' });
  }
};

module.exports = { protect, protectAdmin };
