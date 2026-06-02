const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, checkRole } = require('../middleware/auth');
const { fetchYearHolidays } = require('../utils/holidays');

// GET all public holidays for a year (India) — admin picks up to 10 of these as
// the company's holidays (saved via PUT /config under the `holidays` key).
router.get('/holidays/available', authMiddleware, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const holidays = await fetchYearHolidays(year);
    res.json({ year, holidays });
  } catch (err) {
    console.error('Get Holidays Error:', err);
    res.status(500).json({ error: 'Server error fetching holidays.' });
  }
});

// GET all authorized domains for the current tenant
router.get('/domains', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const result = await query(
      'SELECT * FROM allowed_domains WHERE company_id = $1 ORDER BY domain ASC',
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching domains:', err);
    res.status(500).json({ error: 'Server error fetching domains.' });
  }
});

// POST a new authorized domain
router.post('/domains', authMiddleware, checkRole(['SUPER_ADMIN']), async (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required.' });
  }

  try {
    const companyId = req.user.companyId;
    
    // Check if domain already exists for this company
    const existing = await query(
      'SELECT * FROM allowed_domains WHERE domain = $1 AND company_id = $2',
      [domain, companyId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Domain already authorized for this company.' });
    }

    const result = await query(
      'INSERT INTO allowed_domains (domain, company_id) VALUES ($1, $2) RETURNING *',
      [domain, companyId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding domain:', err);
    res.status(500).json({ error: 'Server error adding domain.' });
  }
});

// DELETE an authorized domain
router.delete('/domains/:id', authMiddleware, checkRole(['SUPER_ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    const companyId = req.user.companyId;
    
    // Ensure the domain belongs to the current company
    const checkResult = await query(
      'SELECT * FROM allowed_domains WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found or unauthorized.' });
    }

    await query('DELETE FROM allowed_domains WHERE id = $1', [id]);
    res.json({ message: 'Domain removed successfully.' });
  } catch (err) {
    console.error('Error deleting domain:', err);
    res.status(500).json({ error: 'Server error deleting domain.' });
  }
});

// ─── Company Settings (key-value store) ───────────────────────────────────

// GET all company settings
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT setting_key, setting_value FROM company_settings WHERE company_id = $1',
      [req.tenantId]
    );
    const settings = {};
    result.rows.forEach(r => {
      try { settings[r.setting_key] = JSON.parse(r.setting_value); } catch { settings[r.setting_key] = r.setting_value; }
    });
    res.json(settings);
  } catch (err) {
    console.error('Get Settings Error:', err);
    res.status(500).json({ error: 'Server error retrieving settings.' });
  }
});

// PUT (upsert) one or more settings
router.put('/config', authMiddleware, checkRole(['SUPER_ADMIN', 'HR']), async (req, res) => {
  const { settings } = req.body; // { key: value, ... }
  try {
    const promises = Object.entries(settings || {}).map(([key, value]) =>
      query(
        `INSERT INTO company_settings (company_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [req.tenantId, key, typeof value === 'string' ? value : JSON.stringify(value)]
      )
    );
    await Promise.all(promises);
    res.json({ message: 'Settings saved.' });
  } catch (err) {
    console.error('Save Settings Error:', err);
    res.status(500).json({ error: 'Server error saving settings.' });
  }
});

module.exports = router;
