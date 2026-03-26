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
      // Allowed Domains
      else if (queryText.includes('insert into allowed_domains')) {
        const newDomain = {
          id: memoryDB.allowed_domains.length > 0 ? Math.max(...memoryDB.allowed_domains.map(d => d.id)) + 1 : 1,
          domain: params[0],
          company_id: params[1],
          created_at: new Date()
        };
        memoryDB.allowed_domains.push(newDomain);
        saveToDisk();
        resultRows = [newDomain];
        rowCount = 1;
      }
      else if (queryText.includes('delete from allowed_domains')) {
        const id = parseInt(params[0]);
        const domainToDelete = memoryDB.allowed_domains.find(d => d.id === id);
        if (domainToDelete) {
          memoryDB.allowed_domains = memoryDB.allowed_domains.filter(d => d.id !== id);
          saveToDisk();
          resultRows = [domainToDelete];
          rowCount = 1;
        }
      }

      // --- 2. READ Operations (Match these second) ---

      // Attendance
      else if (queryText.includes('from attendance')) {
        let result = memoryDB.attendance || [];
        if (params.length > 0 && queryText.includes('company_id =')) {
          result = result.filter(a => a.company_id == params[0]);
        }
        if (params.length > 0 && queryText.includes('check_in like')) {
          const pattern = params[params.length - 1].replace(/%/g, '');
          result = result.filter(a => {
            const checkInStr = a.check_in instanceof Date ? a.check_in.toISOString() : String(a.check_in);
            return checkInStr.startsWith(pattern);
          });
        }
        if (params.length > 0 && (queryText.includes('a.id =') || queryText.includes('where id ='))) {
          // This matches specific record lookups
          const idParam = params[0];
          result = result.filter(a => a.id == idParam);
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
          check_in TIMESTAMP NOT NULL,
          check_out TIMESTAMP,
          working_hours DECIMAL(4,2),
          overtime_hours DECIMAL(4,2),
          status VARCHAR(50),
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
      `);
      
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
}

loadFromDisk();

module.exports = db;
