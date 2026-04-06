const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../db.json');

const poolProps = process.env.DATABASE_URL 
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'desktrack',
      password: process.env.DB_PASSWORD || 'postgres',
      port: process.env.DB_PORT || 5432,
    };

const pool = process.env.NODE_ENV === 'test' ? null : new Pool(poolProps);

if (pool) {
  pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'Asia/Kolkata'");
  });
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
}

// In-memory store for demo mode
const memoryDB = {
  shifts: [
    { 
      id: 1, 
      name: 'General Shift', 
      shift_start_time: '10:00', 
      shift_end_time: '19:00', 
      total_working_hours: 9,
      grace_minutes: 15, 
      late_start_time: '10:16',
      late_end_time: '10:59',
      overlate_start_time: '11:00',
      halfday_start_time: '12:30',
      lunch_allowed_minutes: 45,
      tea_allowed_minutes: 15,
      max_break_minutes: 70,
      company_id: 1,
      created_at: new Date()
    }
  ],
  users: [
    {
      id: 1,
      email: 'priyanka_singh@creativefrenzy.in',
      password_hash: '$2b$10$02dUrTOAzgAOiJTpJTvUo.JTreGkErGjzdjfjIEGCUZlWfPO/SQUO', // Priyanka@123
      role: 'SUPER_ADMIN',
      company_id: 1
    }
  ],
  departments: [
    { id: 1, name: 'Administration', company_id: 1 },
    { id: 2, name: 'Engineering', company_id: 1 },
    { id: 3, name: 'HR', company_id: 1 }
  ],
  designations: [
    { id: 1, name: 'Director', company_id: 1 },
    { id: 2, name: 'Lead Engineer', company_id: 1 },
    { id: 3, name: 'Developer', company_id: 1 },
    { id: 4, name: 'HR Manager', company_id: 1 }
  ],
  employees: [
    {
      id: 1,
      company_id: 1,
      first_name: 'Priyanka',
      last_name: 'Singh',
      email: 'priyanka_singh@creativefrenzy.in',
      employee_code: 'CF-001',
      designation_id: 1,
      department_id: 1,
      salary_info: '{}',
      joining_date: '2024-01-01',
      date_of_birth: '1995-04-15',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      shift_id: 1
    }
  ],
  attendance: [],
  attendance_sessions: [],
  attendance_events: [],
  employee_shifts: [
    { id: 1, employee_id: 1, shift_id: 1, company_id: 1, effective_from: '2024-01-01' },
    { id: 2, employee_id: 2, shift_id: 1, company_id: 1, effective_from: '2024-01-01' }
  ],
  companies: [
    { id: 1, name: 'Creative Frenzy', slug: 'creativefrenzy', is_active: true }
  ],
  allowed_domains: [
    { id: 1, domain: 'creativefrenzy.in', company_id: 1 },
    { id: 2, domain: 'gmail.com', company_id: 1 }
  ],
  custom_fields: [],
  custom_field_values: [],
  company_settings: [],
  salary_structures: [],
  salary_structure_history: [],
  payroll_records: [],
  form16_records: [],
  tax_declarations: []
};

const DEFAULT_SALARY_STRUCTURES = [
  { id: 1, employee_id: 1, company_id: 1, basic_pay: 30000, hra: 15000, da: 3000, conveyance: 1600, medical: 1250, special_allowance: 5000, effective_from: '2024-01-01' },
  { id: 2, employee_id: 2, company_id: 1, basic_pay: 25000, hra: 12500, da: 2500, conveyance: 1600, medical: 1250, special_allowance: 3000, effective_from: '2024-01-01' }
];

const DEFAULT_CUSTOM_FIELDS = [
  { id: 1, module_name: 'employees', field_name: 'First Name', field_type: 'text', is_required: true, company_id: 1, field_id: 'first_name' },
  { id: 2, module_name: 'employees', field_name: 'Last Name', field_type: 'text', is_required: true, company_id: 1, field_id: 'last_name' },
  { id: 3, module_name: 'employees', field_name: 'Work Email', field_type: 'text', is_required: true, company_id: 1, field_id: 'email' },
  { id: 4, module_name: 'employees', field_name: 'Employee ID', field_type: 'text', is_required: true, company_id: 1, field_id: 'employee_code' },
  { id: 5, module_name: 'employees', field_name: 'Department', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'department_id' },
  { id: 6, module_name: 'employees', field_name: 'Designation', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'designation_id' },
  { id: 7, module_name: 'employees', field_name: 'Assigned Shift', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'shift_id' },
  { id: 8, module_name: 'employees', field_name: 'Joining Date', field_type: 'date', is_required: true, company_id: 1, field_id: 'joining_date' },
  { id: 9, module_name: 'employees', field_name: 'Role', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'role', options: '[{"label":"Employee","value":"EMPLOYEE"},{"label":"HR","value":"HR"},{"label":"Manager","value":"MANAGER"},{"label":"Super Admin","value":"SUPER_ADMIN"}]' },
  { id: 10, module_name: 'employees', field_name: 'Date of Birth', field_type: 'date', is_required: false, company_id: 1, field_id: 'date_of_birth' }
];

const db = {
  query: async (text, params) => {
    if (process.env.NODE_ENV === 'test' && global.mockQuery) {
      return global.mockQuery(text, params);
    }

    try {
      // Try real database first
      if (pool) {
        try {
          return await pool.query(text, params);
        } catch (dbErr) {
          console.warn('PostgreSQL Query failed, falling back to Memory DB:', dbErr.message);
        }
      }
      throw new Error('Using Memory DB');
    } catch (err) {
      const queryText = text.toLowerCase().replace(/\s+/g, ' ').trim();
      console.log(`[MockDB] Running Query: ${queryText} | Attendance Count: ${memoryDB.attendance.length}`);
      
      let resultRows = [];
      let rowCount = 0;

      const q = queryText;

      // Helper: convert Date objects to ISO strings for consistent storage
      const toISO = v => v instanceof Date ? v.toISOString() : v;

      // --- 1. WRITE OPERATIONS ---
      try {
        // [INSERT] Attendance
        if (q.includes('insert into attendance (')) {
          const parseJson = v => { try { return typeof v === 'string' ? JSON.parse(v) : (v || {}); } catch { return v; } };
          let newRecord;
          if (params.length >= 18) {
            // updateAttendance dummy/manual INSERT: 18 params
            newRecord = {
              id: memoryDB.attendance.length > 0 ? Math.max(...memoryDB.attendance.map(a => a.id)) + 1 : 1,
              company_id: params[0], employee_id: params[1], attendance_date: toISO(params[2]),
              check_in: toISO(params[3]), check_out: toISO(params[4]), last_check_out: toISO(params[4]),
              arrival_status: params[5],
              gross_minutes: params[6] || 0, total_break_minutes: params[7] || 0,
              net_work_minutes: params[8] || 0, other_break_minutes: params[9] || 0,
              overtime_minutes: params[10] || 0, working_hours: params[11] || 0, overtime_hours: params[12] || 0,
              status: params[13] || 'INCOMPLETE', flags: parseJson(params[14]),
              ai_summary: params[15] || '', remarks: params[16] || '',
              location_metadata: parseJson(params[17]),
              created_at: new Date()
            };
          } else {
            // checkIn INSERT: 13 params
            newRecord = {
              id: memoryDB.attendance.length > 0 ? Math.max(...memoryDB.attendance.map(a => a.id)) + 1 : 1,
              company_id: params[0], employee_id: params[1],
              attendance_date: toISO(params[2]), check_in: toISO(params[3]),
              arrival_status: params[4],
              total_break_minutes: params[5] || 0, gross_minutes: params[6] || 0,
              net_work_minutes: params[7] || 0, overtime_minutes: params[8] || 0,
              status: params[9] || 'INCOMPLETE',
              flags: parseJson(params[10]),
              ai_summary: params[11] || '',
              location_metadata: parseJson(params[12]),
              created_at: new Date()
            };
          }
          memoryDB.attendance.push(newRecord);
          saveToDisk();
          resultRows = [newRecord];
          rowCount = 1;
        }
        // [UPDATE] Attendance
        else if (q.includes('update attendance set')) {
          let attId, compId;
          const parseJson = v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } };

          if (q.includes('check_in =') && params.length >= 14) {
            // updateAttendance: check_in=$1, check_out=$2, gross=$3, break=$4, net=$5, ot=$6, status=$7, flags=$8, ai=$9, other_break=$10, loc=$11, remarks=$12, id=$13, company=$14
            attId = params[12];
            compId = params[13];
            const index = memoryDB.attendance.findIndex(a => a.id == attId && a.company_id == compId);
            if (index !== -1) {
              memoryDB.attendance[index] = {
                ...memoryDB.attendance[index],
                check_in: toISO(params[0]), check_out: toISO(params[1]), last_check_out: toISO(params[1]),
                gross_minutes: params[2], total_break_minutes: params[3],
                net_work_minutes: params[4], overtime_minutes: params[5],
                status: params[6], flags: parseJson(params[7]),
                ai_summary: params[8], other_break_minutes: params[9],
                location_metadata: parseJson(params[10]), remarks: params[11]
              };
              saveToDisk();
              resultRows = [memoryDB.attendance[index]];
              rowCount = 1;
            }
          } else {
            // checkOut: check_out=$1, last_check_out=$1, gross=$2, break=$3, net=$4, ot=$5, status=$6, flags=$7, ai=$8, other_break=$9, loc=$10, id=$11, company=$12
            attId = params[10];
            compId = params[11];
            const index = memoryDB.attendance.findIndex(a => a.id == attId && (compId == null || a.company_id == compId));
            if (index !== -1) {
              memoryDB.attendance[index] = {
                ...memoryDB.attendance[index],
                check_out: toISO(params[0]), last_check_out: toISO(params[0]),
                gross_minutes: params[1], total_break_minutes: params[2],
                net_work_minutes: params[3], overtime_minutes: params[4],
                status: params[5], flags: parseJson(params[6]),
                ai_summary: params[7], other_break_minutes: params[8],
                location_metadata: parseJson(params[9])
              };
              saveToDisk();
              resultRows = [memoryDB.attendance[index]];
              rowCount = 1;
            }
          }
        }
        // [DELETE] Attendance
        else if (q.includes('delete from attendance')) {
          if (q.includes('employee_id =')) {
            const empId = params[0];
            const companyId = params[1];
            memoryDB.attendance = memoryDB.attendance.filter(a => !(a.employee_id == empId && a.company_id == companyId));
          } else {
            const id = params[0];
            memoryDB.attendance = memoryDB.attendance.filter(a => a.id != id);
          }
          saveToDisk();
          rowCount = 1;
        }
        // [INSERT] Attendance Events
        else if (q.includes('insert into attendance_events')) {
          const newEvent = {
            id: memoryDB.attendance_events?.length > 0 ? Math.max(...memoryDB.attendance_events.map(e => e.id)) + 1 : 1,
            company_id: params[0],
            employee_id: params[1],
            attendance_id: params[2],
            event_type: params[3],
            event_time: params[4],
            created_at: new Date()
          };
          if (!memoryDB.attendance_events) memoryDB.attendance_events = [];
          memoryDB.attendance_events.push(newEvent);
          saveToDisk();
          resultRows = [newEvent];
          rowCount = 1;
        }
        // [INSERT] Attendance Sessions
        else if (q.includes('insert into attendance_sessions')) {
          const newSession = {
            id: memoryDB.attendance_sessions?.length > 0 ? Math.max(...memoryDB.attendance_sessions.map(s => s.id)) + 1 : 1,
            attendance_id: params[0],
            company_id: params[1],
            employee_id: params[2],
            check_in: toISO(params[3]),
            check_out: null,
            duration_minutes: 0,
            created_at: new Date().toISOString()
          };
          if (!memoryDB.attendance_sessions) memoryDB.attendance_sessions = [];
          memoryDB.attendance_sessions.push(newSession);
          saveToDisk();
          resultRows = [newSession];
          rowCount = 1;
        }
        // [UPDATE] Attendance Sessions
        else if (q.includes('update attendance_sessions')) {
          const sessionId = params[2];
          const index = memoryDB.attendance_sessions.findIndex(s => s.id == sessionId);
          if (index !== -1) {
            memoryDB.attendance_sessions[index] = {
              ...memoryDB.attendance_sessions[index],
              check_out: toISO(params[0]),
              duration_minutes: params[1]
            };
            saveToDisk();
            resultRows = [memoryDB.attendance_sessions[index]];
            rowCount = 1;
          }
        }
        // [INSERT] Shifts
        else if (q.includes('insert into shifts')) {
          const newShift = {
            id: memoryDB.shifts.length > 0 ? Math.max(...memoryDB.shifts.map(s => s.id)) + 1 : 1,
            company_id: params[0],
            name: params[1],
            shift_start_time: params[2],
            shift_end_time: params[3],
            total_working_hours: parseFloat(params[4]),
            grace_minutes: parseInt(params[5]) || 15,
            late_start_time: params[6],
            late_end_time: params[7],
            overlate_start_time: params[8],
            halfday_start_time: params[9],
            lunch_allowed_minutes: parseInt(params[10]) || 45,
            tea_allowed_minutes: parseInt(params[11]) || 15,
            max_break_minutes: parseInt(params[12]) || 70,
            created_at: new Date()
          };
          memoryDB.shifts.push(newShift);
          saveToDisk();
          resultRows = [newShift];
          rowCount = 1;
        }
        // [UPDATE] Shifts
        else if (q.includes('update shifts')) {
          // Params: name=$1, start=$2, end=$3, hours=$4, grace=$5, late_s=$6, late_e=$7, overlate=$8, halfday=$9, lunch=$10, tea=$11, max_break=$12, id=$13, company=$14
          const id = params[12]; // $13=id (0-indexed: params[12])
          const index = memoryDB.shifts.findIndex(s => s.id == id);
          if (index !== -1) {
            memoryDB.shifts[index] = {
              ...memoryDB.shifts[index],
              name: params[0],
              shift_start_time: params[1],
              shift_end_time: params[2],
              total_working_hours: parseFloat(params[3]),
              grace_minutes: parseInt(params[4]),
              late_start_time: params[5],
              late_end_time: params[6],
              overlate_start_time: params[7],
              halfday_start_time: params[8],
              lunch_allowed_minutes: parseInt(params[9]) || 45,
              tea_allowed_minutes: parseInt(params[10]) || 15,
              max_break_minutes: parseInt(params[11]) || 70
            };
            saveToDisk();
            resultRows = [memoryDB.shifts[index]];
            rowCount = 1;
          }
        }
        // [DELETE] Shifts
        else if (q.includes('delete from shifts')) {
          const id = params[0];
          const shift = memoryDB.shifts.find(s => s.id == id);
          memoryDB.shifts = memoryDB.shifts.filter(s => s.id != id);
          saveToDisk();
          resultRows = shift ? [shift] : [];
          rowCount = resultRows.length;
        }
        // [INSERT] Departments
        else if (q.includes('insert into departments')) {
          const newDept = {
            id: memoryDB.departments.length > 0 ? Math.max(...memoryDB.departments.map(d => d.id)) + 1 : 1,
            company_id: params[0],
            name: params[1],
            created_at: new Date()
          };
          memoryDB.departments.push(newDept);
          saveToDisk();
          resultRows = [newDept];
          rowCount = 1;
        }
        // [UPDATE] Departments
        else if (q.includes('update departments set')) {
          const id = params[1];
          const companyId = params[2];
          const index = memoryDB.departments.findIndex(d => d.id == id && d.company_id == companyId);
          if (index !== -1) {
            memoryDB.departments[index].name = params[0];
            saveToDisk();
            resultRows = [memoryDB.departments[index]];
            rowCount = 1;
          }
        }
        // [DELETE] Departments
        else if (q.includes('delete from departments')) {
          const id = params[0];
          const companyId = params[1];
          const dept = memoryDB.departments.find(d => d.id == id && d.company_id == companyId);
          memoryDB.departments = memoryDB.departments.filter(d => !(d.id == id && d.company_id == companyId));
          saveToDisk();
          resultRows = dept ? [dept] : [];
          rowCount = resultRows.length;
        }
        // [INSERT] Designations
        else if (q.includes('insert into designations')) {
          const newDesg = {
            id: memoryDB.designations.length > 0 ? Math.max(...memoryDB.designations.map(d => d.id)) + 1 : 1,
            company_id: params[0],
            name: params[1],
            created_at: new Date()
          };
          memoryDB.designations.push(newDesg);
          saveToDisk();
          resultRows = [newDesg];
          rowCount = 1;
        }
        // [UPDATE] Designations
        else if (q.includes('update designations set')) {
          const id = params[1];
          const companyId = params[2];
          const index = memoryDB.designations.findIndex(d => d.id == id && d.company_id == companyId);
          if (index !== -1) {
            memoryDB.designations[index].name = params[0];
            saveToDisk();
            resultRows = [memoryDB.designations[index]];
            rowCount = 1;
          }
        }
        // [DELETE] Designations
        else if (q.includes('delete from designations')) {
          const id = params[0];
          const companyId = params[1];
          const desg = memoryDB.designations.find(d => d.id == id && d.company_id == companyId);
          memoryDB.designations = memoryDB.designations.filter(d => !(d.id == id && d.company_id == companyId));
          saveToDisk();
          resultRows = desg ? [desg] : [];
          rowCount = resultRows.length;
        }
        // [INSERT] Employees
        else if (q.includes('insert into employees')) {
          const hasDoB = q.includes('date_of_birth');
          const newEmp = {
            id: memoryDB.employees.length > 0 ? Math.max(...memoryDB.employees.map(e => e.id)) + 1 : 1,
            company_id: params[0],
            first_name: params[1],
            last_name: params[2],
            email: params[3],
            employee_code: params[4],
            designation_id: params[5],
            department_id: params[6],
            salary_info: typeof params[7] === 'string' ? params[7] : JSON.stringify(params[7] || {}),
            joining_date: params[8],
            date_of_birth: hasDoB ? (params[9] || null) : null,
            shift_id: hasDoB ? params[10] : params[9],
            role: (hasDoB ? params[11] : params[10]) || 'EMPLOYEE',
            status: (hasDoB ? params[12] : params[11]) || 'ACTIVE',
            created_at: new Date()
          };
          memoryDB.employees.push(newEmp);
          saveToDisk();
          resultRows = [newEmp];
          rowCount = 1;
        }
        // [UPDATE] Employees
        else if (q.includes('update employees set')) {
          const hasDoB = q.includes('date_of_birth');
          const id = hasDoB ? params[12] : params[11];
          const index = memoryDB.employees.findIndex(e => e.id == id);
          if (index !== -1) {
            memoryDB.employees[index] = {
              ...memoryDB.employees[index],
              first_name: params[0],
              last_name: params[1],
              email: params[2],
              employee_code: params[3],
              designation_id: params[4],
              department_id: params[5],
              salary_info: typeof params[6] === 'string' ? params[6] : JSON.stringify(params[6] || {}),
              joining_date: params[7],
              date_of_birth: hasDoB ? (params[8] || null) : memoryDB.employees[index].date_of_birth,
              shift_id: hasDoB ? params[9] : params[8],
              status: hasDoB ? params[10] : params[9],
              role: hasDoB ? params[11] : params[10]
            };
            saveToDisk();
            resultRows = [memoryDB.employees[index]];
            rowCount = 1;
          }
        }
        // [DELETE] Employees
        else if (q.includes('delete from employees')) {
          const id = params[0];
          const emp = memoryDB.employees.find(e => e.id == id);
          memoryDB.employees = memoryDB.employees.filter(e => e.id != id);
          saveToDisk();
          resultRows = emp ? [emp] : [];
          rowCount = resultRows.length;
        }
        // [UPDATE] Users (role sync)
        else if (q.includes('update users set')) {
          const role = params[0];
          const email = params[1];
          const companyId = params[2];
          const index = memoryDB.users.findIndex(u => String(u.email).toLowerCase() === String(email).toLowerCase() && u.company_id == companyId);
          if (index !== -1) {
            memoryDB.users[index].role = role;
            saveToDisk();
            resultRows = [memoryDB.users[index]];
            rowCount = 1;
          }
        }
        // [INSERT] Users
        else if (q.includes('insert into users')) {
          const newUser = {
            id: memoryDB.users.length > 0 ? Math.max(...memoryDB.users.map(u => u.id)) + 1 : 1,
            email: params[0],
            password_hash: params[1],
            role: params[2],
            company_id: params[3],
            created_at: new Date()
          };
          memoryDB.users.push(newUser);
          saveToDisk();
          resultRows = [newUser];
          rowCount = 1;
        }
        // [INSERT] Custom Field Values (ON CONFLICT)
        else if (q.includes('insert into custom_field_values')) {
          if (!memoryDB.custom_field_values) memoryDB.custom_field_values = [];
          const companyId = params[0];
          const entityId = params[1];
          const fieldId = params[2];
          const value = params[3];
          
          const index = memoryDB.custom_field_values.findIndex(v => v.entity_id == entityId && v.field_id == fieldId);
          if (index !== -1) {
            memoryDB.custom_field_values[index].value = value;
            resultRows = [memoryDB.custom_field_values[index]];
          } else {
            const newValue = { id: memoryDB.custom_field_values.length + 1, company_id: companyId, entity_id: entityId, field_id: fieldId, value };
            memoryDB.custom_field_values.push(newValue);
            resultRows = [newValue];
          }
          saveToDisk();
          rowCount = 1;
        }
        // [UPSERT] Company Settings
        else if (q.includes('insert into company_settings')) {
          if (!memoryDB.company_settings) memoryDB.company_settings = [];
          const companyId = params[0], key = params[1], value = params[2];
          const idx = memoryDB.company_settings.findIndex(s => s.company_id == companyId && s.setting_key === key);
          if (idx !== -1) {
            memoryDB.company_settings[idx].setting_value = value;
            resultRows = [memoryDB.company_settings[idx]];
          } else {
            const newSetting = { id: memoryDB.company_settings.length + 1, company_id: companyId, setting_key: key, setting_value: value };
            memoryDB.company_settings.push(newSetting);
            resultRows = [newSetting];
          }
          saveToDisk();
          rowCount = 1;
        }
        // [INSERT] Custom Fields
        else if (q.includes('insert into custom_fields')) {
          const newField = {
            id: memoryDB.custom_fields.length > 0 ? Math.max(...memoryDB.custom_fields.map(f => f.id)) + 1 : 1,
            module_name: params[0],
            field_name: params[1],
            field_type: params[2],
            is_required: params[3],
            options: params[4],
            company_id: params[5],
            field_id: params[6] || ('custom_' + params[1].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')),
            created_at: new Date()
          };
          memoryDB.custom_fields.push(newField);
          saveToDisk();
          resultRows = [newField];
          rowCount = 1;
        }
        // [UPDATE] Custom Fields
        else if (q.includes('update custom_fields set')) {
          const id = params[5];
          const companyId = params[6];
          const index = memoryDB.custom_fields.findIndex(f => f.id == id && f.company_id == companyId);
          if (index !== -1) {
            memoryDB.custom_fields[index] = {
              ...memoryDB.custom_fields[index],
              module_name: params[0],
              field_name: params[1],
              field_type: params[2],
              is_required: params[3],
              options: params[4]
            };
            saveToDisk();
            resultRows = [memoryDB.custom_fields[index]];
            rowCount = 1;
          }
        }
        // [DELETE] Custom Fields
        else if (q.includes('delete from custom_fields')) {
          const id = params[0];
          const companyId = params[1];
          memoryDB.custom_fields = memoryDB.custom_fields.filter(f => !(f.id == id && f.company_id == companyId));
          saveToDisk();
          rowCount = 1;
        }
        // [INSERT] Salary Structures
        else if (q.includes('insert into salary_structures')) {
          const newSS = {
            id: (memoryDB.salary_structures || []).length > 0 ? Math.max(...memoryDB.salary_structures.map(s => s.id)) + 1 : 1,
            employee_id: params[0],
            company_id: params[1],
            basic_pay: params[2],
            hra: params[3],
            da: params[4],
            conveyance: params[5],
            medical: params[6],
            special_allowance: params[7],
            effective_from: params[8],
            deductions_json: params[9] || null,
            created_at: new Date()
          };
          if (!memoryDB.salary_structures) memoryDB.salary_structures = [];
          memoryDB.salary_structures.push(newSS);
          saveToDisk();
          resultRows = [newSS];
          rowCount = 1;
        }
        // [UPDATE] Salary Structures
        else if (q.includes('update salary_structures set')) {
          const empId = params[8];
          const compId = params[9];
          const index = (memoryDB.salary_structures || []).findIndex(s => s.employee_id == empId && s.company_id == compId);
          if (index !== -1) {
            memoryDB.salary_structures[index] = {
              ...memoryDB.salary_structures[index],
              basic_pay: params[0],
              hra: params[1],
              da: params[2],
              conveyance: params[3],
              medical: params[4],
              special_allowance: params[5],
              effective_from: params[6],
              deductions_json: params[7] || memoryDB.salary_structures[index].deductions_json
            };
            saveToDisk();
            resultRows = [memoryDB.salary_structures[index]];
            rowCount = 1;
          }
        }
        // [INSERT] Payroll Records
        else if (q.includes('insert into payroll_records')) {
          const newPR = {
            id: (memoryDB.payroll_records || []).length > 0 ? Math.max(...memoryDB.payroll_records.map(p => p.id)) + 1 : 1,
            employee_id: params[0],
            company_id: params[1],
            month: params[2],
            year: params[3],
            basic_pay: params[4],
            hra: params[5],
            da: params[6],
            conveyance: params[7],
            medical: params[8],
            special_allowance: params[9],
            bonus: params[10],
            gross_salary: params[11],
            pf: params[12],
            esi: params[13],
            professional_tax: params[14],
            tds: params[15],
            total_deductions: params[16],
            net_salary: params[17],
            status: params[18] || 'PROCESSED',
            created_at: new Date()
          };
          if (!memoryDB.payroll_records) memoryDB.payroll_records = [];
          memoryDB.payroll_records.push(newPR);
          saveToDisk();
          resultRows = [newPR];
          rowCount = 1;
        }
        // [UPDATE] Payroll Records
        else if (q.includes('update payroll_records set')) {
          const prId = params[15];
          const prCompId = params[16];
          if (!memoryDB.payroll_records) memoryDB.payroll_records = [];
          const index = memoryDB.payroll_records.findIndex(p => p.id == prId && p.company_id == prCompId);
          if (index !== -1) {
            memoryDB.payroll_records[index] = {
              ...memoryDB.payroll_records[index],
              basic_pay: params[0],
              hra: params[1],
              da: params[2],
              conveyance: params[3],
              medical: params[4],
              special_allowance: params[5],
              bonus: params[6],
              gross_salary: params[7],
              pf: params[8],
              esi: params[9],
              professional_tax: params[10],
              tds: params[11],
              total_deductions: params[12],
              net_salary: params[13],
              status: params[14]
            };
            saveToDisk();
            resultRows = [memoryDB.payroll_records[index]];
            rowCount = 1;
          }
        }
        // [INSERT] Form16 Records
        else if (q.includes('insert into form16_records')) {
          const newF16 = {
            id: (memoryDB.form16_records || []).length > 0 ? Math.max(...memoryDB.form16_records.map(f => f.id)) + 1 : 1,
            employee_id: params[0],
            company_id: params[1],
            financial_year: params[2],
            metadata: typeof params[3] === 'string' ? params[3] : JSON.stringify(params[3] || {}),
            created_at: new Date()
          };
          if (!memoryDB.form16_records) memoryDB.form16_records = [];
          memoryDB.form16_records.push(newF16);
          saveToDisk();
          resultRows = [newF16];
          rowCount = 1;
        }
        // [DELETE] Form16 Records
        else if (q.includes('delete from form16_records')) {
          const f16Id = params[0];
          const f16CompId = params[1];
          if (!memoryDB.form16_records) memoryDB.form16_records = [];
          const f16 = memoryDB.form16_records.find(f => f.id == f16Id && f.company_id == f16CompId);
          memoryDB.form16_records = memoryDB.form16_records.filter(f => !(f.id == f16Id && f.company_id == f16CompId));
          saveToDisk();
          resultRows = f16 ? [f16] : [];
          rowCount = resultRows.length;
        }
        // [INSERT] Salary Structure History
        else if (q.includes('insert into salary_structure_history')) {
          if (!memoryDB.salary_structure_history) memoryDB.salary_structure_history = [];
          const newH = {
            id: memoryDB.salary_structure_history.length > 0 ? Math.max(...memoryDB.salary_structure_history.map(h => h.id)) + 1 : 1,
            original_id: params[0], employee_id: params[1], company_id: params[2],
            basic_pay: params[3], hra: params[4], da: params[5], conveyance: params[6],
            medical: params[7], special_allowance: params[8],
            effective_from: params[9], effective_to: params[10],
            archived_at: new Date()
          };
          memoryDB.salary_structure_history.push(newH);
          saveToDisk();
          resultRows = [newH]; rowCount = 1;
        }
        // [INSERT/UPSERT] Tax Declarations
        else if (q.includes('insert into tax_declarations')) {
          if (!memoryDB.tax_declarations) memoryDB.tax_declarations = [];
          const [empId, compId, fy, regime, stdNew, stdOld, cess, slabs, c80c, c80d, c80g, c80e, hra, lta, nps, other, submitted, submittedAt] = params;
          const existIdx = memoryDB.tax_declarations.findIndex(d => d.employee_id == empId && d.company_id == compId && d.financial_year == fy);
          if (existIdx !== -1) {
            memoryDB.tax_declarations[existIdx] = {
              ...memoryDB.tax_declarations[existIdx],
              regime, std_deduction_new: stdNew, std_deduction_old: stdOld, cess_rate: cess,
              slabs_json: slabs, sec80c: c80c, sec80d: c80d, sec80g: c80g, sec80e: c80e,
              hra_claimed: hra, lta, nps, other_deductions: other,
              submitted: submitted === true || submitted === 'true',
              submitted_at: submittedAt || memoryDB.tax_declarations[existIdx].submitted_at,
              updated_at: new Date()
            };
            saveToDisk();
            resultRows = [memoryDB.tax_declarations[existIdx]];
          } else {
            const newTD = {
              id: memoryDB.tax_declarations.length > 0 ? Math.max(...memoryDB.tax_declarations.map(d => d.id)) + 1 : 1,
              employee_id: empId, company_id: compId, financial_year: fy,
              regime, std_deduction_new: stdNew, std_deduction_old: stdOld, cess_rate: cess,
              slabs_json: slabs, sec80c: c80c, sec80d: c80d, sec80g: c80g, sec80e: c80e,
              hra_claimed: hra, lta, nps, other_deductions: other,
              submitted: submitted === true || submitted === 'true',
              submitted_at: submittedAt || null,
              created_at: new Date(), updated_at: new Date()
            };
            memoryDB.tax_declarations.push(newTD);
            saveToDisk();
            resultRows = [newTD];
          }
          rowCount = 1;
        }
        // [INSERT] Allowed Domains
        else if (q.includes('insert into allowed_domains')) {
          const newDomain = { id: memoryDB.allowed_domains.length + 1, domain: params[0], company_id: params[1], created_at: new Date() };
          memoryDB.allowed_domains.push(newDomain);
          saveToDisk();
          resultRows = [newDomain];
          rowCount = 1;
        }
        // [DELETE] Allowed Domains
        else if (q.includes('delete from allowed_domains')) {
          const id = params[0];
          memoryDB.allowed_domains = memoryDB.allowed_domains.filter(d => d.id != id);
          saveToDisk();
          rowCount = 1;
        }

      // --- 2. READ Operations (Match these second) ---

        // [SELECT] Attendance Events (MUST be before 'from attendance' checks!)
        else if (q.includes('from attendance_events')) {
          let res = memoryDB.attendance_events || [];
          if (q.includes('attendance_id =')) {
            res = res.filter(e => e.attendance_id == params[0]);
          } else if (q.includes('company_id') && q.includes('event_time')) {
            const day = String(params[1]).split('T')[0];
            res = res.filter(e => e.company_id == params[0] && String(e.event_time).split('T')[0] === day);
          }
          resultRows = res;
          rowCount = res.length;
        }
        // [SELECT] Attendance Sessions (MUST be before 'from attendance' checks!)
        else if (q.includes('from attendance_sessions')) {
          let res = memoryDB.attendance_sessions || [];
          if (q.includes('attendance_id =') && !q.includes('company_id')) {
            res = res.filter(s => s.attendance_id == params[0]);
          } else if (q.includes('company_id') && (q.includes('check_in::date') || q.includes('check_in like'))) {
            const day = String(params[1]).split('T')[0];
            res = res.filter(s => s.company_id == params[0] && String(s.check_in).split('T')[0] === day);
          } else if (q.includes('attendance_id =')) {
            res = res.filter(s => s.attendance_id == params[0]);
          }
          if (q.includes('check_out is null')) res = res.filter(s => !s.check_out);
          resultRows = res;
          rowCount = res.length;
        }
        // [SELECT] Attendance (with JOIN to shifts — for checkOut)
        else if (q.includes('from attendance') && q.includes('join shifts')) {
          const idMatch = q.match(/a\.id\s*=\s*\$(\d+)/) || q.match(/id\s*=\s*\$(\d+)/);
          const idParam = idMatch ? params[parseInt(idMatch[1]) - 1] : params[0];
          const att = memoryDB.attendance.find(a => a.id == idParam);
          if (att) {
            const emp = memoryDB.employees.find(e => e.id == att.employee_id) || {};
            const shift = memoryDB.shifts.find(s => s.id == (emp.shift_id || 1)) || memoryDB.shifts[0];
            resultRows = [{ ...att, ...shift, id: att.id }];
            rowCount = 1;
          }
        }
        // [SELECT] Attendance (by date — getDailyAttendance / checkIn existing check / monthly range)
        else if (q.includes('from attendance') && (q.includes('check_in::date') || q.includes('attendance_date') || q.includes('check_in like'))) {
          const isRange = q.includes('>=') && q.includes('<=');
          const hasEmployeeFilter = q.includes('employee_id');

          if (isRange) {
            // Range query: company_id=$1, startDate=$2, endDate=$3
            const compId = params[0];
            const startDay = String(params[1]).split('T')[0];
            const endDay = String(params[2]).split('T')[0];
            resultRows = memoryDB.attendance.filter(a => {
              if (a.company_id != compId) return false;
              const aDate = String(a.attendance_date || a.check_in).split('T')[0];
              return aDate >= startDay && aDate <= endDay;
            });
          } else {
            // Single date query
            const dateParam = params[params.length - 1];
            const day = String(dateParam).replace(/%/g, '').split('T')[0];
            resultRows = memoryDB.attendance.filter(a => {
              const aDate = String(a.attendance_date || a.check_in).split('T')[0];
              if (aDate !== day) return false;
              if (hasEmployeeFilter && params.length >= 3) {
                return a.employee_id == params[0] && a.company_id == params[1];
              }
              return a.company_id == params[0];
            });
          }
          rowCount = resultRows.length;
        }
        else if (q.includes('from employee_shifts')) {
          let result = [...(memoryDB.employee_shifts || [])];
          if (q.includes('join shifts')) {
            result = result.map(es => {
              const s = (memoryDB.shifts || []).find(sh => sh.id == es.shift_id);
              return { ...es, ...(s || {}), id: es.id };
            });
          }
          if (q.includes('employee_id =')) result = result.filter(es => es.employee_id == params[0]);
          resultRows = result;
          rowCount = result.length;
        }
        else if (q.includes('from shifts')) {
          resultRows = memoryDB.shifts.filter(s => (params[0] ? s.company_id == params[0] : true));
          rowCount = resultRows.length;
        }
        // [SELECT] Employees (with JOINs)
        else if (q.includes('from employees')) {
          let result = memoryDB.employees.map(e => {
            const dept = memoryDB.departments.find(d => d.id == e.department_id);
            const desg = memoryDB.designations.find(d => d.id == e.designation_id);
            const shift = memoryDB.shifts.find(s => s.id == (e.shift_id || 1));
            return {
              ...e,
              department_name: dept ? dept.name : 'Unknown',
              designation_name: desg ? desg.name : 'Unknown',
              shift_name: shift ? shift.name : 'Standard'
            };
          });
          
          if (q.includes('where e.id =') || q.includes('where id =')) {
            const idMatch = q.match(/id\s*=\s*\$(\d+)/);
            const idParam = idMatch ? params[parseInt(idMatch[1]) - 1] : params[0];
            result = result.filter(e => e.id == idParam);
          } else if (q.includes('email =')) {
            result = result.filter(e => String(e.email || '').toLowerCase() === String(params[0] || '').toLowerCase());
          } else {
            result = result.filter(e => e.company_id == params[0]);
          }
          // Filter by status if present in query
          if (q.includes('status =')) {
            const statusMatch = q.match(/status\s*=\s*\$(\d+)/);
            if (statusMatch) {
              const statusParam = params[parseInt(statusMatch[1]) - 1];
              result = result.filter(e => e.status === statusParam);
            }
          }

          resultRows = result;
          rowCount = result.length;
        }
        // [SELECT] COUNT(*) handler (for Dashboard)
        else if (q.includes('count(*) as count')) {
          let target = [];
          if (q.includes('from employees')) target = memoryDB.employees;
          else if (q.includes('from custom_fields')) target = memoryDB.custom_fields;
          else if (q.includes('from attendance')) target = memoryDB.attendance;
          
          let filtered = target.filter(item => item.company_id == params[0]);
          if (q.includes('module_name =')) filtered = filtered.filter(f => f.module_name == params[1]);
          
          resultRows = [{ count: filtered.length }];
          rowCount = 1;
        }
        else if (q.includes('from users')) {
          resultRows = memoryDB.users.filter(u => 
            (q.includes('email =') ? String(u.email).toLowerCase() === String(params[0]).toLowerCase() : u.id == params[0])
            && (params[1] ? u.company_id == params[1] : true)
          );
          rowCount = resultRows.length;
        }
        else if (q.includes('from departments')) {
          resultRows = memoryDB.departments.filter(d => {
            if (q.includes('company_id =') && params[0]) return d.company_id == params[0];
            return true;
          });
          rowCount = resultRows.length;
        }
        else if (q.includes('from designations')) {
          resultRows = memoryDB.designations.filter(d => {
            if (q.includes('company_id =') && params[0]) return d.company_id == params[0];
            return true;
          });
          rowCount = resultRows.length;
        }
        else if (q.includes('from companies')) {
          resultRows = memoryDB.companies.filter(c => String(c.slug).toLowerCase() === String(params[0]).toLowerCase());
          rowCount = resultRows.length;
        }
        else if (q.includes('from allowed_domains')) {
          let result = [...memoryDB.allowed_domains];
          if (q.includes('company_id =') && !q.includes('domain =')) {
            // Settings route: WHERE company_id = $1
            result = result.filter(d => d.company_id == params[0]);
          } else if (q.includes('domain =')) {
            // Auth/lookup route: WHERE domain = $1
            result = result.filter(d => String(d.domain).toLowerCase() === String(params[0]).toLowerCase());
            if (q.includes('company_id =')) {
              result = result.filter(d => d.company_id == params[1]);
            }
          }
          resultRows = result;
          rowCount = resultRows.length;
        }
        else if (q.includes('from salary_structures')) {
          if (!memoryDB.salary_structures) memoryDB.salary_structures = [];
          let ssResult = [...memoryDB.salary_structures];
          // Only filter by employee_id if it appears as a WHERE parameter ($N), not a JOIN condition
          const empIdMatch = q.match(/employee_id\s*=\s*\$(\d+)/);
          if (empIdMatch) {
            const empParam = params[parseInt(empIdMatch[1]) - 1];
            ssResult = ssResult.filter(s => s.employee_id == empParam);
          }
          if (q.includes('company_id =')) {
            const compIdMatch = q.match(/company_id\s*=\s*\$(\d+)/);
            const compParam = compIdMatch ? params[parseInt(compIdMatch[1]) - 1] : params[0];
            ssResult = ssResult.filter(s => s.company_id == compParam);
          }
          // JOIN employee data if query includes it
          if (q.includes('join employees') || q.includes('e.first_name')) {
            ssResult = ssResult.map(s => {
              const emp = memoryDB.employees.find(e => e.id == s.employee_id) || {};
              return { ...s, first_name: emp.first_name, last_name: emp.last_name, employee_code: emp.employee_code, email: emp.email };
            });
          }
          resultRows = ssResult;
          rowCount = ssResult.length;
        }
        else if (q.includes('from payroll_records')) {
          if (!memoryDB.payroll_records) memoryDB.payroll_records = [];
          let prResult = [...memoryDB.payroll_records];
          if (q.includes('company_id =')) {
            const compIdMatch = q.match(/company_id\s*=\s*\$(\d+)/);
            const compParam = compIdMatch ? params[parseInt(compIdMatch[1]) - 1] : params[0];
            prResult = prResult.filter(p => p.company_id == compParam);
          }
          if (q.includes('month =')) {
            const monthMatch = q.match(/month\s*=\s*\$(\d+)/);
            const monthParam = monthMatch ? params[parseInt(monthMatch[1]) - 1] : params[1];
            prResult = prResult.filter(p => p.month == monthParam);
          }
          if (q.includes('year =')) {
            const yearMatch = q.match(/year\s*=\s*\$(\d+)/);
            const yearParam = yearMatch ? params[parseInt(yearMatch[1]) - 1] : params[2];
            prResult = prResult.filter(p => p.year == yearParam);
          }
          if (q.includes('pr.id =') || (q.includes('where') && q.includes('id =') && !q.includes('company_id ='))) {
            const idMatch = q.match(/(?:pr\.)?id\s*=\s*\$(\d+)/);
            if (idMatch) {
              const idParam = params[parseInt(idMatch[1]) - 1];
              prResult = prResult.filter(p => p.id == idParam);
            }
          }
          // JOIN employee data if query includes it
          if (q.includes('join employees') || q.includes('e.first_name')) {
            prResult = prResult.map(p => {
              const emp = memoryDB.employees.find(e => e.id == p.employee_id) || {};
              const dept = memoryDB.departments.find(d => d.id == emp.department_id) || {};
              const desg = memoryDB.designations.find(d => d.id == emp.designation_id) || {};
              return {
                ...p,
                first_name: emp.first_name,
                last_name: emp.last_name,
                employee_code: emp.employee_code,
                email: emp.email,
                department_name: dept.name,
                designation_name: desg.name
              };
            });
          }
          resultRows = prResult;
          rowCount = prResult.length;
        }
        else if (q.includes('from form16_records')) {
          if (!memoryDB.form16_records) memoryDB.form16_records = [];
          let f16Result = [...memoryDB.form16_records];
          if (q.includes('company_id =')) {
            const compIdMatch = q.match(/company_id\s*=\s*\$(\d+)/);
            const compParam = compIdMatch ? params[parseInt(compIdMatch[1]) - 1] : params[0];
            f16Result = f16Result.filter(f => f.company_id == compParam);
          }
          // JOIN employee data if query includes it
          if (q.includes('join employees') || q.includes('e.first_name')) {
            f16Result = f16Result.map(f => {
              const emp = memoryDB.employees.find(e => e.id == f.employee_id) || {};
              return { ...f, first_name: emp.first_name, last_name: emp.last_name, employee_code: emp.employee_code, email: emp.email };
            });
          }
          resultRows = f16Result;
          rowCount = f16Result.length;
        }
        else if (q.includes('from salary_structure_history')) {
          if (!memoryDB.salary_structure_history) memoryDB.salary_structure_history = [];
          let hResult = [...memoryDB.salary_structure_history];
          const empIdMatch = q.match(/employee_id\s*=\s*\$(\d+)/);
          if (empIdMatch) hResult = hResult.filter(h => h.employee_id == params[parseInt(empIdMatch[1]) - 1]);
          const compIdMatch = q.match(/company_id\s*=\s*\$(\d+)/);
          if (compIdMatch) hResult = hResult.filter(h => h.company_id == params[parseInt(compIdMatch[1]) - 1]);
          if (q.includes('join employees') || q.includes('e.first_name')) {
            hResult = hResult.map(h => {
              const emp = memoryDB.employees.find(e => e.id == h.employee_id) || {};
              return { ...h, first_name: emp.first_name, last_name: emp.last_name, employee_code: emp.employee_code };
            });
          }
          hResult.sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at));
          resultRows = hResult; rowCount = hResult.length;
        }
        else if (q.includes('from tax_declarations')) {
          if (!memoryDB.tax_declarations) memoryDB.tax_declarations = [];
          let tdResult = [...memoryDB.tax_declarations];
          const empIdMatch = q.match(/employee_id\s*=\s*\$(\d+)/);
          if (empIdMatch) tdResult = tdResult.filter(d => d.employee_id == params[parseInt(empIdMatch[1]) - 1]);
          const compIdMatch = q.match(/company_id\s*=\s*\$(\d+)/);
          if (compIdMatch) tdResult = tdResult.filter(d => d.company_id == params[parseInt(compIdMatch[1]) - 1]);
          const fyMatch = q.match(/financial_year\s*=\s*\$(\d+)/);
          if (fyMatch) tdResult = tdResult.filter(d => d.financial_year == params[parseInt(fyMatch[1]) - 1]);
          if (q.includes('join employees') || q.includes('e.first_name')) {
            tdResult = tdResult.map(d => {
              const emp = memoryDB.employees.find(e => e.id == d.employee_id) || {};
              return { ...d, first_name: emp.first_name, last_name: emp.last_name, employee_code: emp.employee_code };
            });
          }
          resultRows = tdResult; rowCount = tdResult.length;
        }
        else if (q.includes('from custom_fields')) {
          let companyId, moduleName;
          if (q.includes('module_name = $1')) {
            // Query: WHERE module_name = $1 AND company_id = $2
            moduleName = params[0];
            companyId = params[1];
          } else {
            // Query: WHERE company_id = $1 AND module_name = $2
            companyId = params[0];
            moduleName = params[1];
          }
          resultRows = memoryDB.custom_fields.filter(f => {
            const matchCompany = companyId ? f.company_id == companyId : true;
            const matchModule = moduleName ? (f.module_name == moduleName || f.module == moduleName) : true;
            return matchCompany && matchModule;
          });
          rowCount = resultRows.length;
        }
        else if (q.includes('from company_settings')) {
          const settings = memoryDB.company_settings || [];
          if (q.includes('setting_key =')) {
            // Single key lookup: company_id=$1, setting_key=$2
            resultRows = settings.filter(s => s.company_id == params[0] && s.setting_key === params[1]);
          } else {
            // All settings for company: company_id=$1
            resultRows = settings.filter(s => s.company_id == params[0]);
          }
          rowCount = resultRows.length;
        }
        else if (q.includes('from custom_field_values')) {
          const companyId = params[0];
          const entityId = params[1];
          const values = (memoryDB.custom_field_values || []).filter(v => v.entity_id == entityId && v.company_id == companyId);
          resultRows = values.map(v => {
            const field = memoryDB.custom_fields.find(f => f.id == v.field_id) || {};
            return { field_id: v.field_id, value: v.value, field_name: field.field_name, field_type: field.field_type, field_key: field.field_id };
          });
          rowCount = resultRows.length;
        }
        else {
          console.warn('!!! Mock Query Fall-through: Unhandled Query SQL:', queryText);
        }

        return { rows: resultRows, rowCount };
      } catch (mockErr) {
        console.error(`[MockDB Error] Query: "${queryText}"`);
        console.error(mockErr.stack);
        throw mockErr;
      }
    }
  },
  pool,
};

// Persistence and Migration Logic
async function runMigrations() {
  if (pool) {
    try {
      console.log('--- DB: Starting PostgreSQL Migrations ---');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS companies (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS allowed_domains (
          id SERIAL PRIMARY KEY,
          domain VARCHAR(255) NOT NULL UNIQUE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS departments (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS designations (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS shifts (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          shift_start_time TIME NOT NULL,
          shift_end_time TIME NOT NULL,
          total_working_hours DECIMAL(4,2),
          grace_minutes INTEGER DEFAULT 15,
          late_start_time TIME,
          late_end_time TIME,
          overlate_start_time TIME,
          halfday_start_time TIME,
          lunch_allowed_minutes INTEGER DEFAULT 45,
          tea_allowed_minutes INTEGER DEFAULT 15,
          max_break_minutes INTEGER DEFAULT 70,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS attendance_events (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          attendance_id INTEGER REFERENCES attendance(id) ON DELETE CASCADE,
          event_type VARCHAR(50) NOT NULL,
          event_time TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role VARCHAR(50) NOT NULL,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS employees (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100),
          email VARCHAR(255),
          employee_code VARCHAR(100) NOT NULL,
          designation_id INTEGER REFERENCES designations(id) ON DELETE SET NULL,
          department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
          salary_info JSONB DEFAULT '{}',
          joining_date DATE,
          date_of_birth DATE,
          shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
          role VARCHAR(50) DEFAULT 'EMPLOYEE',
          status VARCHAR(20) DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS employee_shifts (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
          effective_to DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS attendance (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          attendance_date DATE,
          check_in TIMESTAMP NOT NULL,
          check_out TIMESTAMP,
          last_check_out TIMESTAMP,
          arrival_status VARCHAR(50),
          gross_minutes INTEGER DEFAULT 0,
          total_break_minutes INTEGER DEFAULT 0,
          other_break_minutes INTEGER DEFAULT 0,
          net_work_minutes INTEGER DEFAULT 0,
          overtime_minutes INTEGER DEFAULT 0,
          working_hours DECIMAL(4,2),
          overtime_hours DECIMAL(4,2),
          status VARCHAR(50),
          flags JSONB DEFAULT '[]',
          ai_summary TEXT,
          remarks TEXT,
          location_metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS attendance_sessions (
          id SERIAL PRIMARY KEY,
          attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          check_in TIMESTAMP NOT NULL,
          check_out TIMESTAMP,
          duration_minutes INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS salary_structures (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          basic_pay DECIMAL(12,2) DEFAULT 0,
          hra DECIMAL(12,2) DEFAULT 0,
          da DECIMAL(12,2) DEFAULT 0,
          conveyance DECIMAL(12,2) DEFAULT 0,
          medical DECIMAL(12,2) DEFAULT 0,
          special_allowance DECIMAL(12,2) DEFAULT 0,
          effective_from DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payroll_records (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          basic_pay DECIMAL(12,2) DEFAULT 0,
          hra DECIMAL(12,2) DEFAULT 0,
          da DECIMAL(12,2) DEFAULT 0,
          conveyance DECIMAL(12,2) DEFAULT 0,
          medical DECIMAL(12,2) DEFAULT 0,
          special_allowance DECIMAL(12,2) DEFAULT 0,
          bonus DECIMAL(12,2) DEFAULT 0,
          gross_salary DECIMAL(12,2) DEFAULT 0,
          pf DECIMAL(12,2) DEFAULT 0,
          esi DECIMAL(12,2) DEFAULT 0,
          professional_tax DECIMAL(12,2) DEFAULT 0,
          tds DECIMAL(12,2) DEFAULT 0,
          total_deductions DECIMAL(12,2) DEFAULT 0,
          net_salary DECIMAL(12,2) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'PROCESSED',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS form16_records (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          financial_year VARCHAR(20) NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS salary_structure_history (
          id SERIAL PRIMARY KEY,
          original_id INTEGER NOT NULL,
          employee_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          basic_pay DECIMAL(12,2) DEFAULT 0,
          hra DECIMAL(12,2) DEFAULT 0,
          da DECIMAL(12,2) DEFAULT 0,
          conveyance DECIMAL(12,2) DEFAULT 0,
          medical DECIMAL(12,2) DEFAULT 0,
          special_allowance DECIMAL(12,2) DEFAULT 0,
          effective_from DATE,
          effective_to DATE,
          archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tax_declarations (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          financial_year VARCHAR(20) NOT NULL,
          regime VARCHAR(10) DEFAULT 'new',
          std_deduction_new DECIMAL(12,2) DEFAULT 75000,
          std_deduction_old DECIMAL(12,2) DEFAULT 50000,
          cess_rate DECIMAL(5,2) DEFAULT 4,
          slabs_json JSONB DEFAULT '{}',
          sec80c DECIMAL(12,2) DEFAULT 0,
          sec80d DECIMAL(12,2) DEFAULT 0,
          sec80g DECIMAL(12,2) DEFAULT 0,
          sec80e DECIMAL(12,2) DEFAULT 0,
          hra_claimed DECIMAL(12,2) DEFAULT 0,
          lta DECIMAL(12,2) DEFAULT 0,
          nps DECIMAL(12,2) DEFAULT 0,
          other_deductions DECIMAL(12,2) DEFAULT 0,
          submitted BOOLEAN DEFAULT FALSE,
          submitted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(employee_id, company_id, financial_year)
        );

        CREATE TABLE IF NOT EXISTS custom_fields (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          module_name VARCHAR(100) NOT NULL DEFAULT 'employees',
          field_name VARCHAR(255) NOT NULL,
          field_type VARCHAR(50) NOT NULL DEFAULT 'text',
          field_id VARCHAR(255),
          is_required BOOLEAN DEFAULT FALSE,
          options TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS custom_field_values (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          entity_id INTEGER NOT NULL,
          field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
          value TEXT,
          UNIQUE(entity_id, field_id)
        );

        CREATE TABLE IF NOT EXISTS company_settings (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          setting_key VARCHAR(255) NOT NULL,
          setting_value TEXT,
          UNIQUE(company_id, setting_key)
        );
      `);

      // ── ALTER TABLE migrations for existing production tables ──
      // These add columns that were missing in the original schema.
      // ADD COLUMN IF NOT EXISTS is safe to run repeatedly.
      console.log('--- DB: Running ALTER TABLE migrations for production ---');

      // attendance table — new columns for detailed tracking
      const attAlters = [
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_date DATE',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS last_check_out TIMESTAMP',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS arrival_status VARCHAR(50)',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gross_minutes INTEGER DEFAULT 0',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS total_break_minutes INTEGER DEFAULT 0',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS other_break_minutes INTEGER DEFAULT 0',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS net_work_minutes INTEGER DEFAULT 0',
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0',
        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]'",
        'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ai_summary TEXT',
      ];
      for (const sql of attAlters) {
        try { await pool.query(sql); } catch (e) { /* column already exists */ }
      }

      // custom_fields table — add field_id column
      try {
        await pool.query('ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS field_id VARCHAR(255)');
      } catch (e) { /* already exists */ }

      // employees table — add shift_id direct reference
      try {
        await pool.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_id INTEGER');
        await pool.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE');
      } catch (e) { /* already exists */ }

      // salary_structures — add deductions_json for custom deductions
      try {
        await pool.query('ALTER TABLE salary_structures ADD COLUMN IF NOT EXISTS deductions_json JSONB');
      } catch (e) { /* already exists */ }

      // payroll_records — add deductions_json for payroll custom data
      try {
        await pool.query('ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS deductions_json JSONB');
      } catch (e) { /* already exists */ }

      // shifts — add lunch/tea allowed minutes and max break
      const shiftAlters = [
        'ALTER TABLE shifts ADD COLUMN IF NOT EXISTS lunch_allowed_minutes INTEGER DEFAULT 45',
        'ALTER TABLE shifts ADD COLUMN IF NOT EXISTS tea_allowed_minutes INTEGER DEFAULT 15',
        'ALTER TABLE shifts ADD COLUMN IF NOT EXISTS max_break_minutes INTEGER DEFAULT 70',
      ];
      for (const sql of shiftAlters) {
        try { await pool.query(sql); } catch (e) { /* already exists */ }
      }

      // Backfill attendance_date from check_in where NULL
      try {
        await pool.query("UPDATE attendance SET attendance_date = check_in::date WHERE attendance_date IS NULL AND check_in IS NOT NULL");
      } catch (e) { /* ignore */ }

      // Backfill custom_fields.field_id where NULL
      try {
        await pool.query("UPDATE custom_fields SET field_id = 'custom_' || lower(regexp_replace(field_name, '[^a-zA-Z0-9]+', '_', 'g')) WHERE field_id IS NULL");
      } catch (e) { /* ignore */ }

      // Clean and seed default employee custom fields
      try {
        const companies = await pool.query('SELECT id FROM companies');
        const defaultFields = [
          { field_id: 'first_name', field_name: 'First Name', field_type: 'text', is_required: true, sort: 1 },
          { field_id: 'last_name', field_name: 'Last Name', field_type: 'text', is_required: true, sort: 2 },
          { field_id: 'email', field_name: 'Work Email', field_type: 'text', is_required: true, sort: 3 },
          { field_id: 'employee_code', field_name: 'Employee ID', field_type: 'text', is_required: true, sort: 4 },
          { field_id: 'department_id', field_name: 'Department', field_type: 'dropdown', is_required: true, sort: 5 },
          { field_id: 'designation_id', field_name: 'Designation', field_type: 'dropdown', is_required: true, sort: 6 },
          { field_id: 'shift_id', field_name: 'Assigned Shift', field_type: 'dropdown', is_required: true, sort: 7 },
          { field_id: 'joining_date', field_name: 'Joining Date', field_type: 'date', is_required: true, sort: 8 },
          { field_id: 'date_of_birth', field_name: 'Date of Birth', field_type: 'date', is_required: false, sort: 9 },
          { field_id: 'role', field_name: 'Role', field_type: 'dropdown', is_required: true, sort: 10, options: '[{"label":"Employee","value":"EMPLOYEE"},{"label":"HR","value":"HR"},{"label":"Manager","value":"MANAGER"},{"label":"Super Admin","value":"SUPER_ADMIN"}]' },
        ];
        const knownIds = defaultFields.map(f => f.field_id);

        for (const co of companies.rows) {
          // 1. Delete old duplicates: any row whose field_id matches a default field — we'll re-insert cleanly
          await pool.query(
            `DELETE FROM custom_fields WHERE company_id = $1 AND module_name = 'employees' AND field_id = ANY($2::text[])`,
            [co.id, knownIds]
          ).catch(() => {});

          // Also remove ANY fields whose field_name matches defaults (catches custom_department, etc.)
          const knownNames = defaultFields.map(f => f.field_name);
          await pool.query(
            `DELETE FROM custom_fields WHERE company_id = $1 AND module_name = 'employees' AND field_name = ANY($2::text[]) AND field_id NOT IN (SELECT unnest($3::text[]))`,
            [co.id, knownNames, knownIds]
          ).catch(() => {});

          // 2. Insert all default fields fresh
          for (const f of defaultFields) {
            await pool.query(
              `INSERT INTO custom_fields (module_name, field_name, field_type, is_required, options, company_id, field_id)
               VALUES ('employees', $1, $2, $3, $4, $5, $6)`,
              [f.field_name, f.field_type, f.is_required, f.options || null, co.id, f.field_id]
            ).catch(() => {});
          }
        }
        console.log('--- DB: Cleaned and seeded default employee custom fields ---');
      } catch (e) { console.log('--- DB: Custom fields seed skipped:', e.message); }

      console.log('--- DB: ALTER TABLE migrations complete ---');

      const companyCount = await pool.query('SELECT COUNT(*) FROM companies');
      if (parseInt(companyCount.rows[0].count) === 0) {
        await pool.query("INSERT INTO companies (id, name, slug) VALUES (1, 'Creative Frenzy', 'creativefrenzy') ON CONFLICT DO NOTHING");
        await pool.query("INSERT INTO allowed_domains (domain, company_id) VALUES ('creativefrenzy.in', 1) ON CONFLICT DO NOTHING");
        console.log('--- DB: Seeded initial company and domain data ---');
      }

      // Seed initial Departments if they don't exist
      const deptCount = await pool.query('SELECT COUNT(*) FROM departments');
      if (parseInt(deptCount.rows[0].count) === 0) {
        await pool.query("INSERT INTO departments (id, name, company_id) VALUES (1, 'Administration', 1) ON CONFLICT DO NOTHING");
        await pool.query("INSERT INTO departments (id, name, company_id) VALUES (2, 'Engineering', 1) ON CONFLICT DO NOTHING");
        await pool.query("INSERT INTO departments (id, name, company_id) VALUES (3, 'HR', 1) ON CONFLICT DO NOTHING");
      }

      // Seed initial Designations if they don't exist
      const desCount = await pool.query('SELECT COUNT(*) FROM designations');
      if (parseInt(desCount.rows[0].count) === 0) {
        await pool.query("INSERT INTO designations (id, name, company_id) VALUES (1, 'Director', 1) ON CONFLICT DO NOTHING");
        await pool.query("INSERT INTO designations (id, name, company_id) VALUES (2, 'Lead Engineer', 1) ON CONFLICT DO NOTHING");
        await pool.query("INSERT INTO designations (id, name, company_id) VALUES (3, 'Developer', 1) ON CONFLICT DO NOTHING");
      }

      // Seed initial Shift if it doesn't exist
      const shiftCount = await pool.query('SELECT COUNT(*) FROM shifts');
      if (parseInt(shiftCount.rows[0].count) === 0) {
        await pool.query(`INSERT INTO shifts (id, company_id, name, shift_start_time, shift_end_time, total_working_hours, grace_minutes, late_start_time, late_end_time, overlate_start_time, halfday_start_time) 
          VALUES (1, 1, 'General Shift', '10:00:00', '19:00:00', 9.0, 15, '10:16:00', '10:59:00', '11:00:00', '12:30:00') ON CONFLICT DO NOTHING`);
      }

      // REPAIR: Ensure all existing shifts have correct late markers (grace logic)
      await pool.query(`
        UPDATE shifts 
        SET late_start_time = (shift_start_time::time + (grace_minutes || ' minutes')::interval)::time 
        WHERE late_start_time <= shift_start_time
      `);
      console.log('--- DB: Repaired shift thresholds for grace period accuracy ---');

      // Repair: Create employee records and assignments for any users that don't have them
      const orphanUsers = await pool.query(
        `SELECT u.id, u.email, u.role, u.company_id 
         FROM users u 
         LEFT JOIN employees e ON u.email = e.email AND u.company_id = e.company_id
         WHERE e.id IS NULL`
      );
      for (const user of orphanUsers.rows) {
        const namePart = user.email.split('@')[0];
        const parts = namePart.split(/[._-]/);
        const firstName = parts[0] || namePart;
        const lastName = parts.slice(1).join(' ') || '';
        const empCode = 'EMP-' + String(user.id).padStart(3, '0');
        const empResult = await pool.query(
          `INSERT INTO employees (company_id, first_name, last_name, employee_code, email, role, status, joining_date, department_id, designation_id, shift_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [user.company_id, firstName, lastName, empCode, user.email, user.role, 'ACTIVE', new Date().toISOString().split('T')[0], 1, 1, 1]
        );
        const empId = empResult.rows[0].id;
        
        await pool.query(
          `INSERT INTO employee_shifts (employee_id, shift_id, company_id, effective_from) 
           VALUES ($1, 1, $2, CURRENT_DATE) ON CONFLICT DO NOTHING`,
          [empId, user.company_id]
        );
        console.log('--- DB: Repaired missing employee and shift for:', user.email, '---');
      }

      // Special repair: Ensure ALL existing employees have a shift assignment
      const employeesWithoutShift = await pool.query(
        `SELECT e.id, e.company_id FROM employees e 
         LEFT JOIN employee_shifts es ON e.id = es.employee_id 
         WHERE es.id IS NULL`
      );
      for (const emp of employeesWithoutShift.rows) {
        await pool.query(
          `INSERT INTO employee_shifts (employee_id, shift_id, company_id, effective_from) 
           VALUES ($1, 1, $2, CURRENT_DATE)`,
          [emp.id, emp.company_id]
        );
        console.log('--- DB: Assigned default shift to employee ID:', emp.id, '---');
      }
      
      console.log('--- DB: PostgreSQL Migrations Complete ---');
    } catch (err) {
      console.error('--- DB: Migration Error ---', err.message);
    }
  }
}

// Start migrations in background
runMigrations().catch(err => console.error('Migration Background Error:', err));

function saveToDisk() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDB, null, 2));
  } catch (err) {
    console.error('Failed to save DB to disk:', err);
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      Object.keys(parsed).forEach(key => {
        if (Array.isArray(parsed[key])) {
          memoryDB[key] = parsed[key];
          console.log(`Loaded ${memoryDB[key].length} entries for ${key}`);
        }
      });
      console.log('Database loading complete.');
    }
  } catch (err) {
    console.error('Failed to load DB from disk:', err);
  }

  // Re-seed defaults if db.json had incomplete data
  let needsSave = false;
  if (!memoryDB.custom_fields || memoryDB.custom_fields.length === 0) {
    memoryDB.custom_fields = [...DEFAULT_CUSTOM_FIELDS];
    console.log('Re-seeded default custom fields.');
    needsSave = true;
  }
  if (!memoryDB.departments || memoryDB.departments.length < 3) {
    memoryDB.departments = [
      { id: 1, name: 'Administration', company_id: 1 },
      { id: 2, name: 'Engineering', company_id: 1 },
      { id: 3, name: 'HR', company_id: 1 }
    ];
    console.log('Re-seeded default departments.');
    needsSave = true;
  }
  if (!memoryDB.designations || memoryDB.designations.length < 3) {
    memoryDB.designations = [
      { id: 1, name: 'Director', company_id: 1 },
      { id: 2, name: 'Lead Engineer', company_id: 1 },
      { id: 3, name: 'Developer', company_id: 1 },
      { id: 4, name: 'HR Manager', company_id: 1 }
    ];
    console.log('Re-seeded default designations.');
    needsSave = true;
  }
  if (!memoryDB.salary_structures || memoryDB.salary_structures.length === 0) {
    memoryDB.salary_structures = [...DEFAULT_SALARY_STRUCTURES];
    console.log('Re-seeded default salary structures.');
    needsSave = true;
  }
  if (!memoryDB.payroll_records) {
    memoryDB.payroll_records = [];
    needsSave = true;
  }
  if (!memoryDB.form16_records) {
    memoryDB.form16_records = [];
    needsSave = true;
  }
  if (needsSave) saveToDisk();
}

loadFromDisk();

module.exports = db;
