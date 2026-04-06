const { query } = require('../config/db');

/**
 * Employee Controller
 */

const getEmployees = async (req, res) => {
  const companyId = req.tenantId;
  try {
    const result = await query(
      'SELECT e.*, d.name as department_name, des.name as designation_name, s.name as shift_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN designations des ON e.designation_id = des.id LEFT JOIN shifts s ON e.shift_id = s.id WHERE e.company_id = $1',
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get Employees Error:', err);
    res.status(500).json({ error: 'Server error retrieving employees.' });
  }
};

const createEmployee = async (req, res) => {
  const companyId = req.tenantId;
  const {
    first_name, last_name, email, employee_code, designation_id, department_id, salary_info, joining_date, date_of_birth, shift_id, role, status,
    custom_field_values
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO employees (company_id, first_name, last_name, email, employee_code, designation_id, department_id, salary_info, joining_date, date_of_birth, shift_id, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [companyId, first_name, last_name, email, employee_code, designation_id, department_id, salary_info || '{}', joining_date, date_of_birth || null, shift_id, role || 'EMPLOYEE', status || 'ACTIVE']
    );

    const newEmp = result.rows[0];

    // Save custom field values if provided
    if (custom_field_values && Object.keys(custom_field_values).length > 0) {
      const promises = Object.entries(custom_field_values).map(([fieldId, value]) =>
        query(
          `INSERT INTO custom_field_values (company_id, entity_id, field_id, value)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (entity_id, field_id) DO UPDATE SET value = EXCLUDED.value`,
          [companyId, newEmp.id, fieldId, String(value ?? '')]
        )
      );
      await Promise.all(promises);
    }

    res.status(201).json(newEmp);
  } catch (err) {
    console.error('Create Employee Error:', err);
    res.status(500).json({ error: 'Server error creating employee.' });
  }
};

const getEmployeeById = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;

  try {
    const [empResult, cfvResult] = await Promise.all([
      query(
        `SELECT e.*, d.name as department_name, des.name as designation_name, s.name as shift_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN designations des ON e.designation_id = des.id
         LEFT JOIN shifts s ON e.shift_id = s.id
         WHERE e.id = $1 AND e.company_id = $2`,
        [id, companyId]
      ),
      query(
        `SELECT cfv.field_id, cfv.value, cf.field_id as field_key
         FROM custom_field_values cfv
         JOIN custom_fields cf ON cfv.field_id = cf.id AND cf.company_id = $1
         WHERE cfv.entity_id = $2 AND cfv.company_id = $1`,
        [companyId, id]
      )
    ]);

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Merge custom field values into the employee object
    const employee = empResult.rows[0];
    cfvResult.rows.forEach(r => { employee[r.field_key] = r.value; });

    res.json(employee);
  } catch (err) {
    console.error('Get Employee Error:', err);
    res.status(500).json({ error: 'Server error retrieving employee.' });
  }
};

const updateEmployee = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;
  const { first_name, last_name, email, employee_code, designation_id, department_id, salary_info, joining_date, date_of_birth, shift_id, status, role, custom_field_values } = req.body;

  try {
    const result = await query(
      `UPDATE employees SET
        first_name = $1, last_name = $2, email = $3, employee_code = $4,
        designation_id = $5, department_id = $6, salary_info = $7,
        joining_date = $8, date_of_birth = $9, shift_id = $10, status = $11, role = $12
       WHERE id = $13 AND company_id = $14 RETURNING *`,
      [first_name, last_name, email, employee_code, designation_id, department_id, salary_info || '{}', joining_date, date_of_birth || null, shift_id, status, role, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Sync role to users table so JWT picks up the correct role on next login
    if (role && email) {
      try {
        await query('UPDATE users SET role = $1 WHERE email = $2 AND company_id = $3', [role, email, companyId]);
      } catch (syncErr) {
        console.warn('Role sync to users table failed (non-fatal):', syncErr.message);
      }
    }

    // Save custom field values if provided
    if (custom_field_values && Object.keys(custom_field_values).length > 0) {
      const promises = Object.entries(custom_field_values).map(([fieldId, value]) =>
        query(
          `INSERT INTO custom_field_values (company_id, entity_id, field_id, value)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (entity_id, field_id) DO UPDATE SET value = EXCLUDED.value`,
          [companyId, id, fieldId, String(value ?? '')]
        )
      );
      await Promise.all(promises);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Employee Error:', err);
    res.status(500).json({ error: 'Server error updating employee.' });
  }
};

const deleteEmployee = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;

  try {
    // Delete attendance records first due to possible constraint issues even with cascade
    await query('DELETE FROM attendance WHERE employee_id = $1 AND company_id = $2', [id, companyId]);

    const result = await query(
      'DELETE FROM employees WHERE id = $1 AND company_id = $2 RETURNING *',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    res.json({ message: 'Employee deleted successfully.', employee: result.rows[0] });
  } catch (err) {
    console.error('Delete Employee Error:', err);
    res.status(500).json({ error: 'Server error deleting employee.' });
  }
};

const getDepartments = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const result = await query('SELECT * FROM departments WHERE company_id = $1', [companyId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get Departments Error:', err);
    res.status(500).json({ error: 'Server error retrieving departments.' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const { name } = req.body;
    const result = await query(
      'INSERT INTO departments (company_id, name) VALUES ($1, $2) RETURNING *',
      [companyId, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create Department Error:', err);
    res.status(500).json({ error: 'Server error creating department.' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const { id } = req.params;
    const { name } = req.body;
    const result = await query(
      'UPDATE departments SET name = $1 WHERE id = $2 AND company_id = $3 RETURNING *',
      [name, id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Department Error:', err);
    res.status(500).json({ error: 'Server error updating department.' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const { id } = req.params;
    const result = await query(
      'DELETE FROM departments WHERE id = $1 AND company_id = $2 RETURNING *',
      [id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found.' });
    res.json({ message: 'Department deleted successfully.' });
  } catch (err) {
    console.error('Delete Department Error:', err);
    res.status(500).json({ error: 'Server error deleting department.' });
  }
};

const getDesignations = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const result = await query('SELECT * FROM designations WHERE company_id = $1', [companyId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get Designations Error:', err);
    res.status(500).json({ error: 'Server error retrieving designations.' });
  }
};

const createDesignation = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const { name } = req.body;
    const result = await query(
      'INSERT INTO designations (company_id, name) VALUES ($1, $2) RETURNING *',
      [companyId, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create Designation Error:', err);
    res.status(500).json({ error: 'Server error creating designation.' });
  }
};

const updateDesignation = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const { id } = req.params;
    const { name } = req.body;
    const result = await query(
      'UPDATE designations SET name = $1 WHERE id = $2 AND company_id = $3 RETURNING *',
      [name, id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Designation not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Designation Error:', err);
    res.status(500).json({ error: 'Server error updating designation.' });
  }
};

const deleteDesignation = async (req, res) => {
  try {
    const companyId = req.tenantId;
    const { id } = req.params;
    const result = await query(
      'DELETE FROM designations WHERE id = $1 AND company_id = $2 RETURNING *',
      [id, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Designation not found.' });
    res.json({ message: 'Designation deleted successfully.' });
  } catch (err) {
    console.error('Delete Designation Error:', err);
    res.status(500).json({ error: 'Server error deleting designation.' });
  }
};

module.exports = {
  getEmployees, createEmployee, getEmployeeById, updateEmployee, deleteEmployee,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getDesignations, createDesignation, updateDesignation, deleteDesignation
};
