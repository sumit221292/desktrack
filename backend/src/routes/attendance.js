const express = require('express');
const router = express.Router();
const attendanceService = require('../services/attendanceService');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get full activity (sessions + events) for an attendance record
router.get('/:id/activity', async (req, res) => {
  try {
    const { query } = require('../config/db');
    const companyId = req.tenantId || 1;
    const attId = req.params.id;

    const sessionsRes = await query(
      'SELECT * FROM attendance_sessions WHERE attendance_id = $1 AND company_id = $2',
      [attId, companyId]
    );
    const eventsRes = await query(
      'SELECT * FROM attendance_events WHERE attendance_id = $1 AND company_id = $2',
      [attId, companyId]
    );
    // Sort sessions and events by time
    const sessions = (sessionsRes.rows || []).sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
    const events = (eventsRes.rows || []).sort((a, b) => new Date(a.event_time) - new Date(b.event_time));

    // Pair events into break pairs
    const pairs = { LUNCH: [], TEA: [] };
    for (const type of ['LUNCH', 'TEA']) {
      const starts = events.filter(e => e.event_type === `${type}_START`);
      const ends = events.filter(e => e.event_type === `${type}_END`);
      for (let i = 0; i < starts.length; i++) {
        const s = starts[i];
        const e = ends[i];
        const dur = e ? Math.max(1, Math.ceil((new Date(e.event_time) - new Date(s.event_time)) / 60000)) : null;
        pairs[type].push({
          start: s.event_time,
          end: e ? e.event_time : null,
          duration_minutes: dur,
          status: e ? 'COMPLETED' : 'ACTIVE'
        });
      }
    }

    res.json({ sessions, breaks: pairs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all attendance for a date
router.get('/', async (req, res) => {
  try {
    const result = await attendanceService.getDailyAttendance(
      req.tenantId || 1, 
      req.query.date || new Date().toISOString().split('T')[0]
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get monthly attendance for calendar view
router.get('/monthly', async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || (new Date().getMonth() + 1);
    const y = parseInt(year) || new Date().getFullYear();
    const result = await attendanceService.getMonthlyAttendance(req.tenantId || 1, m, y);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const result = await attendanceService.getStats(
      req.tenantId || 1,
      req.query.date || new Date().toISOString().split('T')[0]
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Check-in
router.post('/check-in', async (req, res) => {
  try {
    const result = await attendanceService.checkIn(
      req.user.id, 
      req.tenantId, 
      req.body.location,
      req.body.check_in_time
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Check-out
router.post('/check-out/:id', async (req, res) => {
  try {
    const result = await attendanceService.checkOut(
      req.params.id, 
      req.tenantId,
      req.body ? req.body.check_out_time : null
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Log event (Break Start/End)
router.post('/event', async (req, res) => {
  try {
    const result = await attendanceService.logEvent(
      req.user.id,
      req.tenantId,
      req.body.event_type,
      req.body.event_time,
      req.body.attendance_id
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Attendance (Edit/Remarks)
router.put('/:id', async (req, res) => {
  try {
    const result = await attendanceService.updateAttendance(
      req.params.id,
      req.tenantId,
      req.body
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
