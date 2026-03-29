require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/workers',  require('./routes/workers'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/claims',   require('./routes/claims'));
app.use('/api/triggers', require('./routes/triggers'));
app.use('/api/admin',    require('./routes/admin'));

// Health check
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'kavach-api', env: process.env.NODE_ENV })
);

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 KAVACH backend running on http://localhost:${PORT}`);

  // Start cron jobs
  const { startAllCrons } = require('./services/cronJobs');
  startAllCrons();
});
