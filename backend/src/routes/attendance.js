const express = require('express');
const router = express.Router();
const attendanceService = require('../services/attendanceService');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

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

// Temp: Repair missed checkouts for a specific date
router.post('/repair-missed', async (req, res) => {
  try {
    const companyId = req.tenantId || 1;
    const { date } = req.body; // e.g. "2026-04-16"
    if (!date) return res.status(400).json({ error: 'date required' });
    const { query } = require('../config/db');

    // Find attendance records for that date with no checkout or wrong status
    const attResult = await query(
      'SELECT * FROM attendance WHERE company_id = $1 AND check_in::date = $2::date',
      [companyId, date]
    );

    const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
    const shift = shifts.rows[0] || { total_working_hours: 9 };
    const maxShiftMins = (parseFloat(shift.total_working_hours) || 9) * 60;
    const halfShift = maxShiftMins / 2;
    const repaired = [];

    for (const rec of attResult.rows) {
      // Get all sessions for this attendance
      const sessResult = await query('SELECT * FROM attendance_sessions WHERE attendance_id = $1', [rec.id]);

      // Close any orphan sessions at 23:59:59 IST with 0 credit
      for (const sess of sessResult.rows) {
        if (!sess.check_out) {
          const closeTime = new Date(`${date}T23:59:59+05:30`);
          await query('UPDATE attendance_sessions SET check_out = $1, duration_minutes = 0 WHERE id = $2', [closeTime, sess.id]);
        }
      }

      // Recalculate: only count properly checked-out sessions (duration > 0)
      const updatedSess = await query('SELECT * FROM attendance_sessions WHERE attendance_id = $1', [rec.id]);
      let workedMins = 0;
      let lastCheckout = null;
      for (const s of updatedSess.rows) {
        const dur = parseInt(s.duration_minutes) || 0;
        if (dur > 0) {
          workedMins += Math.min(maxShiftMins, dur);
          if (s.check_out && (!lastCheckout || new Date(s.check_out) > lastCheckout)) {
            lastCheckout = new Date(s.check_out);
          }
        }
      }

      // If no checkout on attendance record, set it
      const checkOutTime = rec.check_out ? rec.check_out : (lastCheckout || new Date(`${date}T23:59:59+05:30`));
      const missedCheckout = !rec.check_out;

      let status;
      if (workedMins === 0) status = 'ABSENT';
      else if (workedMins < halfShift) status = 'ABSENT';
      else if (workedMins < maxShiftMins) status = 'INCOMPLETE';
      else status = 'COMPLETE';

      const flags = [];
      if (missedCheckout) flags.push('MISSED_CHECKOUT');
      if (workedMins < halfShift && workedMins > 0) flags.push('HALFDAY');
      if (workedMins === 0 && rec.check_in) flags.push('ABSENT');

      await query(
        `UPDATE attendance SET check_out = $1, last_check_out = $1, status = $2,
         net_work_minutes = $3, gross_minutes = $3, flags = $4,
         ai_summary = $5
         WHERE id = $6 AND company_id = $7`,
        [checkOutTime, status, workedMins,
         JSON.stringify(flags),
         `Repaired. Worked: ${workedMins}min. ${missedCheckout ? 'Checkout was missed.' : ''}`,
         rec.id, companyId]
      );

      repaired.push({
        id: rec.id, employee_id: rec.employee_id,
        worked_minutes: workedMins, status,
        missed_checkout: missedCheckout, flags
      });
    }

    res.json({ message: `Repaired ${repaired.length} records for ${date}`, records: repaired });
  } catch (err) {
    console.error('Repair error:', err);
    res.status(500).json({ error: err.message });
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
