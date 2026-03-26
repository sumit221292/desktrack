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
    if (!timeString) return new Date(checkIn);
    const d = new Date(checkIn);
    const [h, m] = timeString.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const shiftStart = getShiftDate(shift.shift_start_time);
  const graceEnd = new Date(shiftStart.getTime() + ((shift.grace_minutes || 0) * 60000));
  const lateStart = shift.late_start_time ? getShiftDate(shift.late_start_time) : graceEnd;
  const lateEnd = shift.late_end_time ? getShiftDate(shift.late_end_time) : null;
  const overlateStart = shift.overlate_start_time ? getShiftDate(shift.overlate_start_time) : null;
  const halfdayStart = shift.halfday_start_time ? getShiftDate(shift.halfday_start_time) : null;

  let status = 'ON_TIME';
  
  // SEQUENTIAL CHECK: Most severe first
  if (halfdayStart && checkIn >= halfdayStart) {
    status = 'HALF_DAY';
  } else if (overlateStart && checkIn >= overlateStart) {
    status = 'OVER_LATE';
  } else if (lateStart && checkIn >= lateStart) {
    // Check if within late window if defined
    if (!lateEnd || checkIn <= lateEnd) {
      status = 'LATE';
    } else {
      // If past lateEnd but before overlate (logic gap), fall through or mark LATE
      status = 'LATE';
    }
  } else if (checkIn <= graceEnd) {
    status = 'ON_TIME';
  } else {
    // Default to LATE if past grace but before other markers
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

    // Force HALF_DAY if worked less than 50% of the shift
    const minWorkingHoursForFullDay = (shift.total_working_hours || 9) / 2;
    if (workingHours > 0 && workingHours < minWorkingHoursForFullDay) {
      status = 'HALF_DAY';
    } else if (workingHours <= 0) {
      status = 'ABSENT';
    }
  }

  // DEBUG Logging for Production
  if (checkIn.getDate() === new Date().getDate()) {
    console.log(`[Attendance] Calculating for ${checkIn.toISOString()}: Start=${shiftStart.toLocaleTimeString()}, GraceEnd=${graceEnd.toLocaleTimeString()}, LateStart=${lateStart?.toLocaleTimeString()}, HalfDayStart=${halfdayStart?.toLocaleTimeString()} -> Status: ${status}`);
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
  let employeeId = userIdOrEmployeeId;
  const userResult = await query('SELECT email FROM users WHERE id = $1', [userIdOrEmployeeId]);
  if (userResult.rows.length > 0) {
    const userEmail = userResult.rows[0].email;
    const empResult = await query('SELECT id FROM employees WHERE email = $1 AND company_id = $2', [userEmail, companyId]);
    if (empResult.rows.length > 0) {
      employeeId = empResult.rows[0].id;
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
  if (!shift) throw new Error('No assigned shift found.');

  const checkInTime = manualCheckInTime ? new Date(manualCheckInTime) : new Date();
  const dateStr = checkInTime.toISOString().split('T')[0];

  // 3. Check for existing daily attendance record
  const existingAtt = await query(
    'SELECT * FROM attendance WHERE employee_id = $1 AND company_id = $2 AND check_in::date = $3::date',
    [employeeId, companyId, dateStr]
  );

  let attendanceId;
  let statusRecord;

  if (existingAtt.rows.length > 0) {
    attendanceId = existingAtt.rows[0].id;
    statusRecord = existingAtt.rows[0];
    
    // Check if there's already an open session
    const openSession = await query(
      'SELECT id FROM attendance_sessions WHERE attendance_id = $1 AND check_out IS NULL',
      [attendanceId]
    );
    if (openSession.rows.length > 0) {
      throw new Error('You are already checked in. Please check out first.');
    }
  } else {
    // First check-in of the day
    const { status } = calculateAttendance(shift, checkInTime, null);
    const result = await query(
      `INSERT INTO attendance (company_id, employee_id, check_in, status, location_metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, employeeId, checkInTime, status, JSON.stringify(location || {})]
    );
    attendanceId = result.rows[0].id;
    statusRecord = result.rows[0];
  }

  // 4. Create new activity session
  await query(
    `INSERT INTO attendance_sessions (attendance_id, company_id, employee_id, check_in)
     VALUES ($1, $2, $3, $4)`,
    [attendanceId, companyId, employeeId, checkInTime]
  );

  const { expectedCheckoutTime, lateMinutes } = calculateAttendance(shift, new Date(statusRecord.check_in), null);

  return {
    ...statusRecord,
    expected_checkout_time: expectedCheckoutTime,
    late_minutes: lateMinutes
  };
};

/**
 * Process check-out
 */
const checkOut = async (attendanceId, companyId, manualCheckOutTime) => {
  const checkOutTime = manualCheckOutTime ? new Date(manualCheckOutTime) : new Date();
  
  // 1. Fetch record and shift
  const attResult = await query(
    'SELECT a.*, s.shift_start_time, s.shift_end_time, s.total_working_hours, s.grace_minutes, s.late_start_time, s.late_end_time, s.overlate_start_time, s.halfday_start_time FROM attendance a JOIN employees e ON a.employee_id = e.id JOIN employee_shifts es ON e.id = es.employee_id JOIN shifts s ON es.shift_id = s.id WHERE a.id = $1 AND a.company_id = $2',
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

  // 2. Find and close the active session
  const openSession = await query(
    'SELECT * FROM attendance_sessions WHERE attendance_id = $1 AND check_out IS NULL ORDER BY check_in DESC LIMIT 1',
    [attendanceId]
  );
  if (openSession.rows.length === 0) {
    throw new Error('No active check-in session found.');
  }

  const session = openSession.rows[0];
  const durationMinutes = Math.floor((checkOutTime - new Date(session.check_in)) / 60000);

  await query(
    'UPDATE attendance_sessions SET check_out = $1, duration_minutes = $2 WHERE id = $3',
    [checkOutTime, durationMinutes, session.id]
  );

  // 3. Calculate total working hours from all sessions
  const totals = await query(
    'SELECT SUM(duration_minutes) as total_mins FROM attendance_sessions WHERE attendance_id = $1',
    [attendanceId]
  );
  const totalMins = parseInt(totals.rows[0].total_mins) || 0;
  const workingHours = parseFloat((totalMins / 60).toFixed(2));

  // 4. Calculate status based on First-In and Cumulative hours
  const { status, overtimeHours, lateMinutes, shortfallMinutes, breakTime, activeTime, idleTime, expectedCheckoutTime } = calculateAttendance(shift, new Date(record.check_in), checkOutTime);
  
  // Use sequential working hours status override if needed
  let finalStatus = status;
  const minWorkingHoursForFullDay = (shift.total_working_hours || 9) / 2;
  if (workingHours > 0 && workingHours < minWorkingHoursForFullDay) {
    finalStatus = 'HALF_DAY';
  }

  const result = await query(
    `UPDATE attendance 
     SET check_out = $1, working_hours = $2, overtime_hours = $3, status = $4
     WHERE id = $5 AND company_id = $6 RETURNING *`,
    [checkOutTime, workingHours, overtimeHours, finalStatus, attendanceId, companyId]
  );

  return {
    ...result.rows[0],
    working_hours: workingHours,
    final_status: finalStatus,
    expected_checkout_time: expectedCheckoutTime,
    late_minutes: lateMinutes,
    shortfall_minutes: shortfallMinutes,
    break_time: breakTime,
    active_time: activeTime,
    idle_time: idleTime
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
  const attendance = await query(
    `SELECT * FROM attendance 
     WHERE company_id = $1 AND check_in::date = $2::date`, 
    [companyId, dateStr]
  );
  
  // Get all sessions for the day
  const sessions = await query(
    `SELECT * FROM attendance_sessions 
     WHERE company_id = $1 AND check_in::date = $2::date`,
    [companyId, dateStr]
  );
  
  const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
  const shift = shifts.rows[0];

  const records = employees.rows.map((emp) => {
    const existing = attendance.rows.find(a => a.employee_id === emp.id);
    const empSessions = sessions.rows.filter(s => s.employee_id === emp.id);
    const isCheckedIn = empSessions.some(s => s.check_out === null);

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
        is_checked_in: isCheckedIn,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown',
        role: emp.role,
        ...metrics,
        expectedCheckout: metrics.expectedCheckoutTime,
        workHours: metrics.workingHours > 0 ? `${Math.floor(metrics.workingHours)}h ${Math.floor((metrics.workingHours % 1) * 60)}m` : (isCheckedIn ? 'In Progress' : '0h 00m')
      };
    }

    // No record found: Return a clean "Absent/Not Checked In" state without simulation
    return { 
      id: `no-ref-${emp.id}`, 
      employee_id: emp.id, 
      email: emp.email,
      is_checked_in: false,
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
