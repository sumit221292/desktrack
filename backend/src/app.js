const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const tenantMiddleware = require('./middleware/tenant');

const app = express();

// Standard middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Multi-tenant isolation (Global)
app.use(tenantMiddleware);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/custom-fields', require('./routes/customFields'));
app.use('/api/performance', require('./routes/performanceRoutes'));

// Home route
app.get('/api', (req, res) => {
  res.json({ message: 'DeskTrack SaaS API is running.', tenant: req.tenant.name });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));

  // Client-side routing catch-all
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// Centralized error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

module.exports = app;
