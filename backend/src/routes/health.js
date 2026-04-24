const express = require('express');
const router = express.Router();
const { query, pool, runMigrations } = require('../config/db');

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

// Diagnostic: verifies Postgres is truly usable end-to-end and lists tables
router.get('/db-test', async (req, res) => {
  if (!pool) return res.json({ pool: false, msg: 'No pool configured (memory-only mode)' });
  try {
    const ping = await pool.query('SELECT 1 as ok');
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    res.json({
      pool: true,
      ping: ping.rows[0],
      table_count: tables.rows.length,
      tables: tables.rows.map(r => r.table_name),
    });
  } catch (err) {
    res.status(500).json({ pool: true, error: err.message, code: err.code, detail: err.detail });
  }
});

// Diagnostic: manually trigger migrations (for post-deploy repair)
router.post('/run-migrations', async (req, res) => {
  if (!pool) return res.status(400).json({ error: 'No pool configured' });
  try {
    await runMigrations();
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    res.json({ ok: true, table_count: tables.rows.length, tables: tables.rows.map(r => r.table_name) });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;
