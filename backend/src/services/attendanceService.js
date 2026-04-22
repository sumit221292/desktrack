const { query } = require('../config/db');

/**
 * Attendance Service
 * Handles shift logic and attendance calculations
 */

/**
 * Calculate attendance status based on shift, events (named breaks), and sessions (other breaks)
 */
// Get UTC offset string for an IANA timezone (e.g. "Asia/Kolkata" → "+05:30")
const TZ_OFFSETS = {
  'Asia/Kolkata': '+05:30', 'Asia/Dubai': '+04:00', 'Asia/Singapore': '+08:00',
  'Asia/Tokyo': '+09:00', 'Asia/Shanghai': '+08:00', 'Asia/Karachi': '+05:00',
  'Asia/Dhaka': '+06:00', 'Europe/London': '+00:00', 'Europe/Berlin': '+01:00',
  'America/New_York': '-05:00', 'America/Chicago': '-06:00', 'America/Los_Angeles': '-08:00',
  'Australia/Sydney': '+10:00', 'Pacific/Auckland': '+12:00'
};
const getTzOffset = (tz) => TZ_OFFSETS[tz] || '+05:30';

// Fetch company timezone from settings DB
const getCompanyTimezone = async (companyId) => {
  try {
    const result = await query(
      'SELECT setting_value FROM company_settings WHERE company_id = $1 AND setting_key = $2',
      [companyId, 'companyTimezone']
    );
    if (result.rows.length > 0) {
      try { return JSON.parse(result.rows[0].setting_value); } catch { return result.rows[0].setting_value; }
    }
  } catch (e) {}
  return 'Asia/Kolkata';
};

const getBreakConfig = async (companyId) => {
  try {
    const result = await query(
      'SELECT setting_value FROM company_settings WHERE company_id = $1 AND setting_key = $2',
      [companyId, 'breakConfig']
    );
    if (result.rows.length > 0) {
      try { return JSON.parse(result.rows[0].setting_value); } catch { return {}; }
    }
  } catch (e) {}
  return { lunch_allowed_minutes: 45, tea_allowed_minutes: 15, max_break_minutes: 70 };
};

/**
 * Auto-close missed checkouts from previous days.
 *
 * Rules:
 * - Auto-close time: 23:59:59 IST (end of that calendar day)
 * - Orphan sessions (never checked out by user): 0 work credit
 * - Only properly checked-out sessions count toward work time
 * - Status: ABSENT if < half shift, HALF DAY if >= half shift
 * - Flag: MISSED_CHECKOUT
 */
const closeMissedCheckouts = async (companyId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
    const defaultShift = shifts.rows[0] || { shift_end_time: '19:00:00', total_working_hours: 9 };
    const maxShiftMins = (parseFloat(defaultShift.total_working_hours) || 9) * 60;
    const tzOffset = getTzOffset(await getCompanyTimezone(companyId));

    // 1. Close ALL open sessions from before today
    const allSessions = await query('SELECT * FROM attendance_sessions WHERE company_id = $1', [companyId]);
    for (const sess of allSessions.rows) {
      if (sess.check_out) {
        // Cap existing sessions to max shift hours
        const dur = parseInt(sess.duration_minutes) || 0;
        if (dur > maxShiftMins) {
          await query('UPDATE attendance_sessions SET duration_minutes = $1 WHERE id = $2', [maxShiftMins, sess.id]);
        }
        continue;
      }
      const sessDate = String(sess.check_in).split('T')[0];
      if (sessDate >= today) continue; // today's session, leave open

      // Orphan session: close at 23:59:59 IST with 0 duration (no work credit)
      const closeTime = new Date(`${sessDate}T23:59:59${tzOffset}`);
      await query('UPDATE attendance_sessions SET check_out = $1, duration_minutes = 0 WHERE id = $2',
        [closeTime, sess.id]);
      console.log(`[AutoClose] Orphan session ${sess.id} from ${sessDate} — closed with 0 credit (missed checkout)`);
    }

    // 2. Close attendance records from before today that have no checkout
    const allAtt = await query('SELECT * FROM attendance WHERE company_id = $1', [companyId]);
    for (const rec of allAtt.rows) {
      if (rec.check_out) continue;
      const attDate = String(rec.attendance_date || rec.check_in || '').split('T')[0];
      if (!attDate || attDate >= today) continue;

      // Close at 23:59:59 IST of that day
      const checkOutTime = new Date(`${attDate}T23:59:59${tzOffset}`);

      // Only count sessions that were PROPERLY checked out by the user (not auto-closed orphans)
      const sessions = await query('SELECT * FROM attendance_sessions WHERE attendance_id = $1', [rec.id]);
      let workedMins = 0;
      for (const s of sessions.rows) {
        const dur = parseInt(s.duration_minutes) || 0;
        // Only count sessions with actual duration (orphans have 0)
        if (dur > 0) workedMins += Math.min(maxShiftMins, dur);
      }

      const halfShift = maxShiftMins / 2;
      let status, statusLabel;
      if (workedMins === 0) {
        status = 'ABSENT';
        statusLabel = 'ABSENT';
      } else if (workedMins < halfShift) {
        status = 'ABSENT';
        statusLabel = 'ABSENT';
      } else {
        status = 'INCOMPLETE';
        statusLabel = 'HALFDAY';
      }

      await query(
        `UPDATE attendance SET check_out = $1, last_check_out = $1, status = $2,
         net_work_minutes = $3, gross_minutes = $3, flags = $4, ai_summary = $5
         WHERE id = $6 AND company_id = $7`,
        [checkOutTime, status, workedMins,
         JSON.stringify(['MISSED_CHECKOUT', statusLabel]),
         `Checkout missed. Auto-closed at 23:59 IST. Worked: ${workedMins}min. Status: ${statusLabel}.`,
         rec.id, companyId]
      );
      console.log(`[AutoClose] Attendance ${rec.id} on ${attDate} — ${statusLabel}, worked=${workedMins}min`);
    }
  } catch (e) {
    console.error('[AutoClose] Error:', e.message);
  }
};

const calculateAttendance = (shift, checkIn, checkOut, events = [], sessions = []) => {
  if (!checkIn) return { status: 'MISSING_ENTRY', flags: ['NO_CHECK_IN'] };

  const firstCheckIn = new Date(checkIn);
  const lastCheckOut = checkOut ? new Date(checkOut) : null;
  const dateStr = firstCheckIn.toISOString().split('T')[0];
  const tzOffset = getTzOffset(shift.timezone || 'Asia/Kolkata');

  const getShiftDate = (timeString) => {
    if (!timeString) return null;
    const [h, m] = timeString.split(':').map(Number);
    return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00${tzOffset}`);
  };

  const shiftStart = getShiftDate(shift.shift_start_time);
  const graceMinutes = shift.grace_minutes || 0;
  const graceEnd = shiftStart ? new Date(shiftStart.getTime() + (graceMinutes * 60000)) : null;
  const lateStart = shift.late_start_time ? getShiftDate(shift.late_start_time) : (graceEnd || null);
  const lateEnd = shift.late_end_time ? getShiftDate(shift.late_end_time) : null;
  const overlateStart = shift.overlate_start_time ? getShiftDate(shift.overlate_start_time) : null;
  const halfdayStart = shift.halfday_start_time ? getShiftDate(shift.halfday_start_time) : null;

  // 1. ARRIVAL STATUS
  let arrivalStatus = 'on_time';
  if (halfdayStart && firstCheckIn >= halfdayStart) {
    arrivalStatus = 'halfday';
  } else if (overlateStart && firstCheckIn >= overlateStart) {
    arrivalStatus = 'overlate';
  } else if (lateStart && firstCheckIn >= lateStart) {
    if (!lateEnd || firstCheckIn <= lateEnd) {
      arrivalStatus = 'late';
    } else {
      arrivalStatus = 'late'; // Threshold gap defaults to late
    }
  } else if (graceEnd && firstCheckIn <= graceEnd) {
    arrivalStatus = 'on_time';
  }

  // 2. NAMED BREAKS
  const namedBreakResults = {};
  let totalNamedBreakMinutes = 0;
  const flags = [];

  // Identify all break types from events
  const breakTypes = [...new Set(events.filter(e => e.event_type.endsWith('_START')).map(e => e.event_type.replace('_START', '').toLowerCase()))];
  
  // Default types if present in shift but not events
  if (shift.lunch_allowed_minutes !== undefined && !breakTypes.includes('lunch')) breakTypes.push('lunch');
  if (shift.tea_allowed_minutes !== undefined && !breakTypes.includes('tea')) breakTypes.push('tea');

  const windows = [];

  breakTypes.forEach(type => {
    const typeUpper = type.toUpperCase();
    const startEvents = events.filter(e => e.event_type === `${typeUpper}_START`).sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
    const endEvents = events.filter(e => e.event_type === `${typeUpper}_END`).sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
    const allowedMins = shift[`${type}_allowed_minutes`];

    let status = 'NOT_TAKEN';
    let actualMins = 0;
    let excessMins = 0;
    let startTime = null;
    let endTime = null;

    if (allowedMins === undefined) {
      status = 'NOT_CONFIGURED';
    } else if (startEvents.length === 0) {
      status = 'NOT_TAKEN';
    } else {
      // Pair up start/end events and sum all break durations
      startTime = new Date(startEvents[0].event_time);
      for (let i = 0; i < startEvents.length; i++) {
        const sTime = new Date(startEvents[i].event_time);
        const eEvent = endEvents[i];
        if (eEvent) {
          const eTime = new Date(eEvent.event_time);
          actualMins += Math.max(1, Math.ceil((eTime - sTime) / 60000));
          endTime = eTime;
          windows.push({ start: sTime, end: eTime, type });
        } else {
          // Last start has no end — break is still active
          status = 'INCOMPLETE';
          actualMins += Math.ceil((new Date() - sTime) / 60000);
        }
      }
      if (status !== 'INCOMPLETE') {
        excessMins = Math.max(0, actualMins - allowedMins);
        status = actualMins <= allowedMins ? 'ON_TIME' : 'EXTENDED';
      }
    }

    // For active break: find the latest unmatched START (the one without END pair)
    let activeStartTime = null;
    let completedMins = 0;
    if (startEvents.length > endEvents.length) {
      // Last start has no end — that's the active one
      activeStartTime = new Date(startEvents[startEvents.length - 1].event_time);
      // Completed = all paired breaks (exclude active session)
      for (let i = 0; i < endEvents.length; i++) {
        completedMins += Math.max(1, Math.ceil((new Date(endEvents[i].event_time) - new Date(startEvents[i].event_time)) / 60000));
      }
    } else {
      completedMins = actualMins;
    }

    namedBreakResults[`${type}_start`] = startTime ? startTime.toISOString() : '';
    namedBreakResults[`${type}_end`] = endTime ? endTime.toISOString() : '';
    namedBreakResults[`${type}_active_start`] = activeStartTime ? activeStartTime.toISOString() : '';
    namedBreakResults[`${type}_completed_minutes`] = completedMins;
    namedBreakResults[`${type}_actual_minutes`] = actualMins;
    namedBreakResults[`${type}_excess_minutes`] = excessMins;
    namedBreakResults[`${type}_status`] = status;

    if (status !== 'NOT_CONFIGURED' && status !== 'NOT_TAKEN') {
      totalNamedBreakMinutes += actualMins;
      if (status === 'EXTENDED') flags.push(`${type.toUpperCase()}_EXTENDED`);
      if (status === 'INCOMPLETE') flags.push(`${type.toUpperCase()}_INCOMPLETE`);
    } else if (status === 'NOT_TAKEN' && allowedMins !== undefined) {
      flags.push(`${type.toUpperCase()}_NOT_TAKEN`);
    }
  });

  // Overlap Detection
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      if (windows[i].start < windows[j].end && windows[i].end > windows[j].start) {
        flags.push(`${windows[i].type.toUpperCase()}_${windows[j].type.toUpperCase()}_OVERLAP`);
      }
    }
  }

  // 3. OTHER BREAKS (Intermediate checkout/checkin pairs)
  // These are often already in attendance_sessions, but let's calculate based on gaps if lastCheckOut exists
  let otherBreakMinutes = 0;
  const breakRecords = [];
  
  if (sessions.length > 1) {
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
    for (let i = 0; i < sortedSessions.length - 1; i++) {
      const prevOut = sortedSessions[i].check_out;
      const nextIn = sortedSessions[i+1].check_in;
      if (!prevOut || !nextIn) continue;

      const breakStart = new Date(prevOut);
      const breakEnd = new Date(nextIn);

      if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) continue;

      const diff = Math.floor((breakEnd - breakStart) / 60000);
      // Skip negative or unreasonable breaks (> 12 hours = probably bad data)
      if (diff <= 0 || diff > 720) continue;

      // Check if this gap overlaps any named break
      const overlapsNamed = windows.some(w => breakStart < w.end && breakEnd > w.start);
      if (!overlapsNamed) {
        otherBreakMinutes += diff;
        breakRecords.push({
          break_type: 'OTHER',
          break_start: breakStart.toISOString(),
          break_end: breakEnd.toISOString(),
          break_minutes: diff,
          break_sequence: breakRecords.length + 1
        });
        if (diff > 90) flags.push('EXCESSIVE_BREAK');
      }
    }
    if (breakRecords.length > 3) flags.push('MULTIPLE_BREAKS');
  }

  // 4. WORK TIME (use Math.ceil to count partial minutes, minimum 1 min if any work done)
  const totalBreakMinutes = totalNamedBreakMinutes + otherBreakMinutes;
  let grossMinutes = 0;
  if (lastCheckOut) {
    grossMinutes = Math.ceil((lastCheckOut - firstCheckIn) / 60000);
  }
  // Fallback: compute from sessions if gross is 0 but sessions exist
  // IMPORTANT: duration_minutes = 0 means orphan session (no checkout by user) — skip it
  if (grossMinutes <= 0 && sessions.length > 0) {
    grossMinutes = sessions.reduce((sum, s) => {
      const dur = parseInt(s.duration_minutes) || 0;
      if (dur > 0) return sum + dur; // Only count sessions with real duration
      if (s.check_in && s.check_out && dur === 0) return sum; // Orphan session — no credit
      if (s.check_in && s.check_out) {
        return sum + Math.max(1, Math.ceil((new Date(s.check_out) - new Date(s.check_in)) / 60000));
      }
      return sum;
    }, 0);
  }

  const netWorkMinutes = grossMinutes - totalBreakMinutes;
  const shiftDurationMins = (shift.total_working_hours || 0) * 60;
  const overtimeMinutes = Math.max(0, netWorkMinutes - shiftDurationMins);

  // 5. RECORD STATUS
  let status = 'ABSENT';
  if (firstCheckIn && lastCheckOut) {
    status = 'COMPLETE';
  } else if (firstCheckIn) {
    status = 'INCOMPLETE';
  } else {
    status = 'MISSING_ENTRY';
  }

  // 6. FINAL FLAGS
  if (arrivalStatus === 'late') flags.push('LATE_ARRIVAL');
  if (arrivalStatus === 'overlate') flags.push('OVERLATE_ARRIVAL');
  if (arrivalStatus === 'halfday') flags.push('HALFDAY');
  if (overtimeMinutes > 0) flags.push('OVERTIME');
  if (netWorkMinutes > 0 && netWorkMinutes < 240) flags.push('SHORT_DAY');
  if (netWorkMinutes > 720) flags.push('LONG_DAY');
  if (netWorkMinutes < 0) flags.push('NEGATIVE_WORK_HOURS');

  // AI Summary
  let ai_summary = `Employee arrived ${arrivalStatus.replace('_', ' ')} and completed ${netWorkMinutes} net work minutes.`;
  if (flags.length > 0) {
    ai_summary += ` Key flags: ${flags.slice(0, 3).join(', ')}.`;
  }

  return {
    daily_attendance: {
      company_id: shift.company_id,
      employee_id: shift.employee_id || 0,
      attendance_date: dateStr,
      first_check_in: firstCheckIn.toISOString(),
      last_check_out: lastCheckOut ? lastCheckOut.toISOString() : '',
      arrival_status: arrivalStatus,
      ...namedBreakResults,
      other_break_minutes: otherBreakMinutes,
      total_break_minutes: totalBreakMinutes,
      gross_minutes: grossMinutes,
      net_work_minutes: netWorkMinutes,
      overtime_minutes: overtimeMinutes,
      status,
      flags: [...new Set(flags)],
      ai_summary
    },
    break_records: breakRecords.map(r => ({
      ...r,
      company_id: shift.company_id,
      employee_id: shift.employee_id || 0,
      attendance_date: dateStr
    }))
  };
};

/**
 * Process check-in
 */
const checkIn = async (userIdOrEmployeeId, companyId, location, manualCheckInTime) => {
  console.log(`[CheckIn] Starting for userIdOrEmployeeId: ${userIdOrEmployeeId}, companyId: ${companyId}`);
  
  // 1. Resolve actual Employee ID if a User ID was provided
  let employeeId = userIdOrEmployeeId;
  const userResult = await query('SELECT email FROM users WHERE id = $1', [userIdOrEmployeeId]);
  console.log(`[CheckIn] User lookup for ID ${userIdOrEmployeeId}: Found ${userResult.rows.length} rows`);

  if (userResult.rows.length > 0) {
    const userEmail = userResult.rows[0].email;
    console.log(`[CheckIn] User email resolved: ${userEmail}`);
    const empResult = await query('SELECT id FROM employees WHERE email = $1 AND company_id = $2', [userEmail, companyId]);
    console.log(`[CheckIn] Employee lookup for email ${userEmail}: Found ${empResult.rows.length} rows`);
    if (empResult.rows.length > 0) {
      employeeId = empResult.rows[0].id;
      console.log(`[CheckIn] Final employeeId: ${employeeId}`);
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

  const shift = { ...shiftResult.rows[0], company_id: companyId, employee_id: employeeId };
  if (!shift.id) throw new Error('No assigned shift found.');

  // Fetch company timezone
  const tz = await getCompanyTimezone(companyId);
  shift.timezone = tz;

  const checkInTime = manualCheckInTime ? new Date(manualCheckInTime) : new Date();
  const dateStr = checkInTime.toISOString().split('T')[0];

  // 3. Check for existing daily attendance record
  const existingAtt = await query(
    'SELECT * FROM attendance WHERE employee_id = $1 AND company_id = $2 AND check_in::date = $3::date',
    [employeeId, companyId, dateStr]
  );

  let attendanceId;
  let statusRecord;

  // Auto-close any orphaned open sessions for this employee (from any day)
  const orphanSessions = await query(
    'SELECT id, check_in FROM attendance_sessions WHERE employee_id = $1 AND company_id = $2 AND check_out IS NULL',
    [employeeId, companyId]
  );
  if (orphanSessions.rows.length > 0) {
    console.log(`[CheckIn] Closing ${orphanSessions.rows.length} orphaned sessions for employee ${employeeId}`);
    for (const sess of orphanSessions.rows) {
      const dur = Math.max(1, Math.ceil((new Date() - new Date(sess.check_in)) / 60000));
      await query('UPDATE attendance_sessions SET check_out = NOW(), duration_minutes = $1 WHERE id = $2', [dur, sess.id]);
    }
  }

  if (existingAtt.rows.length > 0) {
    attendanceId = existingAtt.rows[0].id;
    statusRecord = existingAtt.rows[0];

    // If already checked out today and no open sessions, this is a re-check-in (multiple sessions per day)
  } else {
    // First check-in of the day
    const { daily_attendance } = calculateAttendance(shift, checkInTime, null);
    
    const result = await query(
      `INSERT INTO attendance (
        company_id, employee_id, attendance_date, check_in, arrival_status, 
        total_break_minutes, gross_minutes, net_work_minutes, overtime_minutes, 
        status, flags, ai_summary, location_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        companyId, 
        employeeId, 
        daily_attendance.attendance_date, 
        daily_attendance.first_check_in,
        daily_attendance.arrival_status, 
        daily_attendance.total_break_minutes,
        daily_attendance.gross_minutes, 
        daily_attendance.net_work_minutes,
        daily_attendance.overtime_minutes, 
        daily_attendance.status,
        JSON.stringify(daily_attendance.flags), 
        daily_attendance.ai_summary,
        JSON.stringify({ ...(location || {}), original_check_in: checkInTime })
      ]
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

  return {
    ...statusRecord,
    employee_id: employeeId
  };
};

/**
 * Process check-out
 */
const checkOut = async (attendanceId, companyId, manualCheckOutTime) => {
  const checkOutTime = manualCheckOutTime ? new Date(manualCheckOutTime) : new Date();
  
  // 1. Fetch record and shift
  const attResult = await query(
    `SELECT a.*, s.shift_start_time, s.shift_end_time, s.total_working_hours, 
            s.grace_minutes, s.late_start_time, s.late_end_time, 
            s.overlate_start_time, s.halfday_start_time,
            s.lunch_allowed_minutes, s.tea_allowed_minutes
     FROM attendance a 
     JOIN employees e ON a.employee_id = e.id 
     JOIN employee_shifts es ON e.id = es.employee_id 
     JOIN shifts s ON es.shift_id = s.id 
     WHERE a.id = $1 AND a.company_id = $2`,
    [attendanceId, companyId]
  );

  const record = attResult.rows[0];
  if (!record) throw new Error('Attendance record not found.');

  const brkCfg = await getBreakConfig(companyId);
  const shift = {
    shift_start_time: record.shift_start_time,
    shift_end_time: record.shift_end_time,
    total_working_hours: record.total_working_hours,
    grace_minutes: record.grace_minutes,
    late_start_time: record.late_start_time,
    late_end_time: record.late_end_time,
    overlate_start_time: record.overlate_start_time,
    halfday_start_time: record.halfday_start_time,
    lunch_allowed_minutes: brkCfg.lunch_allowed_minutes || 45,
    tea_allowed_minutes: brkCfg.tea_allowed_minutes || 15,
    company_id: record.company_id,
    employee_id: record.employee_id,
    timezone: await getCompanyTimezone(companyId)
  };

  // 1.1 Fetch all sessions and events for the day
  const sessionsResult = await query(
    'SELECT * FROM attendance_sessions WHERE attendance_id = $1 ORDER BY check_in ASC',
    [attendanceId]
  );
  const eventsResult = await query(
    'SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY event_time ASC',
    [attendanceId]
  );

  // 2. Find and close ALL open sessions for this employee today
  //    (includes orphaned sessions from other attendance records)
  const openSessions = await query(
    `SELECT * FROM attendance_sessions
     WHERE employee_id = $1 AND company_id = $2 AND check_out IS NULL
     ORDER BY check_in DESC`,
    [record.employee_id, companyId]
  );
  if (openSessions.rows.length === 0) {
    return { ...record, message: 'Already checked out' };
  }

  // Close every open session
  for (const session of openSessions.rows) {
    const durationMinutes = Math.max(1, Math.ceil((checkOutTime - new Date(session.check_in)) / 60000));
    await query(
      'UPDATE attendance_sessions SET check_out = $1, duration_minutes = $2 WHERE id = $3',
      [checkOutTime, durationMinutes, session.id]
    );
  }

  // 3. Calculate total working hours and other metrics using core engine
  const sessions = sessionsResult.rows;
  const events = eventsResult.rows;

  const { daily_attendance } = calculateAttendance(shift, record.check_in, checkOutTime, events, sessions);
  const { net_work_minutes, overtime_minutes, status, flags } = daily_attendance;
  const workingHours = parseFloat((net_work_minutes / 60).toFixed(2));
  const overtimeHours = parseFloat((overtime_minutes / 60).toFixed(2));

  const result = await query(
    `UPDATE attendance SET
      check_out = $1, last_check_out = $1, gross_minutes = $2, total_break_minutes = $3,
      net_work_minutes = $4, overtime_minutes = $5, status = $6,
      flags = $7, ai_summary = $8, other_break_minutes = $9,
      location_metadata = $10
     WHERE id = $11 AND company_id = $12 RETURNING *`,
    [
      daily_attendance.last_check_out,
      daily_attendance.gross_minutes,
      daily_attendance.total_break_minutes,
      daily_attendance.net_work_minutes,
      daily_attendance.overtime_minutes,
      daily_attendance.status,
      JSON.stringify(daily_attendance.flags),
      daily_attendance.ai_summary,
      daily_attendance.other_break_minutes,
      JSON.stringify(daily_attendance.location_metadata),
      attendanceId,
      companyId
    ]
  );

  return {
    ...result.rows[0],
    ...daily_attendance
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
  const updBrkCfg = await getBreakConfig(companyId);
  const shift = { ...shiftResult.rows[0], company_id: companyId, employee_id: employeeId, timezone: await getCompanyTimezone(companyId), lunch_allowed_minutes: updBrkCfg.lunch_allowed_minutes || 45, tea_allowed_minutes: updBrkCfg.tea_allowed_minutes || 15 };

  const checkInTime = updates.check_in ? new Date(updates.check_in) : (record ? new Date(record.check_in) : new Date());
  const checkOutTime = updates.check_out ? new Date(updates.check_out) : (record?.check_out ? new Date(record.check_out) : null);
  
  // Fetch sessions and events for the record
  const sessionsResult = await query(
    'SELECT * FROM attendance_sessions WHERE attendance_id = $1 ORDER BY check_in ASC',
    [attendanceId]
  );
  const eventsResult = await query(
    'SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY event_time ASC',
    [attendanceId]
  );

  const { daily_attendance } = calculateAttendance(shift, checkInTime, checkOutTime, eventsResult.rows, sessionsResult.rows);
  const { net_work_minutes, overtime_minutes, status, flags } = daily_attendance;
  const workingHours = parseFloat((net_work_minutes / 60).toFixed(2));
  const overtimeHours = parseFloat((overtime_minutes / 60).toFixed(2));

  let result;
  if (String(attendanceId).startsWith('dummy-') || String(attendanceId).startsWith('no-ref-')) {
    result = await query(
      `INSERT INTO attendance (company_id, employee_id, attendance_date, check_in, check_out, last_check_out,
        arrival_status, gross_minutes, total_break_minutes, net_work_minutes, other_break_minutes,
        overtime_minutes, working_hours, overtime_hours, status, flags, ai_summary, remarks, location_metadata)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        companyId, employeeId, daily_attendance.attendance_date,
        checkInTime, checkOutTime,
        daily_attendance.arrival_status,
        daily_attendance.gross_minutes, daily_attendance.total_break_minutes,
        daily_attendance.net_work_minutes, daily_attendance.other_break_minutes,
        daily_attendance.overtime_minutes, workingHours, overtimeHours,
        status, JSON.stringify(flags), daily_attendance.ai_summary,
        updates.remarks, JSON.stringify(daily_attendance.location_metadata)
      ]
    );
  } else {
    result = await query(
      `UPDATE attendance SET
        check_in = $1, check_out = $2, last_check_out = $2,
        gross_minutes = $3, total_break_minutes = $4,
        net_work_minutes = $5, overtime_minutes = $6, status = $7,
        flags = $8, ai_summary = $9, other_break_minutes = $10,
        location_metadata = $11, remarks = $12
       WHERE id = $13 AND company_id = $14 RETURNING *`,
      [
        checkInTime, checkOutTime,
        daily_attendance.gross_minutes,
        daily_attendance.total_break_minutes,
        daily_attendance.net_work_minutes,
        daily_attendance.overtime_minutes,
        daily_attendance.status,
        JSON.stringify(daily_attendance.flags),
        daily_attendance.ai_summary,
        daily_attendance.other_break_minutes,
        JSON.stringify(daily_attendance.location_metadata),
        updates.remarks || record?.remarks || null,
        attendanceId,
        companyId
      ]
    );
  }

  return {
    ...result.rows[0],
    ...daily_attendance
  };
};

/**
 * Log an attendance event (e.g., LUNCH_START, TEA_END)
 */
const logEvent = async (userIdOrEmployeeId, companyId, eventType, eventTime) => {
  // Resolve Employee ID
  let employeeId = userIdOrEmployeeId;
  const userResult = await query('SELECT email FROM users WHERE id = $1', [userIdOrEmployeeId]);
  if (userResult.rows.length > 0) {
    const userEmail = userResult.rows[0].email;
    const empResult = await query('SELECT id FROM employees WHERE email = $1 AND company_id = $2', [userEmail, companyId]);
    if (empResult.rows.length > 0) {
      employeeId = empResult.rows[0].id;
    }
  }

  const time = eventTime ? new Date(eventTime) : new Date();
  const dateStr = time.toISOString().split('T')[0];

  // Find today's attendance record
  const attResult = await query(
    'SELECT id FROM attendance WHERE employee_id = $1 AND company_id = $2 AND check_in::date = $3::date',
    [employeeId, companyId, dateStr]
  );

  if (attResult.rows.length === 0) {
    throw new Error('Attendance not started yet. Please check in first.');
  }

  const attendanceId = attResult.rows[0].id;

  // Log Event
  const result = await query(
    `INSERT INTO attendance_events (company_id, employee_id, attendance_id, event_type, event_time)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, employeeId, attendanceId, eventType.toUpperCase(), time]
  );

  return result.rows[0];
};

/**
 * Get daily attendance for all employees
 */
const getDailyAttendance = async (companyId, dateStr) => {
  // Auto-close missed checkouts from previous days
  await closeMissedCheckouts(companyId);

  const employees = await query('SELECT * FROM employees WHERE company_id = $1', [companyId]);
  
  // Get attendance for the specific date
  const attendance = await query(
    `SELECT * FROM attendance 
     WHERE company_id = $1 AND check_in::date = $2::date`, 
    [companyId, dateStr]
  );
  
  // Get all events for the day
  const events = await query(
    `SELECT * FROM attendance_events 
     WHERE company_id = $1 AND event_time::date = $2::date`,
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

  const companyTz = await getCompanyTimezone(companyId);
  const brkCfg = await getBreakConfig(companyId);

  const records = employees.rows.map((emp) => {
    const existing = attendance.rows.find(a => a.employee_id == emp.id);
    const empSessions = sessions.rows.filter(s => s.employee_id == emp.id);
    const isCheckedIn = empSessions.some(s => s.check_out === null || s.check_out === undefined);

    if (existing) {
      const checkIn = new Date(existing.check_in);
      const lastOut = existing.last_check_out || existing.check_out;
      const checkOut = lastOut ? new Date(lastOut) : null;

      const empSessions = sessions.rows.filter(s => s.employee_id == emp.id);
      const empEvents = events.rows.filter(e => e.employee_id == emp.id);
      const { daily_attendance } = calculateAttendance({ ...shift, employee_id: emp.id, timezone: companyTz, lunch_allowed_minutes: brkCfg.lunch_allowed_minutes || 45, tea_allowed_minutes: brkCfg.tea_allowed_minutes || 15 }, checkIn, checkOut, empEvents, empSessions);

      // Expected checkout = check-in + shift hours + excess breaks
      // Excess = (lunch over limit) + (tea over limit) + all other breaks (unplanned gaps)
      const shiftHrs = parseFloat(shift?.total_working_hours || 9);
      const breakMins = daily_attendance.total_break_minutes || 0;
      const lunchExcess = Math.max(0, (daily_attendance.lunch_actual_minutes || 0) - (brkCfg.lunch_allowed_minutes || 45));
      const teaExcess = Math.max(0, (daily_attendance.tea_actual_minutes || 0) - (brkCfg.tea_allowed_minutes || 15));
      const otherBreakMins = daily_attendance.other_break_minutes || 0;
      const excessBreakMins = lunchExcess + teaExcess + otherBreakMins;
      const expectedOutISO = new Date(checkIn.getTime() + ((shiftHrs * 60) + excessBreakMins) * 60 * 1000);

      // Late minutes: diff between check_in and shift_start_time (IST)
      let lateMinutes = 0;
      if (shift?.shift_start_time) {
        const [sh, sm] = shift.shift_start_time.split(':').map(Number);
        const dateOnly = checkIn.toISOString().split('T')[0];
        const shiftStartISO = new Date(`${dateOnly}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00${getTzOffset(companyTz)}`);
        if (checkIn > shiftStartISO) {
          lateMinutes = Math.floor((checkIn - shiftStartISO) / 60000);
        }
      }

      // Display status based on arrival
      const arrStatus = daily_attendance.arrival_status || 'on_time';
      let displayStatus = 'ON TIME';
      if (arrStatus === 'late') displayStatus = 'LATE';
      else if (arrStatus === 'overlate') displayStatus = 'OVER LATE';
      else if (arrStatus === 'halfday') displayStatus = 'HALF DAY';

      // Missed checkout override: check flags or if no checkout and past expected out
      const shiftMins = shiftHrs * 60;
      const existingFlags = existing.flags ? (typeof existing.flags === 'string' ? JSON.parse(existing.flags) : existing.flags) : [];
      const missedCheckout = existingFlags.includes('MISSED_CHECKOUT') || (!checkOut && new Date() > expectedOutISO);
      if (missedCheckout) {
        const workedMins = daily_attendance.net_work_minutes || 0;
        if (workedMins >= shiftMins / 2) displayStatus = 'HALF DAY';
        else displayStatus = 'ABSENT';
      } else if (checkOut && !isCheckedIn) {
        // Checked out — enforce completion-based status
        const workedMins = daily_attendance.net_work_minutes || 0;
        if (workedMins < shiftMins / 2) displayStatus = 'ABSENT';
        else if (workedMins < shiftMins) displayStatus = 'HALF DAY';
        // else keep arrival-based status (ON TIME / LATE / OVER LATE)
      }

      // Shortfall
      const shortfallMinutes = daily_attendance.net_work_minutes < shiftMins ? Math.floor(shiftMins - daily_attendance.net_work_minutes) : 0;

      // Active / Break / Idle times
      const netMins = daily_attendance.net_work_minutes || 0;
      const grossMins = daily_attendance.gross_minutes || 0;
      const idleMins = Math.max(0, grossMins - netMins - breakMins);

      const fmtTime = (m) => `${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`;

      return {
        ...existing,
        ...daily_attendance,
        check_out: lastOut || null,
        employee_id: emp.id,
        email: emp.email,
        is_checked_in: isCheckedIn,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown',
        role: emp.role,
        workHours: netMins > 0 ? fmtTime(netMins) : (isCheckedIn ? 'In Progress' : '0h 00m'),
        missedCheckout,
        expectedCheckout: expectedOutISO ? expectedOutISO.toISOString() : '-',
        lateMinutes,
        displayStatus,
        shortfallMinutes: isCheckedIn ? 0 : shortfallMinutes,
        activeTime: fmtTime(netMins),
        breakTime: fmtTime(breakMins),
        idleTime: fmtTime(idleMins),
        breakExceeded: excessBreakMins > 0,
        excessBreakMins
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

/**
 * Get monthly attendance data for calendar view
 * Returns { employees: [...], days: [...dates], records: { empId: { date: {status, ...} } } }
 */
const getMonthlyAttendance = async (companyId, month, year) => {
  const employees = await query('SELECT * FROM employees WHERE company_id = $1', [companyId]);

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Get all attendance records for the month
  const attendance = await query(
    `SELECT * FROM attendance WHERE company_id = $1 AND check_in::date >= $2::date AND check_in::date <= $3::date`,
    [companyId, startDate, endDate]
  );

  // Get shift info
  const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
  const shift = shifts.rows[0];
  const companyTz = await getCompanyTimezone(companyId);
  const brkCfg = await getBreakConfig(companyId);

  // Build days array
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // Build per-employee, per-date records
  const records = {};
  const today = new Date().toISOString().split('T')[0];

  for (const emp of employees.rows) {
    records[emp.id] = {};
    for (const dateStr of days) {
      const att = attendance.rows.find(a => {
        const attDate = new Date(a.check_in).toISOString().split('T')[0];
        return a.employee_id == emp.id && attDate === dateStr;
      });

      if (!att) {
        // Future dates: no status; past dates: absent
        if (dateStr > today) {
          records[emp.id][dateStr] = { status: '-' };
        } else {
          // Check if weekend (Sat/Sun)
          const dow = new Date(dateStr + 'T00:00:00').getDay();
          records[emp.id][dateStr] = { status: dow === 0 || dow === 6 ? 'WEEKEND' : 'ABSENT' };
        }
        continue;
      }

      const checkIn = new Date(att.check_in);
      const checkOut = att.last_check_out || att.check_out;

      // Determine arrival status
      let displayStatus = 'PRESENT';
      if (shift) {
        const arrStatus = att.arrival_status || '';
        if (arrStatus === 'late') displayStatus = 'LATE';
        else if (arrStatus === 'overlate') displayStatus = 'OVER LATE';
        else if (arrStatus === 'halfday') displayStatus = 'HALF DAY';

        // Missed checkout logic
        if (!checkOut && dateStr < today) {
          const shiftHrs = parseFloat(shift.total_working_hours || 9);
          const shiftMins = shiftHrs * 60;
          const netMins = att.net_work_minutes || 0;
          displayStatus = netMins >= shiftMins / 2 ? 'HALF DAY' : 'ABSENT';
        }
      }

      const netMins = att.net_work_minutes || 0;
      const breakMins = att.total_break_minutes || 0;
      const fmtTime = (m) => `${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`;

      records[emp.id][dateStr] = {
        status: displayStatus,
        check_in: checkIn.toISOString(),
        check_out: checkOut || null,
        net_work_minutes: netMins,
        total_break_minutes: breakMins,
        workHours: fmtTime(netMins),
        breakTime: fmtTime(breakMins),
        remarks: att.remarks || '',
        arrival_status: att.arrival_status || 'on_time'
      };
    }
  }

  // Build special events (birthdays & joining anniversaries)
  const specialEvents = {};
  for (const emp of employees.rows) {
    const empName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown';
    // Birthday
    if (emp.date_of_birth) {
      const dob = String(emp.date_of_birth).split('T')[0]; // YYYY-MM-DD
      const dobMD = dob.slice(5); // MM-DD
      const matchDate = `${year}-${dobMD}`;
      if (days.includes(matchDate)) {
        if (!specialEvents[matchDate]) specialEvents[matchDate] = [];
        specialEvents[matchDate].push({ type: 'birthday', empId: emp.id, name: empName });
      }
    }
    // Joining anniversary
    if (emp.joining_date) {
      const jd = String(emp.joining_date).split('T')[0];
      const jdMD = jd.slice(5);
      const jdYear = parseInt(jd.slice(0, 4));
      const matchDate = `${year}-${jdMD}`;
      if (days.includes(matchDate) && jdYear < year) {
        const years = year - jdYear;
        if (!specialEvents[matchDate]) specialEvents[matchDate] = [];
        specialEvents[matchDate].push({ type: 'anniversary', empId: emp.id, name: empName, years });
      }
    }
  }

  return {
    employees: employees.rows.map(e => ({
      id: e.id,
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
      email: e.email,
      department: e.department,
      joining_date: e.joining_date || null,
      date_of_birth: e.date_of_birth || null
    })),
    days,
    records,
    specialEvents,
    month,
    year
  };
};

module.exports = {
  checkIn,
  checkOut,
  calculateAttendance,
  getDailyAttendance,
  updateAttendance,
  logEvent,
  getStats,
  getMonthlyAttendance
};
