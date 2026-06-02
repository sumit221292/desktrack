/**
 * Centralized attendance status configuration
 * Used across Dashboard, Attendance, Calendar, and all other pages
 */

export const STATUS_CONFIG = {
  'PRESENT':        { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: 'Present',       short: 'P',  tw: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'ON TIME':        { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: 'On Time',       short: 'P',  tw: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'COMPLETE':       { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: 'Complete',      short: 'P',  tw: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'LATE':           { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'Late',          short: 'LT', tw: 'bg-amber-50 text-amber-700 border-amber-200' },
  'LATE_ARRIVAL':   { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'Late',          short: 'LT', tw: 'bg-amber-50 text-amber-700 border-amber-200' },
  'OVER LATE':      { color: '#ea580c', bg: '#ffedd5', border: '#fed7aa', label: 'Over Late',     short: 'OL', tw: 'bg-orange-50 text-orange-700 border-orange-200' },
  'OVERLATE':       { color: '#ea580c', bg: '#ffedd5', border: '#fed7aa', label: 'Over Late',     short: 'OL', tw: 'bg-orange-50 text-orange-700 border-orange-200' },
  'HALF DAY':       { color: '#9333ea', bg: '#f3e8ff', border: '#e9d5ff', label: 'Half Day',      short: 'HD', tw: 'bg-purple-50 text-purple-700 border-purple-200' },
  'HALFDAY':        { color: '#9333ea', bg: '#f3e8ff', border: '#e9d5ff', label: 'Half Day',      short: 'HD', tw: 'bg-purple-50 text-purple-700 border-purple-200' },
  'ABSENT':         { color: '#dc2626', bg: '#fee2e2', border: '#fecaca', label: 'Absent',        short: 'A',  tw: 'bg-red-50 text-red-700 border-red-200' },
  'WEEKEND':        { color: '#94a3b8', bg: '#f1f5f9', border: '#e2e8f0', label: 'Week-off',      short: 'WO', tw: 'bg-slate-50 text-slate-400 border-slate-200' },
  'INCOMPLETE':     { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', label: 'Active',        short: 'AC', tw: 'bg-blue-50 text-blue-700 border-blue-200' },
  'LEAVE':          { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Leave',         short: 'L',  tw: 'bg-blue-50 text-blue-700 border-blue-200' },
  'LOP':            { color: '#1e293b', bg: '#e2e8f0', border: '#cbd5e1', label: 'LOP',           short: 'LOP',tw: 'bg-slate-800 text-white border-slate-800' },
  'OFFICE HOLIDAY': { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'Holiday',        short: 'H',  tw: 'bg-amber-50 text-amber-700 border-amber-200' },
  'PUBLIC HOLIDAY': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Public Holiday', short: 'H',  tw: 'bg-amber-50 text-amber-600 border-amber-200' },
  // Live presence statuses (Recent Activity — current state right now)
  'CHECKED IN':     { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0', label: 'Checked In',     short: 'IN', tw: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'CHECKED OUT':    { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', label: 'Checked Out',    short: 'OUT',tw: 'bg-slate-100 text-slate-600 border-slate-300' },
  'ON LUNCH':       { color: '#ea580c', bg: '#ffedd5', border: '#fed7aa', label: 'On Lunch Break', short: 'L',  tw: 'bg-orange-50 text-orange-700 border-orange-200' },
  'ON TEA':         { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'On Tea Break',   short: 'T',  tw: 'bg-amber-50 text-amber-700 border-amber-200' },
  'ON BREAK':       { color: '#d97706', bg: '#fef3c7', border: '#fde68a', label: 'On Break',       short: 'BR', tw: 'bg-amber-50 text-amber-700 border-amber-200' },
  'NOT CHECKED IN': { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', label: 'Not Checked In', short: '-',  tw: 'bg-slate-50 text-slate-400 border-slate-200' },
  '-':              { color: '#e2e8f0', bg: 'transparent', border: '#e2e8f0', label: '-',         short: '',   tw: 'bg-slate-50 text-slate-300 border-slate-100' },
};

/**
 * Get status config — normalizes status string and returns config
 */
export const getStatusConfig = (status) => {
  const s = (status || '').toUpperCase().trim();
  return STATUS_CONFIG[s] || STATUS_CONFIG['-'];
};

/**
 * Get status badge classes (Tailwind) for inline use
 */
export const getStatusTw = (status) => getStatusConfig(status).tw;

/**
 * Derive an employee's LIVE presence status from a daily attendance record.
 * Returns a STATUS_CONFIG key, or null to fall back to the punctuality status.
 *   ON LUNCH / ON TEA / ON BREAK  → an unfinished break (`*_status === 'INCOMPLETE'`)
 *   CHECKED IN                    → currently checked in
 *   CHECKED OUT                   → checked out (has a check-out time)
 */
export const getLiveStatus = (rec) => {
  if (!rec) return null;
  if ((rec.lunch_status || '').toUpperCase() === 'INCOMPLETE') return 'ON LUNCH';
  if ((rec.tea_status || '').toUpperCase() === 'INCOMPLETE') return 'ON TEA';
  const onOtherBreak = Object.keys(rec).some(
    (k) => k.endsWith('_status') && k !== 'lunch_status' && k !== 'tea_status' && String(rec[k]).toUpperCase() === 'INCOMPLETE'
  );
  if (onOtherBreak) return 'ON BREAK';
  if (rec.is_checked_in) return 'CHECKED IN';
  if (rec.check_out || rec.last_check_out) return 'CHECKED OUT';
  return null;
};

/**
 * ISO start time of the currently-active break (if any) — for live timers.
 */
export const getActiveBreakStart = (rec) => {
  if (!rec) return null;
  return rec.lunch_active_start || rec.tea_active_start ||
    Object.keys(rec).filter((k) => k.endsWith('_active_start')).map((k) => rec[k]).find(Boolean) || null;
};
