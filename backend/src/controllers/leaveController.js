const { query } = require('../config/db');

// ─── Accrual (computed, no cron) ───
// IST month/year so accrual lines up with the rest of the app's IST-anchored dates.
const istParts = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const get = (t) => parseInt(p.find(x => x.type === t).value, 10);
  return { year: get('year'), month: get('month') }; // month 1..12
};
// Today's date in IST as a YYYY-MM-DD string (for date-only comparisons).
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
// Days EARNED so far for a leave type in a given balance year.
//  - 'annual'  → full quota upfront (current behaviour).
//  - 'monthly' → quota/12 per month, available at the START of each month
//    (Jan→1 … Jun→6 … Dec→12). Past years fully accrued; future years none.
const accruedToDate = (type, balanceYear, joinDate) => {
  const quota = parseFloat(type.annual_quota) || 0;
  if ((type.accrual_frequency || 'annual') !== 'monthly') return quota; // annual = full upfront
  const { year, month } = istParts();
  if (balanceYear < year) return quota;
  if (balanceYear > year) return 0;
  // Accrue from the JOINING month when the employee joined during the balance year
  // (a June joiner earns from June, not January). Otherwise accrue from January.
  let startMonth = 1;
  if (joinDate) {
    const j = String(joinDate).slice(0, 10);
    const jY = parseInt(j.slice(0, 4), 10), jM = parseInt(j.slice(5, 7), 10);
    if (jY > balanceYear) return 0;                 // joined after this year
    if (jY === balanceYear && jM >= 1) startMonth = jM;
  }
  const monthsAccrued = Math.max(0, month - startMonth + 1);
  return Math.min(quota, Math.floor((quota * monthsAccrued) / 12));
};

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
  const { name, code, annual_quota, carry_forward, accrual_frequency } = req.body;
  const accrual = accrual_frequency === 'monthly' ? 'monthly' : 'annual';
  try {
    const result = await query(
      'INSERT INTO leave_types (company_id, name, code, annual_quota, carry_forward, accrual_frequency) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.tenantId, name, code, annual_quota || 0, carry_forward || false, accrual]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create Leave Type Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateLeaveType = async (req, res) => {
  const { name, code, annual_quota, carry_forward, accrual_frequency } = req.body;
  const accrual = accrual_frequency === 'monthly' ? 'monthly' : 'annual';
  try {
    const result = await query(
      'UPDATE leave_types SET name = $1, code = $2, annual_quota = $3, carry_forward = $4, accrual_frequency = $5 WHERE id = $6 AND company_id = $7 RETURNING *',
      [name, code, annual_quota || 0, carry_forward || false, accrual, req.params.id, req.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteLeaveType = async (req, res) => {
  try {
    const id = req.params.id, companyId = req.tenantId;
    // A leave type is referenced by leave_requests + leave_balances (FK), so a plain
    // DELETE fails once it's been used. Block deletion if any leave REQUESTS use it
    // (those are history we must not orphan); otherwise drop its balance allocations
    // (safe — re-derivable) and then the type.
    const used = await query(
      'SELECT COUNT(*)::int AS n FROM leave_requests WHERE leave_type_id = $1 AND company_id = $2',
      [id, companyId]
    );
    if ((used.rows[0] && used.rows[0].n) > 0) {
      return res.status(409).json({ error: `Cannot delete — ${used.rows[0].n} leave request(s) use this type. Remove or reassign them first.` });
    }
    await query('DELETE FROM leave_balances WHERE leave_type_id = $1 AND company_id = $2', [id, companyId]);
    await query('DELETE FROM leave_types WHERE id = $1 AND company_id = $2', [id, companyId]);
    res.json({ message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error.' });
  }
};

// ─── Leave Requests ───
const getLeaveRequests = async (req, res) => {
  try {
    // Only SUPER_ADMIN / HR see everyone; everyone else sees ONLY their own requests.
    const privileged = ['SUPER_ADMIN', 'HR'].includes(req.user.role);
    let sql = `SELECT lr.*, e.first_name, e.last_name, lt.name as leave_type_name, lt.code as leave_type_code
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.company_id = $1`;
    const p = [req.tenantId];
    if (!privileged) {
      const emp = await query('SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = $1) AND company_id = $2', [req.user.id, req.tenantId]);
      sql += ` AND lr.employee_id = $2`;
      p.push(emp.rows[0]?.id || -1);
    }
    sql += ' ORDER BY lr.created_at DESC';
    const result = await query(sql, p);
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
  const { leave_type_id, start_date, end_date, reason, leave_session } = req.body;
  try {
    // Resolve employee ID from user
    const empResult = await query('SELECT id, joining_date FROM employees WHERE email = (SELECT email FROM users WHERE id = $1) AND company_id = $2', [req.user.id, req.tenantId]);
    if (empResult.rows.length === 0) return res.status(400).json({ error: 'Employee not found.' });
    const employeeId = empResult.rows[0].id;
    const joiningDate = empResult.rows[0].joining_date;

    // Half-day leave is a SINGLE day worth 0.5 (FIRST_HALF / SECOND_HALF is just a label);
    // a full leave counts the weekdays in the range. Date-only YYYY-MM-DD string compares.
    const half = ['FIRST_HALF', 'SECOND_HALF'].includes(leave_session);
    const session = half ? leave_session : 'FULL';
    const sStr = String(start_date || '').slice(0, 10);
    let eStr = String(end_date || '').slice(0, 10);
    if (!sStr) return res.status(400).json({ error: 'Start date is required.' });
    if (sStr < istToday()) return res.status(400).json({ error: 'Cannot apply for a past date.' });

    let days;
    if (half) {
      eStr = sStr; // half-day spans a single day
      days = 0.5;
    } else {
      if (!eStr) return res.status(400).json({ error: 'End date is required.' });
      if (eStr < sStr) return res.status(400).json({ error: 'End date cannot be before the start date.' });
      days = 0;
      for (let d = new Date(sStr); d <= new Date(eStr); d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) days++;
      }
      if (days < 1) days = 1;
    }

    // Check balance against what's ACCRUED so far (monthly types earn quota/12 per month;
    // annual types are fully accrued, so available === remaining for them). Unpaid leave
    // (quota 0) is never balance-checked.
    const year = new Date(sStr).getFullYear();
    const balResult = await query(
      'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND company_id = $4',
      [employeeId, leave_type_id, year, req.tenantId]
    );
    const ltResult = await query('SELECT * FROM leave_types WHERE id = $1 AND company_id = $2', [leave_type_id, req.tenantId]);
    const lt = ltResult.rows[0];
    if (lt && (parseInt(lt.annual_quota) || 0) > 0 && balResult.rows.length > 0) {
      const used = parseFloat(balResult.rows[0].used) || 0;
      // Cap = this employee's allocated `total` (HR-overridable), ramped by the type's accrual mode.
      const available = Math.max(0, accruedToDate({ annual_quota: balResult.rows[0].total, accrual_frequency: lt.accrual_frequency }, year, joiningDate) - used);
      if (days > available) {
        const rate = (parseInt(lt.annual_quota) || 0) / 12;
        const note = lt.accrual_frequency === 'monthly' ? ` (accrues ${rate % 1 === 0 ? rate : rate.toFixed(2)}/month)` : '';
        return res.status(400).json({ error: `Insufficient balance. Available now: ${available} day(s)${note}.` });
      }
    }

    const result = await query(
      'INSERT INTO leave_requests (company_id, employee_id, leave_type_id, start_date, end_date, days, leave_session, reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.tenantId, employeeId, leave_type_id, sStr, eStr, days, session, reason || '']
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

    // Read the CURRENT state first so we can apply the right balance delta and stay
    // idempotent — re-approving doesn't double-count, and changing an APPROVED request to
    // REJECTED (e.g. an accidental approval) ADDS the days back to the balance.
    const before = await query('SELECT * FROM leave_requests WHERE id = $1 AND company_id = $2', [req.params.id, req.tenantId]);
    if (before.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    const prev = before.rows[0];
    const wasApproved = prev.status === 'APPROVED';
    const willApprove = status === 'APPROVED';

    const result = await query(
      'UPDATE leave_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 AND company_id = $4 RETURNING *',
      [status, reviewerId, req.params.id, req.tenantId]
    );
    const lr = result.rows[0];

    // Balance delta: consume days when entering APPROVED, release them when leaving APPROVED.
    let delta = 0;
    if (!wasApproved && willApprove) delta = lr.days;
    else if (wasApproved && !willApprove) delta = -lr.days;
    if (delta !== 0) {
      const year = new Date(lr.start_date).getFullYear();
      const bal = await query(
        'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND company_id = $4',
        [lr.employee_id, lr.leave_type_id, year, req.tenantId]
      );
      if (bal.rows.length > 0) {
        const newUsed = Math.max(0, (parseFloat(bal.rows[0].used) || 0) + delta);
        const newRemaining = Math.max(0, (parseFloat(bal.rows[0].total) || 0) - newUsed);
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

// Employee revokes their OWN leave before it starts (HR may revoke any). If it was
// APPROVED, the days are released back to the balance. Marks the request CANCELLED.
const cancelLeave = async (req, res) => {
  try {
    const id = req.params.id, companyId = req.tenantId;
    const found = await query('SELECT * FROM leave_requests WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (found.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    const lr = found.rows[0];

    // Ownership: non-HR can only revoke their own request.
    const privileged = ['SUPER_ADMIN', 'HR'].includes(req.user.role);
    if (!privileged) {
      const emp = await query('SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = $1) AND company_id = $2', [req.user.id, companyId]);
      if ((emp.rows[0]?.id || -1) !== lr.employee_id) return res.status(403).json({ error: 'You can only revoke your own leave.' });
    }

    // Revocable only while PENDING/APPROVED and not yet started.
    if (!['PENDING', 'APPROVED'].includes(lr.status)) return res.status(400).json({ error: `Cannot revoke a ${String(lr.status).toLowerCase()} leave.` });
    const startStr = String(lr.start_date).slice(0, 10);
    if (startStr <= istToday()) return res.status(400).json({ error: 'Leave has already started — contact HR.' });

    const wasApproved = lr.status === 'APPROVED';
    await query('UPDATE leave_requests SET status = $1 WHERE id = $2 AND company_id = $3', ['CANCELLED', id, companyId]);

    // Release the consumed days if it had been approved.
    if (wasApproved) {
      const year = new Date(lr.start_date).getFullYear();
      const bal = await query(
        'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND company_id = $4',
        [lr.employee_id, lr.leave_type_id, year, companyId]
      );
      if (bal.rows.length > 0) {
        const newUsed = Math.max(0, (parseFloat(bal.rows[0].used) || 0) - lr.days);
        const newRemaining = Math.max(0, (parseFloat(bal.rows[0].total) || 0) - newUsed);
        await query(
          'INSERT INTO leave_balances (company_id, employee_id, leave_type_id, year, total, used, remaining) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE SET used = $6, remaining = $7',
          [companyId, lr.employee_id, lr.leave_type_id, year, bal.rows[0].total, newUsed, newRemaining]
        );
      }
    }

    res.json({ message: 'Revoked.' });
  } catch (err) {
    console.error('Cancel Leave Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── Leave Balances ───
const getLeaveBalances = async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  let employeeId = req.query.employee_id;
  try {
    // Non-privileged users may only see their OWN balances (ignore any employee_id param).
    const privileged = ['SUPER_ADMIN', 'HR'].includes(req.user.role);
    if (!privileged) {
      const emp = await query('SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = $1) AND company_id = $2', [req.user.id, req.tenantId]);
      employeeId = emp.rows[0]?.id || -1;
    }
    let sql = `SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code,
                      lt.annual_quota, lt.accrual_frequency, e.first_name, e.last_name, e.joining_date
               FROM leave_balances lb
               LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
               LEFT JOIN employees e ON lb.employee_id = e.id
               WHERE lb.company_id = $1 AND lb.year = $2`;
    const p = [req.tenantId, year];
    if (employeeId) { sql += ' AND lb.employee_id = $3'; p.push(employeeId); }
    const result = await query(sql, p);
    const rows = result.rows.map(r => {
      // accrued = days earned so far. The cap is the BALANCE's `total` (the per-employee
      // allocation HR can override), not the type's annual_quota — so a custom allocation
      // (e.g. CL 6 for one employee) is respected. Monthly types ramp `total` over the year.
      const accrued = accruedToDate({ annual_quota: r.total, accrual_frequency: r.accrual_frequency }, parseInt(r.year), r.joining_date);
      const available = Math.max(0, accrued - (parseFloat(r.used) || 0));
      return {
        ...r,
        accrued,
        available,
        employee_name: r.employee_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || `Emp #${r.employee_id}`
      };
    });
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

// HR overrides ONE employee's allocation (`total`) for a leave type + year. `used` is
// preserved (it's driven by approvals); remaining = total − used. Creates the row if absent.
const adjustBalance = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const employee_id = parseInt(req.body.employee_id);
    const leave_type_id = parseInt(req.body.leave_type_id);
    const year = parseInt(req.body.year) || new Date().getFullYear();
    if (!employee_id || !leave_type_id) return res.status(400).json({ error: 'employee_id and leave_type_id are required.' });
    const r1 = (v) => Math.max(0, Math.round((parseFloat(v) || 0) * 10) / 10); // ≥0, 1-decimal
    const newTotal = r1(req.body.total);

    const existing = await query(
      'SELECT used FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 AND company_id = $4',
      [employee_id, leave_type_id, year, companyId]
    );
    // `used` is now editable too — use the provided value if sent, else keep the existing one.
    const existingUsed = existing.rows.length ? (parseFloat(existing.rows[0].used) || 0) : 0;
    const used = (req.body.used !== undefined && req.body.used !== null && req.body.used !== '')
      ? r1(req.body.used)
      : existingUsed;
    const remaining = Math.max(0, newTotal - used);
    await query(
      `INSERT INTO leave_balances (company_id, employee_id, leave_type_id, year, total, used, remaining)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE SET total = $5, used = $6, remaining = $7`,
      [companyId, employee_id, leave_type_id, year, newTotal, used, remaining]
    );
    res.json({ message: 'Updated.', employee_id, leave_type_id, year, total: newTotal, used, remaining });
  } catch (err) {
    console.error('Adjust Balance Error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType,
  getLeaveRequests, applyLeave, reviewLeave, cancelLeave,
  getLeaveBalances, initBalances, adjustBalance
};
