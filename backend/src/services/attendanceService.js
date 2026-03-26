const { query } = require('../config/db');

/**
 * Attendance Service
 * Handles shift logic and attendance calculations
 */

/**
 * Calculate attendance status based on shift and check-in/out times
 */
const calculateAttendance = (shift, checkIn, checkOut) => {
  const getShiftDate = (timeString) => {
    if (!timeString) return new Date(checkIn); // Fallback
    const d = new Date(checkIn);
    if (!timeString || !timeString.includes(':')) return d; 
    const [h, m] = timeString.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    
    // Simplistic handling for night shift wrap-around
    const startH = parseInt(shift.shift_start_time.split(':')[0], 10);
    if (startH >= 12 && h < 12) d.setDate(d.getDate() + 1);
    
    return d;
  };

  const shiftStart = getShiftDate(shift.shift_start_time);
  const graceEnd = new Date(shiftStart.getTime() + ((shift.grace_minutes || 0) * 60000));
  
  const lateStart = getShiftDate(shift.late_start_time);
  const lateEnd = getShiftDate(shift.late_end_time);
  const overlateStart = getShiftDate(shift.overlate_start_time);
  const halfdayStart = getShiftDate(shift.halfday_start_time);

  let status = 'ON_TIME';
  
  // Priority logic exactly as requested: HALF-DAY > OVER-LATE > LATE > ON-TIME
  if (checkIn >= halfdayStart) {
    status = 'HALF_DAY';
  } else if (checkIn >= overlateStart) {
    status = 'OVER_LATE';
  } else if (checkIn >= lateStart && checkIn <= lateEnd) {
    status = 'LATE';
  } else if (checkIn <= graceEnd) {
    status = 'ON_TIME';
  } else {
    // If checkIn falls between graceEnd and lateStart (shouldn't happen with tight rules)
    status = 'LATE';
  }

  // Calculate Late Minutes
  let lateMinutes = 0;
  if (checkIn > shiftStart) {
    lateMinutes = Math.floor((checkIn - shiftStart) / 60000);
  }

  const expectedCheckout = new Date(checkIn.getTime() + (shift.total_working_hours * 60 * 60 * 1000));

  let workingHours = 0;
  let shortfallMinutes = 0;
  if (checkOut) {
    workingHours = (checkOut - checkIn) / (1000 * 60 * 60);

    if (checkOut < expectedCheckout) {
      shortfallMinutes = Math.floor((expectedCheckout - checkOut) / 60000);
      if (shortfallMinutes < 0) shortfallMinutes = 0;
    }

    // Enforce dynamic minimum working hours for HALF_DAY checkout overrides
    const minWorkingHoursForFullDay = shift.total_working_hours / 2; // e.g. must work at least 4.5 out of 9 hours
    if (workingHours > 0 && workingHours < minWorkingHoursForFullDay) {
      status = 'HALF_DAY';
    } else if (workingHours === 0) {
      status = 'ABSENT';
    }
  }

  return { 
    status,
    lateMinutes,
    shortfallMinutes,
    workingHours: parseFloat(workingHours.toFixed(2)),
    expectedCheckoutTime: expectedCheckout,
    overtimeHours: Math.max(0, workingHours - shift.total_working_hours).toFixed(2),
    breakTime: checkOut ? '1h 00m' : '0h 00m',
    activeTime: checkOut ? `${Math.max(0, Math.floor(workingHours - 1))}h ${Math.floor((workingHours % 1) * 60)}m` : '0h 00m',
    idleTime: checkOut ? '0h 15m' : '0h 00m'
  };
};

/**
 * Process check-in
 */
const checkIn = async (userIdOrEmployeeId, companyId, location, manualCheckInTime) => {
  // 1. Resolve actual Employee ID if a User ID was provided
  // In our system, req.user.id is often passed, which is the users.id
  let employeeId = userIdOrEmployeeId;
  
  const userResult = await query('SELECT email FROM users WHERE id = $1', [userIdOrEmployeeId]);
  if (userResult.rows.length > 0) {
    const userEmail = userResult.rows[0].email;
    const empResult = await query('SELECT id FROM employees WHERE email = $1 AND company_id = $2', [userEmail, companyId]);
    if (empResult.rows.length > 0) {
      employeeId = empResult.rows[0].id;
      console.log(`[CheckIn] Resolved userId ${userIdOrEmployeeId} to employeeId ${employeeId} for ${userEmail}`);
    }
  }

  // 2. Fetch Shift
  const shiftResult = await query(
    `SELECT s.* FROM employee_shifts es 
     JOIN shifts s ON es.shift_id = s.id 
     WHERE es.employee_id = $1 AND es.company_id = $2 AND 
     (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
     ORDER BY es.effective_from DESC LIMIT 1`,
    [employeeId, companyId]
  );

  const shift = shiftResult.rows[0];
  if (!shift) {
    console.error(`[CheckIn Error] No shift found for employeeId: ${employeeId}, companyId: ${companyId}`);
    // Diagnostic check: Does the employee even exist?
    const empCheck = await query('SELECT id, first_name, email FROM employees WHERE id = $1', [employeeId]);
    if (empCheck.rows.length === 0) {
      throw new Error(`Employee record not found for ID ${employeeId}.`);
    }
    throw new Error(`No assigned shift found for employee ${empCheck.rows[0].first_name} (${empCheck.rows[0].id}). Please ensure a shift is assigned in the Employee matching your login email.`);
  }

  const checkInTime = manualCheckInTime ? new Date(manualCheckInTime) : new Date();
  const { status, expectedCheckoutTime, lateMinutes } = calculateAttendance(shift, checkInTime, null);

  const result = await query(
    `INSERT INTO attendance (company_id, employee_id, check_in, status, location_metadata)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, employeeId, checkInTime, status, JSON.stringify(location || {})]
  );

  return {
    ...result.rows[0],
    expected_checkout_time: expectedCheckoutTime,
    late_minutes: lateMinutes,
    late_count: status === 'LATE' ? 1 : 0,
    overlate_count: status === 'OVER_LATE' ? 1 : 0
  };
};

/**
 * Process check-out
 */
const checkOut = async (attendanceId, companyId, manualCheckOutTime) => {
  const checkOutTime = manualCheckOutTime ? new Date(manualCheckOutTime) : new Date();
  
  const attResult = await query(
    'SELECT a.*, s.shift_start_time, s.shift_end_time, s.total_working_hours, s.grace_minutes, s.late_start_time, s.late_end_time, s.overlate_start_time, s.halfday_start_time FROM attendance a JOIN employee_shifts es ON a.employee_id = es.employee_id JOIN shifts s ON es.shift_id = s.id WHERE a.id = $1 AND a.company_id = $2',
    [attendanceId, companyId]
  );

  const record = attResult.rows[0];
  if (!record) throw new Error('Attendance record not found.');

  const shift = { 
    shift_start_time: record.shift_start_time, 
    shift_end_time: record.shift_end_time, 
    total_working_hours: record.total_working_hours,
    grace_minutes: record.grace_minutes,
    late_start_time: record.late_start_time,
    late_end_time: record.late_end_time,
    overlate_start_time: record.overlate_start_time,
    halfday_start_time: record.halfday_start_time
  };

  const { workingHours, overtimeHours, status, lateMinutes, shortfallMinutes, breakTime, activeTime, idleTime, expectedCheckoutTime } = calculateAttendance(shift, new Date(record.check_in), checkOutTime);

  const result = await query(
    `UPDATE attendance 
     SET check_out = $1, working_hours = $2, overtime_hours = $3, status = $4
     WHERE id = $5 AND company_id = $6 RETURNING *`,
    [checkOutTime, workingHours, overtimeHours, status, attendanceId, companyId]
  );

  return {
    ...result.rows[0],
    working_hours: workingHours,
    final_status: status,
    expected_checkout_time: expectedCheckoutTime,
    late_minutes: lateMinutes,
    shortfall_minutes: shortfallMinutes,
    break_time: breakTime,
    active_time: activeTime,
    idle_time: idleTime,
    late_count: status === 'LATE' ? 1 : 0,
    overlate_count: status === 'OVER_LATE' ? 1 : 0
  };
};

/**
 * Update attendance (Manual Override/Remarks)
 */
const updateAttendance = async (attendanceId, companyId, updates) => {
  let record;
  let employeeId;

  if (String(attendanceId).startsWith('dummy-')) {
    employeeId = parseInt(attendanceId.split('-')[1]);
  } else {
    const attResult = await query(
      'SELECT a.*, s.shift_start_time, s.shift_end_time, s.total_working_hours, s.grace_minutes, s.late_start_time, s.late_end_time, s.overlate_start_time, s.halfday_start_time FROM attendance a JOIN employee_shifts es ON a.employee_id = es.employee_id JOIN shifts s ON es.shift_id = s.id WHERE a.id = $1 AND a.company_id = $2',
      [attendanceId, companyId]
    );
    record = attResult.rows[0];
    if (!record) throw new Error('Attendance record not found.');
    employeeId = record.employee_id;
  }

  // Fetch shift for calculations
  const shiftResult = await query(
    `SELECT s.* FROM employee_shifts es 
     JOIN shifts s ON es.shift_id = s.id 
     WHERE es.employee_id = $1 AND es.company_id = $2`,
    [employeeId, companyId]
  );
  const shift = shiftResult.rows[0];

  const checkInTime = updates.check_in ? new Date(updates.check_in) : (record ? new Date(record.check_in) : new Date());
  const checkOutTime = updates.check_out ? new Date(updates.check_out) : (record?.check_out ? new Date(record.check_out) : null);
  
  const { workingHours, overtimeHours, status, lateMinutes, shortfallMinutes, breakTime, activeTime, idleTime, expectedCheckoutTime } = calculateAttendance(shift, checkInTime, checkOutTime);

  let result;
  if (String(attendanceId).startsWith('dummy-')) {
    result = await query(
      `INSERT INTO attendance (company_id, employee_id, check_in, check_out, working_hours, overtime_hours, status, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [companyId, employeeId, checkInTime, checkOutTime, workingHours, overtimeHours, status, updates.remarks]
    );
  } else {
    result = await query(
      `UPDATE attendance 
       SET check_in = $1, check_out = $2, working_hours = $3, overtime_hours = $4, status = $5, remarks = $6
       WHERE id = $7 AND company_id = $8 RETURNING *`,
      [checkInTime, checkOutTime, workingHours, overtimeHours, status, updates.remarks || record.remarks, attendanceId, companyId]
    );
  }

  return {
    ...result.rows[0],
    working_hours: workingHours,
    final_status: status,
    expected_checkout_time: expectedCheckoutTime,
    late_minutes: lateMinutes,
    shortfall_minutes: shortfallMinutes,
    break_time: breakTime,
    active_time: activeTime,
    idle_time: idleTime
  };
};

/**
 * Get daily attendance for all employees
 */
const getDailyAttendance = async (companyId, dateStr) => {
  const employees = await query('SELECT * FROM employees WHERE company_id = $1', [companyId]);
  
  // Get attendance for the specific date
  // PostgreSQL handles DATE comparison correctly with $2
  const attendance = await query(
    `SELECT * FROM attendance 
     WHERE company_id = $1 AND check_in::date = $2::date`, 
    [companyId, dateStr]
  );
  
  const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
  const shift = shifts.rows[0];

  const records = employees.rows.map((emp) => {
    const existing = attendance.rows.find(a => a.employee_id === emp.id);
    if (existing) {
      const checkIn = new Date(existing.check_in);
      const checkOut = existing.check_out ? new Date(existing.check_out) : null;
      
      let metrics = { status: existing.status || 'PRESENT', workingHours: existing.working_hours || 0 };
      if (shift) {
        metrics = calculateAttendance(shift, checkIn, checkOut);
      }
      
      return {
        ...existing,
        employee_id: emp.id,
        email: emp.email,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown',
        role: emp.role,
        ...metrics,
        expectedCheckout: metrics.expectedCheckoutTime,
        workHours: metrics.workingHours > 0 ? `${Math.floor(metrics.workingHours)}h ${Math.floor((metrics.workingHours % 1) * 60)}m` : (existing.check_out ? '0h 00m' : 'In Progress')
      };
    }

    // No record found: Return a clean "Absent/Not Checked In" state without simulation
    return { 
      id: `no-ref-${emp.id}`, 
      employee_id: emp.id, 
      email: emp.email,
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown', 
      status: 'ABSENT', 
      check_in: '-', 
      check_out: '-', 
      workHours: '0h 00m' 
    };
  });

  return records;
};

const getStats = async (companyId, dateStr) => {
  const attendanceRecords = await getDailyAttendance(companyId, dateStr);
  
  const totalEmployees = attendanceRecords.length;
  const presentRecords = attendanceRecords.filter(a => !String(a.id).startsWith('no-ref-') && a.check_in !== '-');
  const presentCount = presentRecords.length;
  
  const lateCount = presentRecords.filter(a => {
    const status = (a.status || '').toUpperCase().replace(/_/g, ' ');
    return status.includes('LATE');
  }).length;

  const productivity = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

  console.log(`[Stats Debug] Final Result: Total=${totalEmployees}, Present=${presentCount}, Late=${lateCount}`);

  return {
    totalEmployees,
    presentToday: presentCount,
    lateArrivals: lateCount,
    productivity: `${productivity}%`
  };
};

module.exports = {
  checkIn,
  checkOut,
  getDailyAttendance,
  updateAttendance,
  getStats
};
