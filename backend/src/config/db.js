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
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      shift_id: 1
    }
  ],
  attendance: [],
  companies: [
    { id: 1, name: 'Creative Frenzy', slug: 'creativefrenzy', is_active: true }
  ],
  allowed_domains: [
    { id: 1, domain: 'creativefrenzy.in', company_id: 1 }
  ],
  custom_fields: [
    { id: 1, module_name: 'employees', field_name: 'First Name', field_type: 'text', is_required: true, company_id: 1, field_id: 'first_name' },
    { id: 2, module_name: 'employees', field_name: 'Last Name', field_type: 'text', is_required: true, company_id: 1, field_id: 'last_name' },
    { id: 3, module_name: 'employees', field_name: 'Work Email', field_type: 'text', is_required: true, company_id: 1, field_id: 'email' },
    { id: 4, module_name: 'employees', field_name: 'Employee ID', field_type: 'text', is_required: true, company_id: 1, field_id: 'employee_code' },
    { id: 5, module_name: 'employees', field_name: 'Department', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'department_id' },
    { id: 6, module_name: 'employees', field_name: 'Designation', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'designation_id' },
    { id: 7, module_name: 'employees', field_name: 'Assigned Shift', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'shift_id' },
    { id: 8, module_name: 'employees', field_name: 'Joining Date', field_type: 'date', is_required: true, company_id: 1, field_id: 'joining_date' },
    { id: 9, module_name: 'employees', field_name: 'Role', field_type: 'dropdown', is_required: true, company_id: 1, field_id: 'role', options: '[{"label":"Employee","value":"EMPLOYEE"},{"label":"HR","value":"HR"},{"label":"Manager","value":"MANAGER"},{"label":"Super Admin","value":"SUPER_ADMIN"}]' }
  ]
};

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
      
      let resultRows = [];
      let rowCount = 0;

      // --- 1. WRITE Operations (Match these first) ---
      
      // Attendance
      if (queryText.includes('insert into attendance')) {
        const newRecord = {
          id: memoryDB.attendance.length + 1,
          company_id: params[0],
          employee_id: params[1],
          check_in: params[2],
          status: params[3],
          location_metadata: params[4],
          created_at: new Date()
        };
        memoryDB.attendance.push(newRecord);
        saveToDisk();
        resultRows = [newRecord];
        rowCount = 1;
      }
      else if (queryText.includes('update attendance')) {
        const id = parseInt(params[params.length - 2]); 
        const index = memoryDB.attendance.findIndex(a => a.id === id);
        if (index !== -1) {
          memoryDB.attendance[index] = {
            ...memoryDB.attendance[index],
            check_in: params[0],
            check_out: params[1],
            working_hours: params[2],
            overtime_hours: params[3],
            status: params[4],
            remarks: params[5]
          };
          saveToDisk();
          resultRows = [memoryDB.attendance[index]];
          rowCount = 1;
        }
      }
      // Shifts
      else if (queryText.includes('insert into shifts')) {
        const newShift = {
          id: memoryDB.shifts.length > 0 ? Math.max(...memoryDB.shifts.map(s => s.id)) + 1 : 1,
          company_id: params[0],
          name: params[1],
          shift_start_time: params[2],
          shift_end_time: params[3],
          total_working_hours: parseFloat(params[4]),
          grace_minutes: parseInt(params[5]),
          late_start_time: params[6],
          late_end_time: params[7],
          overlate_start_time: params[8],
          halfday_start_time: params[9],
          created_at: new Date()
        };
        memoryDB.shifts.push(newShift);
        saveToDisk();
        resultRows = [newShift];
        rowCount = 1;
      }
      else if (queryText.includes('update shifts')) {
        const id = parseInt(params[9]);
        const index = memoryDB.shifts.findIndex(s => s.id === id);
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
            halfday_start_time: params[8]
          };
          saveToDisk();
          resultRows = [memoryDB.shifts[index]];
          rowCount = 1;
        }
      }
      else if (queryText.includes('delete from shifts')) {
        const id = parseInt(params[0]);
        const shiftToDelete = memoryDB.shifts.find(s => s.id === id);
        if (shiftToDelete) {
          memoryDB.shifts = memoryDB.shifts.filter(s => s.id !== id);
          saveToDisk();
          resultRows = [shiftToDelete];
          rowCount = 1;
        }
      }
      // Employees
      else if (queryText.includes('insert into employees')) {
        let newEmp;
        if (queryText.includes('employees_dynamic')) {
          newEmp = {
            ...params[0],
            id: memoryDB.employees.length > 0 ? Math.max(...memoryDB.employees.map(e => e.id)) + 1 : 1,
            created_at: new Date()
          };
        } else {
          newEmp = {
            id: memoryDB.employees.length > 0 ? Math.max(...memoryDB.employees.map(e => e.id)) + 1 : 1,
            company_id: params[0],
            first_name: params[1],
            last_name: params[2],
            employee_code: params[3],
            designation_id: parseInt(params[4]),
            department_id: parseInt(params[5]),
            salary_info: params[6],
            joining_date: params[7],
            email: params[8] || '',
            shift_id: parseInt(params[9]) || 1,
            role: params[10] || 'EMPLOYEE',
            status: params[11] || 'ACTIVE',
            created_at: new Date()
          };
        }
        memoryDB.employees.push(newEmp);
        saveToDisk();
        resultRows = [newEmp];
        rowCount = 1;
      }
      else if (queryText.includes('update employees')) {
        if (queryText.includes('employees_dynamic')) {
          const data = params[0];
          const id = parseInt(params[1]);
          const companyId = params[2];
          const index = memoryDB.employees.findIndex(e => parseInt(e.id) === id && e.company_id == companyId);
          if (index !== -1) {
            memoryDB.employees[index] = {
              ...memoryDB.employees[index],
              ...data
            };
            saveToDisk();
            resultRows = [memoryDB.employees[index]];
            rowCount = 1;
          }
        } else {
          const id = parseInt(params[11]); 
          const companyId = params[12];     
          const index = memoryDB.employees.findIndex(e => parseInt(e.id) === id && e.company_id == companyId);
          if (index !== -1) {
            memoryDB.employees[index] = {
              ...memoryDB.employees[index],
              first_name: params[0],
              last_name: params[1],
              email: params[2],
              employee_code: params[3],
              designation_id: parseInt(params[4]),
              department_id: parseInt(params[5]),
              salary_info: params[6],
              joining_date: params[7],
              shift_id: parseInt(params[8]),
              status: params[9],
              role: params[10]
            };
            saveToDisk();
            resultRows = [memoryDB.employees[index]];
            rowCount = 1;
          }
        }
      }
      else if (queryText.includes('delete from employees')) {
        const id = parseInt(params[0]);
        const companyId = params[1];
        const emp = memoryDB.employees.find(e => parseInt(e.id) === id && e.company_id == companyId);
        if (emp) {
          memoryDB.employees = memoryDB.employees.filter(e => parseInt(e.id) !== id);
          saveToDisk();
          resultRows = [emp];
          rowCount = 1;
        }
      }
      // Custom Fields
      else if (queryText.includes('insert into custom_fields')) {
        const newField = {
          id: memoryDB.custom_fields.length > 0 ? Math.max(...memoryDB.custom_fields.map(f => f.id)) + 1 : 1,
          module_name: params[0],
          field_name: params[1],
          field_type: params[2],
          is_required: params[3],
          options: params[4],
          company_id: params[5],
          field_id: params[6] || `field_${Date.now()}`,
          created_at: new Date()
        };
        memoryDB.custom_fields.push(newField);
        saveToDisk();
        resultRows = [newField];
        rowCount = 1;
      }
      else if (queryText.includes('update custom_fields')) {
        const id = parseInt(params[5]);
        const companyId = parseInt(params[6]);
        const index = memoryDB.custom_fields.findIndex(f => f.id === id && f.company_id === companyId);
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
      else if (queryText.includes('delete from custom_fields')) {
        const id = parseInt(params[0]);
        const companyId = parseInt(params[1]);
        const fieldToDelete = memoryDB.custom_fields.find(f => f.id === id && f.company_id === companyId);
        if (fieldToDelete) {
          memoryDB.custom_fields = memoryDB.custom_fields.filter(f => f.id !== id);
          saveToDisk();
          resultRows = [fieldToDelete];
          rowCount = 1;
        }
      }

      // --- 2. READ Operations (Match these second) ---

      // Attendance
      else if (queryText.includes('from attendance')) {
        let result = memoryDB.attendance;
        if (params.length > 0 && queryText.includes('company_id =')) {
          result = result.filter(a => a.company_id == params[0]);
        }
        if (params.length > 1 && queryText.includes('check_in like')) {
          const pattern = params[1].replace(/%/g, '');
          result = result.filter(a => a.check_in && String(a.check_in).includes(pattern));
        }
        if (params.length > 0 && (queryText.includes('a.id =') || queryText.includes('where id ='))) {
          result = result.filter(a => a.id == params[0]);
        }
        resultRows = result;
        rowCount = result.length;
      }
      // Shifts and Shift Assignments
      else if (queryText.includes('from employee_shifts')) {
        let result = memoryDB.employee_shifts || [];
        if (queryText.includes('join shifts')) {
          result = result.map(es => {
            const s = memoryDB.shifts.find(sh => sh.id === es.shift_id);
            return { ...es, ...s, id: es.id, shift_id: es.shift_id };
          });
        }
        if (params.length > 0 && queryText.includes('employee_id =')) result = result.filter(es => es.employee_id == params[0]);
        if (params.length > 1 && queryText.includes('company_id =')) result = result.filter(es => es.company_id == params[1]);
        resultRows = result;
        rowCount = result.length;
      }
      else if (queryText.includes('from shifts')) {
        let result = memoryDB.shifts;
        if (params.length > 0 && queryText.includes('company_id =')) result = result.filter(s => s.company_id == params[0]);
        if (params.length > 0 && queryText.includes('s.id =')) result = result.filter(s => s.id == params[0]);
        resultRows = result;
        rowCount = result.length;
      }
      // Employees
      else if (queryText.includes('from employees')) {
        let result = memoryDB.employees.map(e => {
          const dept = memoryDB.departments.find(d => d.id === parseInt(e.department_id));
          const desg = memoryDB.designations.find(d => d.id === parseInt(e.designation_id));
          const shift = memoryDB.shifts.find(s => s.id === parseInt(e.shift_id));
          return {
            ...e,
            department_name: dept ? dept.name : 'Unknown',
            designation_name: desg ? desg.name : 'Unknown',
            shift_name: shift ? shift.name : 'Standard Shift'
          };
        });
        if (params.length > 0 && queryText.includes('company_id =')) result = result.filter(e => e.company_id == params[0]);
        if (params.length > 0 && queryText.includes('e.id =')) result = result.filter(e => parseInt(e.id) === parseInt(params[0]));
        if (params.length > 0 && queryText.includes('email =')) result = result.filter(e => e.email === params[0]);
        resultRows = result;
        rowCount = result.length;
      }
      // Users
      else if (queryText.includes('from users')) {
        let result = memoryDB.users;
        if (params.length > 1 && queryText.includes('email =') && queryText.includes('company_id =')) {
          result = result.filter(u => u.email === params[0] && u.company_id == params[1]);
        }
        if (params.length > 0 && queryText.includes('company_id =') && !queryText.includes('email =')) {
          result = result.filter(u => u.company_id == params[0]);
        }
        resultRows = result;
        rowCount = result.length;
      }
      // Meta tables
      else if (queryText.includes('from departments')) {
        resultRows = memoryDB.departments.filter(d => d.company_id == params[0]);
        rowCount = resultRows.length;
      }
      else if (queryText.includes('from designations')) {
        resultRows = memoryDB.designations.filter(d => d.company_id == params[0]);
        rowCount = resultRows.length;
      }
      else if (queryText.includes('from companies')) {
        let result = memoryDB.companies;
        if (params.length > 0 && queryText.includes('slug =')) result = result.filter(c => String(c.slug).toLowerCase() === String(params[0]).toLowerCase());
        resultRows = result;
        rowCount = result.length;
      }
      else if (queryText.includes('from allowed_domains')) {
        let result = memoryDB.allowed_domains;
        if (params.length > 0 && queryText.includes('domain =')) result = result.filter(d => String(d.domain).toLowerCase() === String(params[0]).toLowerCase());
        resultRows = result;
        rowCount = result.length;
      }
      else if (queryText.includes('from custom_fields')) {
        let result = memoryDB.custom_fields || [];
        // Extract company_id filter
        const companyIdParam = params.find(p => typeof p === 'number');
        const moduleNameParam = params.find(p => typeof p === 'string');

        if (companyIdParam !== undefined && queryText.includes('company_id =')) {
          result = result.filter(f => f.company_id == companyIdParam);
        }
        if (moduleNameParam !== undefined && queryText.includes('module_name =')) {
          result = result.filter(f => f.module_name === moduleNameParam.toLowerCase());
        }
        resultRows = result;
        rowCount = result.length;
      }
      else {
        console.warn('!!! Mock Query Fall-through: Unhandled Query SQL:', queryText);
      }

      return { rows: resultRows, rowCount };
    }
  },
  pool,
};

// Persistence Logic
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
}

loadFromDisk();

module.exports = db;
