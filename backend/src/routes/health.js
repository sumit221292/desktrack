const express = require('express');
const router = express.Router();
const { query, pool } = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const dbType = pool ? 'PostgreSQL' : 'Memory DB (Local/Mock)';
    
    // Check if allowed_domains exists and has entries
    let domains = [];
    try {
      const result = await query('SELECT domain FROM allowed_domains');
      domains = result.rows.map(r => r.domain);
    } catch (e) {
      domains = ['Error: table might not exist'];
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: {
        type: dbType,
        connected: !!pool,
        host: pool?.options?.host || 'N/A',
        authorizedDomains: domains
      },
      config: {
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasJwtSecret: !!process.env.JWT_SECRET,
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
