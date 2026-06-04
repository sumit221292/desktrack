const { query } = require('../config/db');
const { getCompanyHolidays } = require('../utils/holidays');

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

// Calendar date (YYYY-MM-DD) of an instant in the given IANA timezone (default IST).
// check_in/check_out/event_time are stored as the UTC instant in `timestamp without
// time zone` columns (the backend runs in UTC), so `new Date(value)` is the correct
// instant; this returns the day it falls on for the company's timezone — NOT the UTC
// day. Using the UTC day mis-files anything between 00:00–05:30 IST onto the wrong date.
const dateInTz = (instant = new Date(), tz = 'Asia/Kolkata') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));

// Pair break START/END events into { LUNCH:[{start,end}], TEA:[{start,end}] } with AT
// MOST one open break per type — the same shape the /activity route returns. Lets the
// calendar's live timer compute work exactly like the Dashboard (pausing during a break).
const pairBreakEvents = (events = []) => {
  const sorted = events.slice().sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
  const pairs = { LUNCH: [], TEA: [] };
  for (const type of ['LUNCH', 'TEA']) {
    const starts = sorted.filter(e => e.event_type === `${type}_START`);
    const ends = sorted.filter(e => e.event_type === `${type}_END`);
    const n = Math.min(starts.length, ends.length);
    for (let i = 0; i < n; i++) pairs[type].push({ start: starts[i].event_time, end: ends[i].event_time });
    if (starts.length > ends.length) pairs[type].push({ start: starts[n].event_time, end: null });
  }
  return pairs;
};

// Last instant we have PROOF the employee was present, used when checkout is missing.
// = the latest of: check-in, any real (closed) session checkout, any break event.
// An open session contributes nothing (we don't know when they actually left).
const lastActivityInstant = (checkIn, sessions = [], events = []) => {
  let t = new Date(checkIn).getTime();
  for (const s of sessions) {
    if (s.check_out) t = Math.max(t, new Date(s.check_out).getTime());
    if (s.check_in) t = Math.max(t, new Date(s.check_in).getTime()); // re-check-in is activity
  }
  for (const e of events) {
    if (e.event_time) t = Math.max(t, new Date(e.event_time).getTime());
  }
  return new Date(t);
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
 * Settle missed checkouts from previous days.
 *
 * A missed checkout is settled at the LAST KNOWN ACTIVITY of that day (latest of
 * check-in, any real session checkout, any break event / re-check-in) — we only
 * credit the time we can prove the employee was present, never the whole shift.
 * Status is HALF DAY or ABSENT (never full present) + MISSED_CHECKOUT flag.
 */
const closeMissedCheckouts = async (companyId) => {
  try {
    const companyTz = await getCompanyTimezone(companyId);
    const today = dateInTz(new Date(), companyTz); // current calendar day in company tz (IST)
    const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
    const shift0 = shifts.rows[0] || { total_working_hours: 9 };
    const maxShiftMins = (parseFloat(shift0.total_working_hours) || 9) * 60;
    const brkCfg = await getBreakConfig(companyId);

    // Attendance records from a PREVIOUS day that were never checked out.
    const open = await query('SELECT * FROM attendance WHERE company_id = $1 AND check_out IS NULL', [companyId]);
    for (const rec of open.rows) {
      const attDate = rec.check_in ? dateInTz(rec.check_in, companyTz) : null;
      if (!attDate || attDate >= today) continue; // today / still in progress — leave it

      const sessRes = await query('SELECT * FROM attendance_sessions WHERE attendance_id = $1 ORDER BY check_in', [rec.id]);
      const evRes = await query('SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY event_time', [rec.id]);
      // Compute last activity BEFORE closing open sessions (open ones prove nothing).
      const lastAct = lastActivityInstant(rec.check_in, sessRes.rows, evRes.rows);

      // Close any still-open sessions at the last known activity.
      for (const s of sessRes.rows) {
        if (s.check_out) continue;
        const dur = Math.min(maxShiftMins, Math.max(0, Math.ceil((lastAct - new Date(s.check_in)) / 60000)));
        await query('UPDATE attendance_sessions SET check_out = $1, duration_minutes = $2 WHERE id = $3', [lastAct, dur, s.id]);
      }

      const shiftCalc = { ...shift0, company_id: companyId, employee_id: rec.employee_id, timezone: companyTz,
        lunch_allowed_minutes: brkCfg.lunch_allowed_minutes || 45, tea_allowed_minutes: brkCfg.tea_allowed_minutes || 15 };
      const { daily_attendance: d } = calculateAttendance(shiftCalc, rec.check_in, lastAct, evRes.rows, sessRes.rows, { missed: true });

      await query(
        `UPDATE attendance SET check_out = $1, last_check_out = $1, gross_minutes = $2, total_break_minutes = $3,
           net_work_minutes = $4, other_break_minutes = $5, overtime_minutes = $6, status = $7, flags = $8, ai_summary = $9
         WHERE id = $10 AND company_id = $11`,
        [lastAct, d.gross_minutes, d.total_break_minutes, d.net_work_minutes, d.other_break_minutes,
         d.overtime_minutes, d.status, JSON.stringify(d.flags),
         `Checkout missed. Settled at last activity (${dateInTz(lastAct, companyTz)}). Presence ${d.effective_presence_minutes}min → ${d.day_status}.`,
         rec.id, companyId]
      );
      console.log(`[AutoClose] Attendance ${rec.id} on ${attDate} — ${d.day_status}, presence=${d.effective_presence_minutes}min`);
    }
  } catch (e) {
    console.error('[AutoClose] Error:', e.message);
  }
};

const calculateAttendance = (shift, checkIn, checkOut, events = [], sessions = [], opts = {}) => {
  if (!checkIn) return { status: 'MISSING_ENTRY', flags: ['NO_CHECK_IN'] };
  const missedCheckout = !!opts.missed; // checkout never happened; `checkOut` = last known activity

  const firstCheckIn = new Date(checkIn);
  const lastCheckOut = checkOut ? new Date(checkOut) : null;
  const tzOffset = getTzOffset(shift.timezone || 'Asia/Kolkata');
  // Anchor the day to the company's timezone (IST), not UTC, so shift-start / late /
  // half-day comparisons and the stored attendance_date land on the right calendar day.
  const dateStr = dateInTz(firstCheckIn, shift.timezone || 'Asia/Kolkata');

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
          // Last start has no end.
          // If user has checked out — cap break at checkout time (break ended when user left)
          // If user is still checked in — count up to now (live break)
          const capEnd = lastCheckOut || new Date();
          const dur = Math.ceil((capEnd - sTime) / 60000);
          if (dur > 0) actualMins += dur;
          if (!lastCheckOut) status = 'INCOMPLETE'; // only "active" if still checked in
          else {
            endTime = capEnd;
            windows.push({ start: sTime, end: capEnd, type });
          }
        }
      }
      // Excess over the allowance is computed ALWAYS — including while a break is still
      // active (status INCOMPLETE). actualMins already counts the live active break, so the
      // Expected Out reflects the over-break in real time instead of resetting to the base
      // checkout whenever a break is open.
      excessMins = Math.max(0, actualMins - allowedMins);
      if (status !== 'INCOMPLETE') {
        status = actualMins <= allowedMins ? 'ON_TIME' : 'EXTENDED';
      }
    }

    // For active break: find the latest unmatched START (the one without END pair)
    let activeStartTime = null;
    let completedMins = 0;
    // Completed (ENDED) break time in SECONDS — excludes any active break, no rounding.
    let completedSecs = 0;
    for (let i = 0; i < endEvents.length; i++) {
      completedSecs += Math.max(0, Math.floor((new Date(endEvents[i].event_time) - new Date(startEvents[i].event_time)) / 1000));
    }
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
    namedBreakResults[`${type}_completed_seconds`] = completedSecs;
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
  let otherBreakSeconds = 0;
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
        otherBreakSeconds += Math.round((breakEnd - breakStart) / 1000);
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

  // 4. WORK TIME — gross = time from first check-in to checkout (or to NOW while still
  // checked in), measured to the SECOND and rounded ONCE. Re-check-in gaps are taken
  // out as breaks below, so rapid / sub-minute sessions never each inflate to a full
  // minute (which made the modal read higher than the live timer).
  const totalBreakMinutes = totalNamedBreakMinutes + otherBreakMinutes;
  const endMs = lastCheckOut ? lastCheckOut.getTime() : (sessions.length > 0 ? Date.now() : null);
  const grossMinutes = endMs ? Math.max(0, Math.floor((endMs - firstCheckIn.getTime()) / 60000)) : 0;

  const netWorkMinutes = Math.max(0, grossMinutes - totalBreakMinutes);

  // Second-precise durations for HH:MM:SS display (does NOT affect status/payroll,
  // which use the minute fields above). Active breaks count up to checkout/now.
  const _nowMs = Date.now();
  let totalNamedBreakSeconds = 0;
  for (const t of breakTypes) {
    const tu = t.toUpperCase();
    const ss = events.filter(e => e.event_type === `${tu}_START`).map(e => new Date(e.event_time).getTime()).sort((a, b) => a - b);
    const es = events.filter(e => e.event_type === `${tu}_END`).map(e => new Date(e.event_time).getTime()).sort((a, b) => a - b);
    let secs = 0;
    for (let i = 0; i < ss.length; i++) {
      if (i < es.length) {
        if (es[i] > ss[i]) secs += (es[i] - ss[i]) / 1000; // completed pair
      } else {
        // First unmatched START = the ONE active break (up to checkout/now). Any further
        // duplicate STARTs are ignored so an active break is never counted more than once.
        const end = lastCheckOut ? lastCheckOut.getTime() : _nowMs;
        if (end > ss[i]) secs += (end - ss[i]) / 1000;
        break;
      }
    }
    namedBreakResults[`${t}_actual_seconds`] = Math.round(secs);
    totalNamedBreakSeconds += secs;
  }
  const grossSeconds = endMs ? Math.max(0, Math.floor((endMs - firstCheckIn.getTime()) / 1000)) : 0;
  const totalBreakSeconds = Math.round(totalNamedBreakSeconds) + otherBreakSeconds;
  // WORK = time actually checked in (sum of every session, open one → now) minus named
  // breaks. Re-check-in GAPS (any length, incl. a few seconds) are not in any session,
  // so a brief checkout never leaks into work time.
  let sessionSeconds = 0;
  for (const s of sessions) {
    if (!s.check_in) continue;
    const inMs = new Date(s.check_in).getTime();
    const outMs = s.check_out ? new Date(s.check_out).getTime() : (lastCheckOut ? lastCheckOut.getTime() : _nowMs);
    if (outMs > inMs) sessionSeconds += (outMs - inMs) / 1000;
  }
  if (!sessions.length && endMs) sessionSeconds = Math.max(0, (endMs - firstCheckIn.getTime()) / 1000);
  const netWorkSeconds = Math.max(0, Math.floor(sessionSeconds - Math.round(totalNamedBreakSeconds)));
  const shiftDurationMins = (shift.total_working_hours || 0) * 60;
  const overtimeMinutes = Math.max(0, netWorkMinutes - shiftDurationMins);

  // EXCESS break = break taken beyond the allowance. This is what pushes the required
  // checkout later: the 70-min allowance is INSIDE the shift, so only over-limit break
  // (and unplanned re-check-in gaps) extend how long the employee must stay.
  let excessBreakMinutes = otherBreakMinutes;
  for (const t of breakTypes) excessBreakMinutes += (namedBreakResults[`${t}_excess_minutes`] || 0);

  // EFFECTIVE PRESENCE = time at work counting the allowed break as worked (only the
  // EXCESS break is subtracted). Completing the full shift duration of effective
  // presence = staying till the expected checkout (check-in + 9h + excess break).
  const effectivePresenceMinutes = Math.max(0, grossMinutes - excessBreakMinutes);
  const expectedCheckoutMinutes = shiftDurationMins + excessBreakMinutes;

  // DAY STATUS (presence-based, NO grace). Only decided once a checkout exists; for a
  // missed checkout `checkOut` is the last known activity, and it can never be FULL.
  let dayStatus = null; // 'FULL' | 'HALF DAY' | 'ABSENT' | null (in progress)
  if (lastCheckOut) {
    if (effectivePresenceMinutes < shiftDurationMins / 2) dayStatus = 'ABSENT';
    else if (missedCheckout || effectivePresenceMinutes < shiftDurationMins) dayStatus = 'HALF DAY';
    else dayStatus = 'FULL';
  }

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
  // HALFDAY / ABSENT flags drive payroll → keep them in sync with the day status.
  if (dayStatus === 'HALF DAY' || arrivalStatus === 'halfday') flags.push('HALFDAY');
  if (dayStatus === 'ABSENT') flags.push('ABSENT');
  if (missedCheckout) flags.push('MISSED_CHECKOUT');
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
      excess_break_minutes: excessBreakMinutes,
      gross_minutes: grossMinutes,
      net_work_minutes: netWorkMinutes,
      gross_seconds: grossSeconds,
      total_break_seconds: totalBreakSeconds,
      net_work_seconds: netWorkSeconds,
      effective_presence_minutes: effectivePresenceMinutes,
      expected_checkout_minutes: expectedCheckoutMinutes,
      overtime_minutes: overtimeMinutes,
      day_status: dayStatus,
      missed_checkout: missedCheckout,
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
  const dateStr = dateInTz(checkInTime, tz); // IST calendar day

  // 3. Check for existing daily attendance record (match on the IST calendar day)
  const existingAtt = await query(
    `SELECT * FROM attendance WHERE employee_id = $1 AND company_id = $2
       AND (check_in AT TIME ZONE 'UTC' AT TIME ZONE $4)::date = $3::date`,
    [employeeId, companyId, dateStr, tz]
  );

  let attendanceId;
  let statusRecord;

  // Close only SAME-day leftover open sessions (a re-check-in gap within today),
  // crediting up to the check-in moment (capped to the shift). Open sessions from a
  // PREVIOUS day are missed checkouts — leave them for closeMissedCheckouts, which
  // settles them at that day's last known activity (don't carry hours across midnight).
  const orphanSessions = await query(
    'SELECT id, check_in FROM attendance_sessions WHERE employee_id = $1 AND company_id = $2 AND check_out IS NULL',
    [employeeId, companyId]
  );
  if (orphanSessions.rows.length > 0) {
    const maxShiftMins = (parseFloat(shift.total_working_hours) || 9) * 60;
    for (const sess of orphanSessions.rows) {
      const sessDay = dateInTz(sess.check_in, tz);
      if (sessDay < dateStr) continue; // previous day — leave for closeMissedCheckouts
      const dur = Math.min(maxShiftMins, Math.max(1, Math.ceil((checkInTime - new Date(sess.check_in)) / 60000)));
      await query('UPDATE attendance_sessions SET check_out = $1, duration_minutes = $2 WHERE id = $3', [checkInTime, dur, sess.id]);
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

  // Close TODAY's open sessions, credited up to the checkout (capped to the shift).
  // Open sessions from a PREVIOUS day are missed checkouts — leave them for
  // closeMissedCheckouts (settled at that day's last activity, no cross-midnight credit).
  const coDay = dateInTz(checkOutTime, shift.timezone);
  const coMaxShiftMins = (parseFloat(shift.total_working_hours) || 9) * 60;
  for (const session of openSessions.rows) {
    const sessDay = dateInTz(session.check_in, shift.timezone);
    if (sessDay < coDay) continue; // previous day — leave for closeMissedCheckouts
    const durationMinutes = Math.min(coMaxShiftMins, Math.max(1, Math.ceil((checkOutTime - new Date(session.check_in)) / 60000)));
    await query('UPDATE attendance_sessions SET check_out = $1, duration_minutes = $2 WHERE id = $3', [checkOutTime, durationMinutes, session.id]);
  }

  // Auto-end any active breaks (LUNCH/TEA started but not ended)
  const allEvents = eventsResult.rows;
  for (const type of ['LUNCH', 'TEA']) {
    const starts = allEvents.filter(e => e.event_type === `${type}_START`).sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
    const ends = allEvents.filter(e => e.event_type === `${type}_END`).sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
    if (starts.length > ends.length) {
      // Active break — end it at checkout time
      await query(
        'INSERT INTO attendance_events (company_id, employee_id, attendance_id, event_type, event_time) VALUES ($1, $2, $3, $4, $5)',
        [companyId, record.employee_id, attendanceId, `${type}_END`, checkOutTime]
      );
      console.log(`[Checkout] Auto-ended active ${type} break for employee ${record.employee_id}`);
    }
  }

  // Re-fetch events after auto-ending breaks
  const updatedEvents = await query('SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY event_time ASC', [attendanceId]);
  eventsResult.rows = updatedEvents.rows;

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

  // `dummy-<id>` / `no-ref-<id>` are SYNTHETIC ids the daily list uses for an employee
  // with no record yet. Editing such a row is a manual override that CREATES the record,
  // so derive the employee from the id (trailing number) and skip the row lookup.
  if (String(attendanceId).startsWith('dummy-') || String(attendanceId).startsWith('no-ref-')) {
    employeeId = parseInt(String(attendanceId).split('-').pop(), 10);
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

  // A manual override must not save a check-out at/before the check-in (e.g. entering
  // 07:00 = 7 AM when 19:00 / 7 PM was meant) — that produced 0 work + a runaway break.
  if (checkInTime && checkOutTime && checkOutTime.getTime() <= checkInTime.getTime()) {
    throw new Error('Check-out must be after check-in.');
  }

  // Fetch sessions and events for the record
  const sessionsResult = await query(
    'SELECT * FROM attendance_sessions WHERE attendance_id = $1 ORDER BY check_in ASC',
    [attendanceId]
  );
  const eventsResult = await query(
    'SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY event_time ASC',
    [attendanceId]
  );

  // A manual override sets check-in/out but has no work session of its own. The whole app
  // computes work/status from SESSIONS, so without one the override reads as 0h / Absent
  // everywhere. If the day has no session yet, synthesize ONE spanning the override
  // (check-in → check-out) — used for the stored totals AND persisted below, so every view
  // (calendar, list, dashboard) recomputes it identically.
  const noSessions = sessionsResult.rows.length === 0;
  const overrideSession = (noSessions && checkInTime) ? [{ check_in: checkInTime, check_out: checkOutTime }] : null;
  const sessionsForCalc = overrideSession || sessionsResult.rows;

  const { daily_attendance } = calculateAttendance(shift, checkInTime, checkOutTime, eventsResult.rows, sessionsForCalc);
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

  // Persist the synthesized override session so the session-based views (calendar / list /
  // dashboard) recompute the override identically — work hours, FULL/HALF/ABSENT status,
  // and check-in/out all derive from this one session.
  if (overrideSession) {
    const recId = result.rows[0].id;
    const dur = checkOutTime ? Math.max(1, Math.ceil((checkOutTime - checkInTime) / 60000)) : null;
    await query(
      `INSERT INTO attendance_sessions (attendance_id, company_id, employee_id, check_in, check_out, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [recId, companyId, employeeId, checkInTime, checkOutTime, dur]
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

  // Only ONE break at a time + idempotent toggling: a START while ANY break (lunch OR
  // tea) is already open is ignored, and an END for a break you're not on is ignored.
  // Prevents overlapping "active" breaks that make the live work timer mis-count.
  const ev = eventType.toUpperCase();
  const baseType = ev.replace(/_START$|_END$/, '');
  const isStart = ev.endsWith('_START');
  const cnt = await query(
    `SELECT event_type, COUNT(*) AS n FROM attendance_events WHERE attendance_id = $1 AND company_id = $2 GROUP BY event_type`,
    [attendanceId, companyId]
  );
  const counts = {};
  cnt.rows.forEach(r => { counts[r.event_type] = parseInt(r.n) || 0; });
  const openOf = (t) => (counts[`${t}_START`] || 0) - (counts[`${t}_END`] || 0);
  const anyBreakOpen = ['LUNCH', 'TEA'].some(t => openOf(t) > 0);
  if (isStart && anyBreakOpen) return { ignored: true, message: 'Already on a break' };
  if (!isStart && openOf(baseType) <= 0) return { ignored: true, message: `Not on ${baseType.toLowerCase()} break` };

  // Log Event
  const result = await query(
    `INSERT INTO attendance_events (company_id, employee_id, attendance_id, event_type, event_time)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, employeeId, attendanceId, ev, time]
  );

  return result.rows[0];
};

/**
 * Get daily attendance for all employees
 */
const getDailyAttendance = async (companyId, dateStr) => {
  // Auto-close missed checkouts from previous days
  await closeMissedCheckouts(companyId);

  const tz = await getCompanyTimezone(companyId);
  const employees = await query('SELECT * FROM employees WHERE company_id = $1', [companyId]);

  // Timestamps are stored as the UTC instant; match rows whose IST calendar day equals
  // the requested date (so a 00:00–05:30 IST check-in isn't filed onto the previous day).
  const attendance = await query(
    `SELECT * FROM attendance
     WHERE company_id = $1 AND (check_in AT TIME ZONE 'UTC' AT TIME ZONE $3)::date = $2::date`,
    [companyId, dateStr, tz]
  );

  const events = await query(
    `SELECT * FROM attendance_events
     WHERE company_id = $1 AND (event_time AT TIME ZONE 'UTC' AT TIME ZONE $3)::date = $2::date`,
    [companyId, dateStr, tz]
  );

  const sessions = await query(
    `SELECT * FROM attendance_sessions
     WHERE company_id = $1 AND (check_in AT TIME ZONE 'UTC' AT TIME ZONE $3)::date = $2::date`,
    [companyId, dateStr, tz]
  );
  
  const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
  const shift = shifts.rows[0];

  const companyTz = tz;
  const brkCfg = await getBreakConfig(companyId);

  // Weekend / company-holiday → non-working status for employees with no record
  const holidaySet = new Set((await getCompanyHolidays(companyId)).map(h => h.date));
  const _dow = new Date(dateStr + 'T00:00:00').getDay();
  const nonWorkingStatus = (_dow === 0 || _dow === 6) ? 'WEEKEND' : (holidaySet.has(dateStr) ? 'OFFICE HOLIDAY' : 'ABSENT');

  const records = employees.rows.map((emp) => {
    const existing = attendance.rows.find(a => a.employee_id == emp.id);
    const empSessions = sessions.rows.filter(s => s.employee_id == emp.id);
    const isCheckedIn = empSessions.some(s => s.check_out === null || s.check_out === undefined);

    if (existing) {
      const checkIn = new Date(existing.check_in);
      const lastOut = existing.last_check_out || existing.check_out;
      // If the latest session is still open (re-checked-in after an earlier
      // checkout), the employee is currently IN — the stale last_check_out must NOT
      // be treated as a checkout for live break/status calc.
      const checkOut = (lastOut && !isCheckedIn) ? new Date(lastOut) : null;

      const empEvents = events.rows.filter(e => e.employee_id == emp.id);
      const existingFlags = existing.flags ? (typeof existing.flags === 'string' ? JSON.parse(existing.flags) : existing.flags) : [];
      // closeMissedCheckouts (run above) flags prior-day missed checkouts and settles
      // their checkout at the last activity → here `checkOut` IS that last activity.
      const missedCheckout = existingFlags.includes('MISSED_CHECKOUT');

      const { daily_attendance } = calculateAttendance({ ...shift, employee_id: emp.id, timezone: companyTz, lunch_allowed_minutes: brkCfg.lunch_allowed_minutes || 45, tea_allowed_minutes: brkCfg.tea_allowed_minutes || 15 }, checkIn, checkOut, empEvents, empSessions, { missed: missedCheckout });

      const shiftHrs = parseFloat(shift?.total_working_hours || 9);
      const shiftMins = shiftHrs * 60;
      const breakMins = daily_attendance.total_break_minutes || 0;
      const excessBreakMins = daily_attendance.excess_break_minutes || 0;
      // Expected checkout = check-in + shift hours + excess break (extra break pushes it later)
      const expectedOutISO = new Date(checkIn.getTime() + (daily_attendance.expected_checkout_minutes || shiftMins) * 60000);

      // Late minutes: diff between check_in and shift_start_time (IST)
      let lateMinutes = 0;
      if (shift?.shift_start_time) {
        const [sh, sm] = shift.shift_start_time.split(':').map(Number);
        const shiftStartISO = new Date(`${dateInTz(checkIn, companyTz)}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00${getTzOffset(companyTz)}`);
        if (checkIn > shiftStartISO) lateMinutes = Math.floor((checkIn - shiftStartISO) / 60000);
      }

      // Display status: presence-based day_status decides PRESENT/HALF DAY/ABSENT; a
      // FULLY completed day is labelled by arrival (ON TIME / LATE / OVER LATE). While
      // still checked in (no day_status yet) we show the arrival label.
      const arrStatus = daily_attendance.arrival_status || 'on_time';
      const arrivalLabel = arrStatus === 'late' ? 'LATE' : arrStatus === 'overlate' ? 'OVER LATE' : arrStatus === 'halfday' ? 'HALF DAY' : 'ON TIME';
      const ds = daily_attendance.day_status; // 'FULL' | 'HALF DAY' | 'ABSENT' | null
      let displayStatus = arrivalLabel;
      if (ds === 'ABSENT') displayStatus = 'ABSENT';
      else if (ds === 'HALF DAY') displayStatus = 'HALF DAY';

      const netMins = daily_attendance.net_work_minutes || 0;
      const grossMins = daily_attendance.gross_minutes || 0;
      const idleMins = Math.max(0, grossMins - netMins - breakMins);
      const shortfallMinutes = netMins < shiftMins ? Math.floor(shiftMins - netMins) : 0;
      const fmtTime = (m) => `${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`;

      return {
        ...existing,
        ...daily_attendance,
        check_out: lastOut || null,
        employee_id: emp.id,
        email: emp.email,
        is_checked_in: isCheckedIn,
        // For an in-progress row, ship raw sessions + paired breaks so the list's live
        // work timer computes EXACTLY like the Dashboard/Calendar (and freezes on a break).
        ...(isCheckedIn ? {
          sessions: empSessions.map(s => ({ check_in: s.check_in, check_out: s.check_out })),
          breaks: pairBreakEvents(empEvents),
        } : {}),
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown',
        role: emp.role,
        workHours: netMins > 0 ? fmtTime(netMins) : (isCheckedIn ? 'In Progress' : '0h 00m'),
        missedCheckout,
        expectedCheckout: expectedOutISO.toISOString(),
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
      status: nonWorkingStatus,
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
  // Settle any prior-day missed checkouts first so the calendar uses correct status.
  await closeMissedCheckouts(companyId);
  const tz = await getCompanyTimezone(companyId);
  const employees = await query('SELECT * FROM employees WHERE company_id = $1', [companyId]);

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Get all attendance records for the month, matched on the IST calendar day.
  const attendance = await query(
    `SELECT * FROM attendance WHERE company_id = $1
       AND (check_in AT TIME ZONE 'UTC' AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date`,
    [companyId, startDate, endDate, tz]
  );

  // Break events and work sessions for the whole month, matched on the IST calendar day.
  // The calendar recomputes work/break time with the SAME engine the daily/live view uses
  // (calculateAttendance) instead of reading the stored net_work_minutes/total_break_minutes
  // columns — those are only written at check-out/edit (0 at check-in), so an in-progress
  // day would otherwise show 0h while Dashboard/Attendance show live hours.
  const monthEvents = await query(
    `SELECT * FROM attendance_events WHERE company_id = $1
       AND (event_time AT TIME ZONE 'UTC' AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date`,
    [companyId, startDate, endDate, tz]
  );
  const monthSessions = await query(
    `SELECT * FROM attendance_sessions WHERE company_id = $1
       AND (check_in AT TIME ZONE 'UTC' AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date`,
    [companyId, startDate, endDate, tz]
  );

  // Group this month's sessions/events by employee + IST day for O(1) lookup in the loop
  // below (avoids re-running dateInTz per emp × day × row).
  const sessionsByEmpDay = {};
  for (const s of monthSessions.rows) {
    const k = `${s.employee_id}|${dateInTz(s.check_in, tz)}`;
    (sessionsByEmpDay[k] = sessionsByEmpDay[k] || []).push(s);
  }
  const eventsByEmpDay = {};
  for (const e of monthEvents.rows) {
    const k = `${e.employee_id}|${dateInTz(e.event_time, tz)}`;
    (eventsByEmpDay[k] = eventsByEmpDay[k] || []).push(e);
  }

  // Get shift info
  const shifts = await query('SELECT * FROM shifts WHERE company_id = $1', [companyId]);
  const shift = shifts.rows[0];
  const companyTz = tz;
  const brkCfg = await getBreakConfig(companyId);

  // Company holidays (paid non-working days, like weekends)
  const holidayList = await getCompanyHolidays(companyId);
  const holidayMap = {};
  holidayList.forEach(h => { holidayMap[h.date] = h.name; });

  // Approved leaves → per-employee, per-date map (paid = leave_type quota > 0, else LOP)
  const leaveRes = await query(
    `SELECT lr.employee_id, lr.start_date, lr.end_date, lr.leave_session, lt.code, lt.annual_quota
     FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.company_id = $1 AND lr.status = 'APPROVED'
       AND lr.start_date <= $3::date AND lr.end_date >= $2::date`,
    [companyId, startDate, endDate]
  ).catch(() => ({ rows: [] }));
  const leaveMap = {}; // { empId: { 'YYYY-MM-DD': { paid, code, half, session } } }
  for (const lv of leaveRes.rows) {
    const s = new Date(Math.max(new Date(lv.start_date), new Date(startDate)));
    const e = new Date(Math.min(new Date(lv.end_date), new Date(endDate)));
    const paid = (parseInt(lv.annual_quota) || 0) > 0;
    const half = ['FIRST_HALF', 'SECOND_HALF'].includes(lv.leave_session);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      if (!leaveMap[lv.employee_id]) leaveMap[lv.employee_id] = {};
      leaveMap[lv.employee_id][ds] = { paid, code: lv.code, half, session: lv.leave_session };
    }
  }

  // Build days array
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // Build per-employee, per-date records
  const records = {};
  const today = dateInTz(new Date(), companyTz);

  for (const emp of employees.rows) {
    records[emp.id] = {};
    for (const dateStr of days) {
      const att = attendance.rows.find(a => {
        const attDate = dateInTz(a.check_in, companyTz);
        return a.employee_id == emp.id && attDate === dateStr;
      });

      if (!att) {
        const dow = new Date(dateStr + 'T00:00:00').getDay();
        const lv = leaveMap[emp.id]?.[dateStr];
        if (dow === 0 || dow === 6) {
          records[emp.id][dateStr] = { status: 'WEEKEND' };          // week-off (any date)
        } else if (holidayMap[dateStr] !== undefined) {
          records[emp.id][dateStr] = { status: 'OFFICE HOLIDAY' };   // company holiday
        } else if (lv) {
          records[emp.id][dateStr] = { status: lv.paid ? 'LEAVE' : 'LOP', leaveCode: lv.code, half: lv.half, session: lv.session };
        } else if (dateStr >= today) {
          records[emp.id][dateStr] = { status: '-' };                 // today (in progress) or future — not absent yet
        } else {
          records[emp.id][dateStr] = { status: 'ABSENT' };            // a past working day with no attendance
        }
        continue;
      }

      const attFlags = att.flags ? (typeof att.flags === 'string' ? JSON.parse(att.flags) : att.flags) : [];

      // Sessions/events are the SOURCE OF TRUTH. The attendance header columns
      // (check_in / check_out / flags) can go STALE when a day is re-opened — e.g. a
      // re-check-in after an earlier checkout leaves the old check_in + an ABSENT flag
      // behind even though the person is now working. So derive the calendar's
      // check-in/out, work time AND status from the live sessions (the same engine the
      // Dashboard/daily view uses), not from the header.
      const dayKey = `${emp.id}|${dateStr}`;
      const empDaySessions = (sessionsByEmpDay[dayKey] || []).slice().sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
      const empDayEvents = eventsByEmpDay[dayKey] || [];
      const hasSessions = empDaySessions.length > 0;
      const isCheckedIn = empDaySessions.some(s => s.check_out === null || s.check_out === undefined);

      const checkInDate = hasSessions ? new Date(empDaySessions[0].check_in) : new Date(att.check_in);
      const lastSessOut = (hasSessions && !isCheckedIn) ? empDaySessions[empDaySessions.length - 1].check_out : null;
      const headerOut = att.last_check_out || att.check_out;
      // While checked in, ignore any stale header checkout — the employee is currently IN.
      const checkOutDate = isCheckedIn ? null : (lastSessOut ? new Date(lastSessOut) : (headerOut ? new Date(headerOut) : null));
      const missedCheckout = attFlags.includes('MISSED_CHECKOUT') && !isCheckedIn;

      const { daily_attendance } = calculateAttendance(
        { ...shift, employee_id: emp.id, timezone: companyTz, lunch_allowed_minutes: brkCfg.lunch_allowed_minutes || 45, tea_allowed_minutes: brkCfg.tea_allowed_minutes || 15 },
        checkInDate, checkOutDate, empDayEvents, empDaySessions, { missed: missedCheckout }
      );

      // Status from the LIVE recompute, not the (possibly stale) stored flags. A day
      // with someone currently checked in is never "Absent" — show the arrival-based
      // present status. With sessions present we trust the recomputed day_status; only
      // historical rows that have no sessions fall back to the stored flags.
      const arrival = daily_attendance.arrival_status || att.arrival_status || 'on_time';
      const base = arrival === 'late' ? 'LATE' : arrival === 'overlate' ? 'OVER LATE' : 'PRESENT';
      let displayStatus;
      if (isCheckedIn) {
        displayStatus = base;
      } else if (hasSessions) {
        const ds = daily_attendance.day_status;
        displayStatus = ds === 'ABSENT' ? 'ABSENT' : ds === 'HALF DAY' ? 'HALF DAY' : base;
      } else {
        displayStatus = attFlags.includes('ABSENT') ? 'ABSENT' : attFlags.includes('HALFDAY') ? 'HALF DAY' : base;
      }

      const netMins = daily_attendance.net_work_minutes || 0;
      const breakMins = daily_attendance.total_break_minutes || 0;
      const fmtTime = (m) => `${Math.floor(m / 60)}h ${String(Math.floor(m % 60)).padStart(2, '0')}m`;

      records[emp.id][dateStr] = {
        status: displayStatus,
        check_in: checkInDate.toISOString(),
        check_out: checkOutDate ? checkOutDate.toISOString() : null,
        is_checked_in: isCheckedIn,
        net_work_minutes: netMins,
        net_work_seconds: daily_attendance.net_work_seconds || 0,  // accurate session-based seconds (same source the Dashboard ticks from)
        // For an in-progress day, ship the raw sessions + paired breaks so the calendar's
        // live timer computes work EXACTLY like the Dashboard (and freezes during a break).
        ...(isCheckedIn ? {
          sessions: empDaySessions.map(s => ({ check_in: s.check_in, check_out: s.check_out })),
          breaks: pairBreakEvents(empDayEvents),
        } : {}),
        total_break_minutes: breakMins,
        workHours: netMins > 0 ? fmtTime(netMins) : (isCheckedIn ? 'In Progress' : '0h 00m'),
        breakTime: fmtTime(breakMins),
        remarks: att.remarks || '',
        arrival_status: arrival
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

  // Company holidays for this month → calendar chips
  for (const dateStr of days) {
    if (holidayMap[dateStr] !== undefined) {
      if (!specialEvents[dateStr]) specialEvents[dateStr] = [];
      specialEvents[dateStr].push({ type: 'holiday', name: holidayMap[dateStr] });
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
  getMonthlyAttendance,
  dateInTz
};
