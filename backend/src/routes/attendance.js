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

// Cleanup: Delete all attendance data for an employee
router.delete('/cleanup/:employeeId', async (req, res) => {
  try {
    const companyId = req.tenantId || 1;
    const empId = req.params.employeeId;
    const { query } = require('../config/db');
    await query('DELETE FROM attendance_events WHERE employee_id = $1 AND company_id = $2', [empId, companyId]);
    await query('DELETE FROM attendance_sessions WHERE employee_id = $1 AND company_id = $2', [empId, companyId]);
    await query('DELETE FROM attendance WHERE employee_id = $1 AND company_id = $2', [empId, companyId]);
    res.json({ message: `Cleared all attendance data for employee ${empId}` });
  } catch (err) {
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
