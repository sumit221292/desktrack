/**
 * Seed 10-15 test users with salary structures and varied attendance scenarios
 * for local testing of attendance-based payroll.
 *
 * Run: node seed-test-data.js
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Target month for payroll test: April 2026
const YEAR = 2026;
const MONTH = 4;
const DAYS_IN_MONTH = new Date(YEAR, MONTH, 0).getDate(); // 30

// ─── 15 Test Employees with varied salary & attendance scenarios ───
const testEmployees = [
  { code: 'CF-010', first: 'Aarav',    last: 'Sharma',   email: 'aarav@test.in',    dept: 2, desg: 1, basic: 50000, scenario: 'FULL_MONTH' },
  { code: 'CF-011', first: 'Bhavya',   last: 'Verma',    email: 'bhavya@test.in',   dept: 2, desg: 2, basic: 40000, scenario: 'HALF_DAYS' },
  { code: 'CF-012', first: 'Chirag',   last: 'Kapoor',   email: 'chirag@test.in',   dept: 3, desg: 2, basic: 35000, scenario: 'MIXED' },
  { code: 'CF-013', first: 'Diya',     last: 'Mehta',    email: 'diya@test.in',     dept: 1, desg: 3, basic: 30000, scenario: 'ABSENT_HEAVY' },
  { code: 'CF-014', first: 'Eshan',    last: 'Gupta',    email: 'eshan@test.in',    dept: 2, desg: 2, basic: 45000, scenario: 'LATE_COMER' },
  { code: 'CF-015', first: 'Farah',    last: 'Khan',     email: 'farah@test.in',    dept: 2, desg: 3, basic: 32000, scenario: 'PERFECT' },
  { code: 'CF-016', first: 'Gaurav',   last: 'Singh',    email: 'gaurav@test.in',   dept: 3, desg: 2, basic: 55000, scenario: 'FULL_MONTH' },
  { code: 'CF-017', first: 'Harsha',   last: 'Iyer',     email: 'harsha@test.in',   dept: 1, desg: 1, basic: 60000, scenario: 'OVERTIME' },
  { code: 'CF-018', first: 'Ishaan',   last: 'Patel',    email: 'ishaan@test.in',   dept: 2, desg: 3, basic: 28000, scenario: 'ABSENT_HEAVY' },
  { code: 'CF-019', first: 'Janhvi',   last: 'Nair',     email: 'janhvi@test.in',   dept: 3, desg: 2, basic: 42000, scenario: 'HALF_DAYS' },
  { code: 'CF-020', first: 'Karan',    last: 'Rao',      email: 'karan@test.in',    dept: 2, desg: 2, basic: 38000, scenario: 'MIXED' },
  { code: 'CF-021', first: 'Leela',    last: 'Menon',    email: 'leela@test.in',    dept: 1, desg: 3, basic: 25000, scenario: 'NO_STRUCTURE' },
  { code: 'CF-022', first: 'Mayur',    last: 'Joshi',    email: 'mayur@test.in',    dept: 2, desg: 2, basic: 48000, scenario: 'PERFECT' },
  { code: 'CF-023', first: 'Nisha',    last: 'Reddy',    email: 'nisha@test.in',    dept: 3, desg: 3, basic: 33000, scenario: 'LATE_COMER' },
  { code: 'CF-024', first: 'Omkar',    last: 'Pillai',   email: 'omkar@test.in',    dept: 2, desg: 2, basic: 52000, scenario: 'MIXED' },
];

// Password hash for all test users: "Test@123"
const TEST_PASSWORD_HASH = bcrypt.hashSync('Test@123', 10);

// Helpers
const weekdaysOnly = (start, end) => {
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d));
  }
  return days;
};

const isoAt = (y, m, d, h, mn) => new Date(Date.UTC(y, m - 1, d, h - 5, mn - 30)).toISOString(); // IST offset -5:30

const allWorkdays = weekdaysOnly(new Date(YEAR, MONTH - 1, 1), new Date(YEAR, MONTH - 1, DAYS_IN_MONTH));
const today = new Date();
const pastWorkdays = allWorkdays.filter(d => d <= today);

// ─── Generate scenarios ───
function generateScenario(emp, empId) {
  const sessions = [];
  const attendance = [];
  let sessionId = (db.attendance_sessions || []).length;
  let attId = (db.attendance || []).length;

  const maxSess = sessionId + 100;
  const maxAtt = attId + 100;

  const mkAtt = (date, ci, co, status, netMin, grossMin, breakMin = 0, lunch = null, tea = null) => {
    attId++;
    const attRecord = {
      id: attId,
      company_id: 1,
      employee_id: empId,
      attendance_date: date.toISOString().split('T')[0],
      check_in: ci,
      check_out: co,
      last_check_out: co,
      arrival_status: status === 'late' ? 'late' : status === 'halfday' ? 'halfday' : 'on_time',
      gross_minutes: grossMin,
      total_break_minutes: breakMin,
      net_work_minutes: netMin,
      other_break_minutes: 0,
      overtime_minutes: Math.max(0, netMin - 540),
      status: status === 'absent' ? 'ABSENT' : (netMin >= 540 ? 'COMPLETE' : netMin >= 270 ? 'INCOMPLETE' : 'ABSENT'),
      flags: status === 'halfday' ? JSON.stringify(['HALFDAY']) : JSON.stringify([]),
      ai_summary: `Test data - ${status}`,
      working_hours: netMin / 60,
      overtime_hours: Math.max(0, netMin - 540) / 60,
      remarks: null,
      location_metadata: null,
      created_at: new Date().toISOString()
    };
    attendance.push(attRecord);

    sessionId++;
    sessions.push({
      id: sessionId,
      attendance_id: attId,
      company_id: 1,
      employee_id: empId,
      check_in: ci,
      check_out: co,
      duration_minutes: netMin + breakMin,
      created_at: new Date().toISOString()
    });

    return attId;
  };

  const d = pastWorkdays;

  switch (emp.scenario) {
    case 'FULL_MONTH':
      // Present every day, 9h each
      d.forEach(day => {
        mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
              isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 0),
              'on_time', 540, 540, 0);
      });
      break;
    case 'PERFECT':
      // Present every day with proper 9h + breaks
      d.forEach(day => {
        mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
              isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 10),
              'on_time', 540, 550, 10);
      });
      break;
    case 'HALF_DAYS':
      // 50% present, 30% half day, 20% absent
      d.forEach((day, i) => {
        const r = i % 10;
        if (r < 5) {
          mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
                isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 0),
                'on_time', 540, 540, 0);
        } else if (r < 8) {
          mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
                isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 14, 0),
                'halfday', 240, 240, 0);
        }
        // else absent (no record)
      });
      break;
    case 'MIXED':
      // Varied: some late, some half, some full, some absent
      d.forEach((day, i) => {
        const r = i % 5;
        if (r === 0) mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 11, 30),
                           isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 0),
                           'late', 420, 450, 30);
        else if (r === 1) mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
                                isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 0),
                                'on_time', 540, 540, 0);
        else if (r === 2) mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
                                isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 14, 30),
                                'halfday', 270, 270, 0);
        else if (r === 3) mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
                                isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 30),
                                'on_time', 540, 570, 30);
        // r === 4 → absent
      });
      break;
    case 'ABSENT_HEAVY':
      // Only 30% present (lots of absences)
      d.forEach((day, i) => {
        if (i % 3 === 0) {
          mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
                isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 0),
                'on_time', 540, 540, 0);
        }
      });
      break;
    case 'LATE_COMER':
      // Always late, still full time
      d.forEach(day => {
        mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 11, 30),
              isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 20, 30),
              'late', 540, 540, 0);
      });
      break;
    case 'OVERTIME':
      // Works 11h+ daily
      d.forEach(day => {
        mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 9, 30),
              isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 20, 30),
              'on_time', 660, 660, 0);
      });
      break;
    case 'NO_STRUCTURE':
      // Present but no salary structure (will be skipped in payroll)
      d.forEach(day => {
        mkAtt(day, isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 10, 0),
              isoAt(day.getFullYear(), day.getMonth() + 1, day.getDate(), 19, 0),
              'on_time', 540, 540, 0);
      });
      break;
  }

  return { sessions, attendance };
}

// ─── Execute seed ───
let userIdCounter = Math.max(...db.users.map(u => u.id), 0);
let empIdCounter = Math.max(...db.employees.map(e => e.id), 0);
let ssIdCounter = Math.max(...(db.salary_structures || []).map(s => s.id), 0);
let esIdCounter = Math.max(...(db.employee_shifts || []).map(e => e.id), 0);

const existingEmails = new Set(db.users.map(u => u.email));

let addedUsers = 0, addedEmployees = 0, addedStructures = 0, addedAttendance = 0, addedSessions = 0;

for (const emp of testEmployees) {
  if (existingEmails.has(emp.email)) {
    console.log(`Skip ${emp.email} (already exists)`);
    continue;
  }

  // 1. User
  userIdCounter++;
  const user = {
    id: userIdCounter,
    email: emp.email,
    password_hash: TEST_PASSWORD_HASH,
    role: 'EMPLOYEE',
    company_id: 1,
    created_at: new Date().toISOString()
  };
  db.users.push(user);
  addedUsers++;

  // 2. Employee
  empIdCounter++;
  const employee = {
    id: empIdCounter,
    company_id: 1,
    first_name: emp.first,
    last_name: emp.last,
    email: emp.email,
    employee_code: emp.code,
    designation_id: emp.desg,
    department_id: emp.dept,
    salary_info: '{}',
    joining_date: '2024-01-15',
    date_of_birth: '1995-06-20',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    shift_id: 1,
    created_at: new Date().toISOString()
  };
  db.employees.push(employee);
  addedEmployees++;

  // 3. Employee-Shift mapping
  esIdCounter++;
  if (!db.employee_shifts) db.employee_shifts = [];
  db.employee_shifts.push({
    id: esIdCounter,
    employee_id: empIdCounter,
    shift_id: 1,
    company_id: 1,
    effective_from: '2024-01-15'
  });

  // 4. Salary Structure (skip for NO_STRUCTURE scenario)
  if (emp.scenario !== 'NO_STRUCTURE') {
    ssIdCounter++;
    if (!db.salary_structures) db.salary_structures = [];
    db.salary_structures.push({
      id: ssIdCounter,
      employee_id: empIdCounter,
      company_id: 1,
      basic_pay: emp.basic,
      hra: Math.round(emp.basic * 0.4),
      da: Math.round(emp.basic * 0.1),
      conveyance: 1600,
      medical: 1250,
      special_allowance: Math.round(emp.basic * 0.2),
      effective_from: '2024-01-15',
      deductions_json: '{}',
      created_at: new Date().toISOString()
    });
    addedStructures++;
  }

  // 5. Attendance based on scenario
  const { sessions, attendance } = generateScenario(emp, empIdCounter);
  if (!db.attendance) db.attendance = [];
  if (!db.attendance_sessions) db.attendance_sessions = [];
  attendance.forEach(a => db.attendance.push(a));
  sessions.forEach(s => db.attendance_sessions.push(s));
  addedAttendance += attendance.length;
  addedSessions += sessions.length;

  console.log(`✓ Added: ${emp.first} ${emp.last} (${emp.scenario}) — ${attendance.length} attendance records`);
}

// Save
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Users added:           ${addedUsers}`);
console.log(`  Employees added:       ${addedEmployees}`);
console.log(`  Salary structures:     ${addedStructures}`);
console.log(`  Attendance records:    ${addedAttendance}`);
console.log(`  Sessions:              ${addedSessions}`);
console.log(`  Test password:         Test@123`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n📋 Test Scenarios:');
testEmployees.forEach(e => console.log(`  ${e.code} — ${e.first} ${e.last} (${e.scenario}) — Basic: ₹${e.basic}`));
