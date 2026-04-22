const { query } = require('../config/db');

// ── Salary Structures ────────────────────────────────────────────────────────

const getSalaryStructures = async (req, res) => {
  const companyId = req.tenantId;
  try {
    const result = await query(
      `SELECT ss.*, e.first_name, e.last_name, e.employee_code, e.email
       FROM salary_structures ss
       LEFT JOIN employees e ON ss.employee_id = e.id
       WHERE ss.company_id = $1`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get Salary Structures Error:', err);
    res.status(500).json({ error: 'Server error retrieving salary structures.' });
  }
};

const getSalaryStructure = async (req, res) => {
  const companyId = req.tenantId;
  const { employeeId } = req.params;
  try {
    const result = await query(
      `SELECT ss.*, e.first_name, e.last_name, e.employee_code, e.email
       FROM salary_structures ss
       LEFT JOIN employees e ON ss.employee_id = e.id
       WHERE ss.employee_id = $1 AND ss.company_id = $2`,
      [employeeId, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Salary structure not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get Salary Structure Error:', err);
    res.status(500).json({ error: 'Server error retrieving salary structure.' });
  }
};

// Archive old record to history, then upsert current
const upsertSalaryStructure = async (req, res) => {
  const companyId = req.tenantId;
  const { employeeId } = req.params;
  const { basic_pay, hra, da, conveyance, medical, special_allowance, effective_from, deductions, customDeductions } = req.body;
  const deductionsJson = JSON.stringify({ deductions: deductions || {}, customDeductions: customDeductions || [] });

  try {
    const existing = await query(
      'SELECT * FROM salary_structures WHERE employee_id = $1 AND company_id = $2',
      [employeeId, companyId]
    );

    let result;
    if (existing.rows.length > 0) {
      const old = existing.rows[0];
      await query(
        `INSERT INTO salary_structure_history (original_id, employee_id, company_id, basic_pay, hra, da, conveyance, medical, special_allowance, effective_from, effective_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [old.id, old.employee_id, old.company_id, old.basic_pay, old.hra, old.da,
         old.conveyance, old.medical, old.special_allowance, old.effective_from,
         effective_from || new Date().toISOString().split('T')[0]]
      );
      result = await query(
        `UPDATE salary_structures SET
          basic_pay = $1, hra = $2, da = $3, conveyance = $4, medical = $5,
          special_allowance = $6, effective_from = $7, deductions_json = $8
         WHERE employee_id = $9 AND company_id = $10 RETURNING *`,
        [basic_pay, hra, da, conveyance, medical, special_allowance, effective_from, deductionsJson, employeeId, companyId]
      );
      res.json(result.rows[0]);
    } else {
      result = await query(
        `INSERT INTO salary_structures (employee_id, company_id, basic_pay, hra, da, conveyance, medical, special_allowance, effective_from, deductions_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [employeeId, companyId, basic_pay, hra, da, conveyance, medical, special_allowance, effective_from, deductionsJson]
      );
      res.status(201).json(result.rows[0]);
    }
  } catch (err) {
    console.error('Upsert Salary Structure Error:', err);
    res.status(500).json({ error: 'Server error saving salary structure.' });
  }
};

// Get full revision history for an employee's salary structure
const getSalaryStructureHistory = async (req, res) => {
  const companyId = req.tenantId;
  const { employeeId } = req.params;
  try {
    const result = await query(
      `SELECT h.*, e.first_name, e.last_name, e.employee_code
       FROM salary_structure_history h
       LEFT JOIN employees e ON h.employee_id = e.id
       WHERE h.employee_id = $1 AND h.company_id = $2
       ORDER BY h.archived_at DESC`,
      [employeeId, companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get Salary Structure History Error:', err);
    res.status(500).json({ error: 'Server error retrieving salary history.' });
  }
};

// ── Payroll Records ──────────────────────────────────────────────────────────

const getPayrollRecords = async (req, res) => {
  const companyId = req.tenantId;
  const { month, year } = req.query;
  try {
    let result;
    if (month && year) {
      result = await query(
        `SELECT pr.*, e.first_name, e.last_name, e.employee_code, e.email
         FROM payroll_records pr
         LEFT JOIN employees e ON pr.employee_id = e.id
         WHERE pr.company_id = $1 AND pr.month = $2 AND pr.year = $3
         ORDER BY pr.created_at DESC`,
        [companyId, parseInt(month), parseInt(year)]
      );
    } else {
      result = await query(
        `SELECT pr.*, e.first_name, e.last_name, e.employee_code, e.email
         FROM payroll_records pr
         LEFT JOIN employees e ON pr.employee_id = e.id
         WHERE pr.company_id = $1
         ORDER BY pr.year DESC, pr.month DESC, pr.created_at DESC`,
        [companyId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Get Payroll Records Error:', err);
    res.status(500).json({ error: 'Server error retrieving payroll records.' });
  }
};

// Get all historical payroll months (distinct month/year pairs)
const getPayrollHistory = async (req, res) => {
  const companyId = req.tenantId;
  try {
    const result = await query(
      `SELECT * FROM payroll_records WHERE company_id = $1 ORDER BY year DESC, month DESC`,
      [companyId]
    );
    // Group by month/year and aggregate
    const grouped = {};
    for (const r of result.rows) {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
      if (!grouped[key]) {
        grouped[key] = { month: r.month, year: r.year, employee_count: 0, total_gross: 0, total_net: 0, total_deductions: 0, status: r.status };
      }
      grouped[key].employee_count++;
      grouped[key].total_gross += parseFloat(r.gross_salary) || 0;
      grouped[key].total_net += parseFloat(r.net_salary) || 0;
      grouped[key].total_deductions += parseFloat(r.total_deductions) || 0;
    }
    res.json(Object.values(grouped).sort((a, b) => b.year - a.year || b.month - a.month));
  } catch (err) {
    console.error('Get Payroll History Error:', err);
    res.status(500).json({ error: 'Server error retrieving payroll history.' });
  }
};

/**
 * Calculate attendance-based payable days for an employee in a month
 * Returns: { totalWorkingDays, presentDays, halfDays, absentDays, paidLeaveDays, unpaidLeaveDays, payableDays }
 */
const calculateAttendanceDays = async (companyId, employeeId, month, year) => {
  const m = parseInt(month), y = parseInt(year);
  const daysInMonth = new Date(y, m, 0).getDate();

  // Total working days = calendar days - weekends
  let totalWorkingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6) totalWorkingDays++;
  }

  // Fetch attendance records for this employee in this month
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const attResult = await query(
    `SELECT * FROM attendance WHERE employee_id = $1 AND company_id = $2
     AND check_in::date >= $3::date AND check_in::date <= $4::date`,
    [employeeId, companyId, startDate, endDate]
  );

  let presentDays = 0, halfDays = 0, absentDays = 0;
  const attendedDateSet = new Set();

  for (const rec of attResult.rows) {
    const dateStr = new Date(rec.check_in).toISOString().split('T')[0];
    attendedDateSet.add(dateStr);

    const status = (rec.status || '').toUpperCase();
    const flags = rec.flags ? (typeof rec.flags === 'string' ? JSON.parse(rec.flags) : rec.flags) : [];
    const hasHalfday = flags.includes('HALFDAY') || flags.includes('HALF_DAY');
    const hasAbsent = flags.includes('ABSENT');

    if (hasAbsent) absentDays += 1;
    else if (hasHalfday || status === 'INCOMPLETE') halfDays += 1;
    else if (status === 'COMPLETE' || rec.net_work_minutes > 0) presentDays += 1;
    else absentDays += 1;
  }

  // Count working days without attendance as absent
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!attendedDateSet.has(dateStr)) {
      // Check if it's a future date
      if (new Date(dateStr) <= new Date()) absentDays += 1;
    }
  }

  // Fetch approved leaves in this month
  const leaveResult = await query(
    `SELECT lr.*, lt.annual_quota, lt.code FROM leave_requests lr
     LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.employee_id = $1 AND lr.company_id = $2 AND lr.status = 'APPROVED'
     AND lr.start_date <= $4::date AND lr.end_date >= $3::date`,
    [employeeId, companyId, startDate, endDate]
  ).catch(() => ({ rows: [] }));

  let paidLeaveDays = 0, unpaidLeaveDays = 0;
  for (const leave of leaveResult.rows) {
    const ls = new Date(Math.max(new Date(leave.start_date), new Date(startDate)));
    const le = new Date(Math.min(new Date(leave.end_date), new Date(endDate)));
    let daysInRange = 0;
    for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) daysInRange++;
    }
    // If leave type has annual_quota > 0 = paid leave, else unpaid (LOP)
    if ((parseInt(leave.annual_quota) || 0) > 0) paidLeaveDays += daysInRange;
    else unpaidLeaveDays += daysInRange;

    // If marked absent on leave day, reverse that absent count (leave takes precedence)
    for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dateStr = d.toISOString().split('T')[0];
      if (!attendedDateSet.has(dateStr) && absentDays > 0) absentDays -= 1;
    }
  }

  // Payable days = Present + 0.5*HalfDay + PaidLeave
  const payableDays = presentDays + (halfDays * 0.5) + paidLeaveDays;

  return {
    totalWorkingDays,
    presentDays,
    halfDays,
    absentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    payableDays: Math.min(payableDays, totalWorkingDays) // can't exceed total
  };
};

// Run payroll — attendance-based salary calculation
const runPayroll = async (req, res) => {
  const companyId = req.tenantId;
  const { month, year } = req.body;

  if (!month || !year) return res.status(400).json({ error: 'Month and year are required.' });

  try {
    const employees = await query(
      'SELECT * FROM employees WHERE company_id = $1 AND status = $2',
      [companyId, 'ACTIVE']
    );
    const structures = await query(
      'SELECT * FROM salary_structures WHERE company_id = $1',
      [companyId]
    );
    const structureMap = {};
    structures.rows.forEach(s => { structureMap[s.employee_id] = s; });

    const processed = [], skipped = [], noStructure = [];

    for (const emp of employees.rows) {
      const ss = structureMap[emp.id];
      if (!ss) { noStructure.push(emp.first_name + ' ' + emp.last_name); continue; }

      // Prevent duplicate
      const existing = await query(
        'SELECT id FROM payroll_records WHERE employee_id = $1 AND company_id = $2 AND month = $3 AND year = $4',
        [emp.id, companyId, parseInt(month), parseInt(year)]
      );
      if (existing.rows.length > 0) {
        skipped.push(emp.first_name + ' ' + emp.last_name);
        continue;
      }

      // Full salary structure
      const basic = parseFloat(ss.basic_pay) || 0;
      const hra = parseFloat(ss.hra) || 0;
      const da = parseFloat(ss.da) || 0;
      const conveyance = parseFloat(ss.conveyance) || 0;
      const medical = parseFloat(ss.medical) || 0;
      const special_allowance = parseFloat(ss.special_allowance) || 0;
      const bonus = 0;
      const fullGross = basic + hra + da + conveyance + medical + special_allowance + bonus;

      // Calculate attendance-based payable days
      const att = await calculateAttendanceDays(companyId, emp.id, month, year);
      const perDaySalary = att.totalWorkingDays > 0 ? (fullGross / att.totalWorkingDays) : 0;

      // Earned gross = per-day × payable days (prorated)
      const earnedGross = Math.round(perDaySalary * att.payableDays * 100) / 100;

      // LOP (Loss of Pay) = per-day × (absent + unpaid leave)
      const lopDays = att.absentDays + att.unpaidLeaveDays;
      const lopAmount = Math.round(perDaySalary * lopDays * 100) / 100;

      // Prorate individual components based on payable ratio
      const ratio = att.totalWorkingDays > 0 ? (att.payableDays / att.totalWorkingDays) : 0;
      const r = (v) => Math.round(v * ratio * 100) / 100;
      const proratedBasic = r(basic);
      const proratedHra = r(hra);
      const proratedDa = r(da);
      const proratedConv = r(conveyance);
      const proratedMed = r(medical);
      const proratedSA = r(special_allowance);

      // Statutory deductions on prorated gross
      const pf = Math.round(proratedBasic * 0.12 * 100) / 100;
      const esi = earnedGross < 21000 ? Math.round(earnedGross * 0.0075 * 100) / 100 : 0;
      const professional_tax = earnedGross > 0 ? 200 : 0;
      const tds = 0;
      const total_deductions = pf + esi + professional_tax + tds;
      const net_salary = Math.round((earnedGross - total_deductions) * 100) / 100;

      const result = await query(
        `INSERT INTO payroll_records (
          employee_id, company_id, month, year,
          basic_pay, hra, da, conveyance, medical, special_allowance, bonus,
          gross_salary, pf, esi, professional_tax, tds, total_deductions, net_salary, status,
          total_working_days, present_days, half_days, absent_days,
          paid_leave_days, unpaid_leave_days, payable_days, lop_amount
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27
        ) RETURNING *`,
        [emp.id, companyId, parseInt(month), parseInt(year),
         proratedBasic, proratedHra, proratedDa, proratedConv, proratedMed, proratedSA, bonus,
         earnedGross, pf, esi, professional_tax, tds, total_deductions, net_salary, 'PROCESSED',
         att.totalWorkingDays, att.presentDays, att.halfDays, att.absentDays,
         att.paidLeaveDays, att.unpaidLeaveDays, att.payableDays, lopAmount]
      );
      processed.push({ ...result.rows[0], employee_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() });
    }

    const messages = [];
    if (processed.length > 0) messages.push(`Processed ${processed.length} employee(s).`);
    if (skipped.length > 0) messages.push(`Skipped ${skipped.length} already processed: ${skipped.join(', ')}.`);
    if (noStructure.length > 0) messages.push(`No salary structure for: ${noStructure.join(', ')}.`);

    if (processed.length === 0 && skipped.length > 0) {
      return res.status(409).json({ error: `Payroll already processed for all employees this month. ${messages.join(' ')}` });
    }

    res.status(201).json({ message: messages.join(' '), records: processed, skipped, no_structure: noStructure });
  } catch (err) {
    console.error('Run Payroll Error:', err);
    res.status(500).json({ error: 'Server error processing payroll.' });
  }
};

const updatePayrollRecord = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;
  const { basic_pay, hra, da, conveyance, medical, special_allowance, bonus, tds, status } = req.body;

  try {
    const basic = parseFloat(basic_pay) || 0;
    const hraVal = parseFloat(hra) || 0;
    const daVal = parseFloat(da) || 0;
    const convVal = parseFloat(conveyance) || 0;
    const medVal = parseFloat(medical) || 0;
    const saVal = parseFloat(special_allowance) || 0;
    const bonusVal = parseFloat(bonus) || 0;
    const tdsVal = parseFloat(tds) || 0;

    const gross = basic + hraVal + daVal + convVal + medVal + saVal + bonusVal;
    const pf = Math.round(basic * 0.12 * 100) / 100;
    const esi = gross < 21000 ? Math.round(gross * 0.0075 * 100) / 100 : 0;
    const professional_tax = 200;
    const total_deductions = pf + esi + professional_tax + tdsVal;
    const net_salary = Math.round((gross - total_deductions) * 100) / 100;

    const result = await query(
      `UPDATE payroll_records SET
        basic_pay = $1, hra = $2, da = $3, conveyance = $4, medical = $5,
        special_allowance = $6, bonus = $7, gross_salary = $8, pf = $9, esi = $10,
        professional_tax = $11, tds = $12, total_deductions = $13, net_salary = $14, status = $15
       WHERE id = $16 AND company_id = $17 RETURNING *`,
      [basic, hraVal, daVal, convVal, medVal, saVal, bonusVal, gross, pf, esi,
       professional_tax, tdsVal, total_deductions, net_salary, status || 'PROCESSED', id, companyId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Payroll record not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Payroll Record Error:', err);
    res.status(500).json({ error: 'Server error updating payroll record.' });
  }
};

const getPayslip = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT pr.*, e.first_name, e.last_name, e.employee_code, e.email, d.name as department_name, des.name as designation_name
       FROM payroll_records pr
       LEFT JOIN employees e ON pr.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       WHERE pr.id = $1 AND pr.company_id = $2`,
      [id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payslip not found.' });

    const record = result.rows[0];
    // Fetch salary structure to get custom deductions
    const ssResult = await query(
      'SELECT deductions_json FROM salary_structures WHERE employee_id = $1 AND company_id = $2',
      [record.employee_id, companyId]
    );
    let customDeductions = [];
    if (ssResult.rows.length > 0 && ssResult.rows[0].deductions_json) {
      try {
        const parsed = JSON.parse(ssResult.rows[0].deductions_json);
        customDeductions = parsed.customDeductions || [];
      } catch (_) {}
    }
    // Compute custom deduction amounts against gross salary
    const gross = parseFloat(record.gross_salary) || 0;
    const resolvedCustom = customDeductions
      .filter(cd => cd.label && (parseFloat(cd.value) || 0) > 0)
      .map(cd => ({
        label: cd.label,
        amount: cd.type === 'percent'
          ? Math.round(gross * (parseFloat(cd.value) || 0) / 100)
          : (parseFloat(cd.value) || 0)
      }));

    res.json({ ...record, customDeductions: resolvedCustom });
  } catch (err) {
    console.error('Get Payslip Error:', err);
    res.status(500).json({ error: 'Server error retrieving payslip.' });
  }
};

// ── Form 16 ──────────────────────────────────────────────────────────────────

const getForm16List = async (req, res) => {
  const companyId = req.tenantId;
  try {
    const result = await query(
      `SELECT f.*, e.first_name, e.last_name, e.employee_code, e.email
       FROM form16_records f
       LEFT JOIN employees e ON f.employee_id = e.id
       WHERE f.company_id = $1
       ORDER BY f.financial_year DESC`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get Form16 List Error:', err);
    res.status(500).json({ error: 'Server error retrieving Form 16 records.' });
  }
};

const uploadForm16 = async (req, res) => {
  const companyId = req.tenantId;
  const { employee_id, financial_year, metadata } = req.body;
  if (!employee_id || !financial_year) return res.status(400).json({ error: 'Employee ID and financial year are required.' });
  try {
    const result = await query(
      `INSERT INTO form16_records (employee_id, company_id, financial_year, metadata)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [employee_id, companyId, financial_year, JSON.stringify(metadata || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload Form16 Error:', err);
    res.status(500).json({ error: 'Server error uploading Form 16.' });
  }
};

const deleteForm16 = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM form16_records WHERE id = $1 AND company_id = $2 RETURNING *',
      [id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form 16 record not found.' });
    res.json({ message: 'Form 16 deleted successfully.' });
  } catch (err) {
    console.error('Delete Form16 Error:', err);
    res.status(500).json({ error: 'Server error deleting Form 16.' });
  }
};

// ── Tax Declarations ──────────────────────────────────────────────────────────

const getTaxDeclarations = async (req, res) => {
  const companyId = req.tenantId;
  const { employeeId } = req.query;
  try {
    let result;
    if (employeeId) {
      result = await query(
        `SELECT td.*, e.first_name, e.last_name, e.employee_code
         FROM tax_declarations td
         LEFT JOIN employees e ON td.employee_id = e.id
         WHERE td.employee_id = $1 AND td.company_id = $2
         ORDER BY td.financial_year DESC`,
        [employeeId, companyId]
      );
    } else {
      result = await query(
        `SELECT td.*, e.first_name, e.last_name, e.employee_code
         FROM tax_declarations td
         LEFT JOIN employees e ON td.employee_id = e.id
         WHERE td.company_id = $1
         ORDER BY td.financial_year DESC`,
        [companyId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Get Tax Declarations Error:', err);
    res.status(500).json({ error: 'Server error retrieving tax declarations.' });
  }
};

const upsertTaxDeclaration = async (req, res) => {
  const companyId = req.tenantId;
  const { employeeId } = req.params;
  const { financial_year, regime, stdDeductionNew, stdDeductionOld, cessRate, slabs,
          sec80C, sec80D, sec80G, sec80E, hra_claimed, lta, nps, other, submitted, fy } = req.body;

  const fyVal = financial_year || fy || '2025-26';
  const submittedAt = submitted ? new Date().toISOString() : null;

  try {
    const result = await query(
      `INSERT INTO tax_declarations (employee_id, company_id, financial_year, regime, std_deduction_new, std_deduction_old, cess_rate, slabs_json, sec80c, sec80d, sec80g, sec80e, hra_claimed, lta, nps, other_deductions, submitted, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (employee_id, company_id, financial_year) DO UPDATE SET
         regime = EXCLUDED.regime,
         std_deduction_new = EXCLUDED.std_deduction_new,
         std_deduction_old = EXCLUDED.std_deduction_old,
         cess_rate = EXCLUDED.cess_rate,
         slabs_json = EXCLUDED.slabs_json,
         sec80c = EXCLUDED.sec80c, sec80d = EXCLUDED.sec80d, sec80g = EXCLUDED.sec80g, sec80e = EXCLUDED.sec80e,
         hra_claimed = EXCLUDED.hra_claimed, lta = EXCLUDED.lta, nps = EXCLUDED.nps,
         other_deductions = EXCLUDED.other_deductions,
         submitted = EXCLUDED.submitted,
         submitted_at = COALESCE(EXCLUDED.submitted_at, tax_declarations.submitted_at),
         updated_at = NOW()
       RETURNING *`,
      [employeeId, companyId, fyVal, regime || 'new',
       stdDeductionNew || 75000, stdDeductionOld || 50000, cessRate || 4,
       JSON.stringify(slabs || {}),
       sec80C || 0, sec80D || 0, sec80G || 0, sec80E || 0,
       hra_claimed || 0, lta || 0, nps || 0, other || 0,
       submitted || false, submittedAt]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Upsert Tax Declaration Error:', err);
    res.status(500).json({ error: 'Server error saving tax declaration.' });
  }
};

// ── Payroll Summary ───────────────────────────────────────────────────────────

const getPayrollSummary = async (req, res) => {
  const companyId = req.tenantId;
  const { month, year } = req.query;

  try {
    let records;
    if (month && year) {
      records = await query(
        'SELECT * FROM payroll_records WHERE company_id = $1 AND month = $2 AND year = $3',
        [companyId, parseInt(month), parseInt(year)]
      );
    } else {
      records = await query('SELECT * FROM payroll_records WHERE company_id = $1', [companyId]);
    }

    const rows = records.rows;
    const totalPayout      = rows.reduce((s, r) => s + (parseFloat(r.net_salary)       || 0), 0);
    const totalGross       = rows.reduce((s, r) => s + (parseFloat(r.gross_salary)     || 0), 0);
    const totalDeductions  = rows.reduce((s, r) => s + (parseFloat(r.total_deductions) || 0), 0);
    const totalPf          = rows.reduce((s, r) => s + (parseFloat(r.pf)               || 0), 0);
    const totalEsi         = rows.reduce((s, r) => s + (parseFloat(r.esi)              || 0), 0);
    const totalTds         = rows.reduce((s, r) => s + (parseFloat(r.tds)              || 0), 0);
    const avgSalary        = rows.length > 0 ? Math.round((totalPayout / rows.length) * 100) / 100 : 0;

    res.json({
      total_payout:     Math.round(totalPayout    * 100) / 100,
      total_gross:      Math.round(totalGross     * 100) / 100,
      total_deductions: Math.round(totalDeductions* 100) / 100,
      avg_salary: avgSalary,
      employee_count: rows.length,
      total_pf:  Math.round(totalPf  * 100) / 100,
      total_esi: Math.round(totalEsi * 100) / 100,
      total_tds: Math.round(totalTds * 100) / 100
    });
  } catch (err) {
    console.error('Get Payroll Summary Error:', err);
    res.status(500).json({ error: 'Server error retrieving payroll summary.' });
  }
};

module.exports = {
  getSalaryStructures, getSalaryStructure, upsertSalaryStructure, getSalaryStructureHistory,
  getPayrollRecords, getPayrollHistory, runPayroll, updatePayrollRecord, getPayslip,
  getForm16List, uploadForm16, deleteForm16,
  getTaxDeclarations, upsertTaxDeclaration,
  getPayrollSummary
};
