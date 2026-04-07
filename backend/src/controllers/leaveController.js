const { query } = require('../config/db');

// ─── Leave Types ───
const getLeaveTypes = async (req, res) => {
  try {
    const result = await query('SELECT * FROM leave_types WHERE company_id = $1 ORDER BY id', [req.tenantId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get Leave Types Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createLeaveType = async (req, res) => {
  const { name, code, annual_quota, carry_forward } = req.body;
  try {
    const result = await query(
      'INSERT INTO leave_types (company_id, name, code, annual_quota, carry_forward) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.tenantId, name, code, annual_quota || 0, carry_forward || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create Leave Type Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateLeaveType = async (req, res) => {
  const { name, code, annual_quota, carry_forward } = req.body;
  try {
    const result = await query(
      'UPDATE leave_types SET name = $1, code = $2, annual_quota = $3, carry_forward = $4 WHERE id = $5 AND company_id = $6 RETURNING *',
      [name, code, annual_quota || 0, carry_forward || false, req.params.id, req.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteLeaveType = async (req, res) => {
  try {
    await query('DELETE FROM leave_types WHERE id = $1 AND company_id = $2', [req.params.id, req.tenantId]);
    res.json({ message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── Leave Requests ───
const getLeaveRequests = async (req, res) => {
  try {
    const result = await query(
      `SELECT lr.*, e.first_name, e.last_name, lt.name as leave_type_name, lt.code as leave_type_code
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.company_id = $1 ORDER BY lr.created_at DESC`,
      [req.tenantId]
    );
    const rows = result.rows.map(r => ({
      ...r,
      employee_name: r.employee_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unknown'
    }));
    res.json(rows);
  } catch (err) {
    console.error('Get Leave Requests Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const applyLeave = async (req, res) => {
  const { leave_type_id, start_date, end_date, reason } = req.body;
  try {
    // Resolve employee ID from user
    const empResult = await query('SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = $1) AND company_id = $2', [req.user.id, req.tenantId]);
    if (empResult.rows.length === 0) return res.status(400).json({ error: 'Employee not found.' });
    const employeeId = empResult.rows[0].id;

    // Calculate days
    const start = new Date(start_date);
    const end = new Date(end_date);
    let days = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) days++;
    }
    if (days < 1) days = 1;

    // Check balance
    const year = start.getFullYear();
    const balResult = await query(
      'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND company_id = $4',
      [employeeId, leave_type_id, year, req.tenantId]
    );
    if (balResult.rows.length > 0 && balResult.rows[0].remaining < days) {
      // Allow if it's unpaid leave (quota=0)
      const ltResult = await query('SELECT * FROM leave_types WHERE id = $1', [leave_type_id]);
      if (ltResult.rows.length > 0 && ltResult.rows[0].annual_quota > 0) {
        return res.status(400).json({ error: `Insufficient balance. Available: ${balResult.rows[0].remaining} days.` });
      }
    }

    const result = await query(
      'INSERT INTO leave_requests (company_id, employee_id, leave_type_id, start_date, end_date, days, reason) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.tenantId, employeeId, leave_type_id, start_date, end_date, days, reason || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Apply Leave Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const reviewLeave = async (req, res) => {
  const { status } = req.body; // APPROVED or REJECTED
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  try {
    // Get reviewer employee ID
    const revEmp = await query('SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = $1) AND company_id = $2', [req.user.id, req.tenantId]);
    const reviewerId = revEmp.rows.length > 0 ? revEmp.rows[0].id : null;

    const result = await query(
      'UPDATE leave_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 AND company_id = $4 RETURNING *',
      [status, reviewerId, req.params.id, req.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found.' });

    const lr = result.rows[0];

    // If approved, update balance
    if (status === 'APPROVED') {
      const year = new Date(lr.start_date).getFullYear();
      // Check if balance exists
      const bal = await query(
        'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND company_id = $4',
        [lr.employee_id, lr.leave_type_id, year, req.tenantId]
      );
      if (bal.rows.length > 0) {
        const newUsed = (parseInt(bal.rows[0].used) || 0) + lr.days;
        const newRemaining = Math.max(0, (parseInt(bal.rows[0].total) || 0) - newUsed);
        await query(
          'INSERT INTO leave_balances (company_id, employee_id, leave_type_id, year, total, used, remaining) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE SET used = $6, remaining = $7',
          [req.tenantId, lr.employee_id, lr.leave_type_id, year, bal.rows[0].total, newUsed, newRemaining]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Review Leave Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── Leave Balances ───
const getLeaveBalances = async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const employeeId = req.query.employee_id;
  try {
    let sql = `SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code, e.first_name, e.last_name
               FROM leave_balances lb
               LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
               LEFT JOIN employees e ON lb.employee_id = e.id
               WHERE lb.company_id = $1 AND lb.year = $2`;
    const p = [req.tenantId, year];
    if (employeeId) { sql += ' AND lb.employee_id = $3'; p.push(employeeId); }
    const result = await query(sql, p);
    const rows = result.rows.map(r => ({
      ...r,
      employee_name: r.employee_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || `Emp #${r.employee_id}`
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const initBalances = async (req, res) => {
  const year = req.body.year || new Date().getFullYear();
  try {
    const employees = await query('SELECT id FROM employees WHERE company_id = $1 AND status = $2', [req.tenantId, 'ACTIVE']);
    const leaveTypes = await query('SELECT * FROM leave_types WHERE company_id = $1', [req.tenantId]);

    for (const emp of employees.rows) {
      for (const lt of leaveTypes.rows) {
        await query(
          `INSERT INTO leave_balances (company_id, employee_id, leave_type_id, year, total, used, remaining)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`,
          [req.tenantId, emp.id, lt.id, year, lt.annual_quota, 0, lt.annual_quota]
        );
      }
    }
    const result = await query(
      'SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code FROM leave_balances lb LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id WHERE lb.company_id = $1 AND lb.year = $2',
      [req.tenantId, year]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Init Balances Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType,
  getLeaveRequests, applyLeave, reviewLeave,
  getLeaveBalances, initBalances
};
