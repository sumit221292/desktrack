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
    first_name, last_name, email, employee_code, designation_id, department_id, salary_info, joining_date, shift_id, role, status 
  } = req.body;
  console.log('Create Employee Body:', req.body);

  try {
    // 1. Create Employee (Using dynamic query for Mock DB to preserve all fields)
    const result = await query(
      `INSERT INTO employees_dynamic (all_data) VALUES ($1) RETURNING *`,
      [{ ...req.body, company_id: companyId }]
    );
    
    const employee = result.rows[0];

    // 2. Assign Shift if provided
    if (shift_id) {
      await query(
        `INSERT INTO employee_shifts (employee_id, shift_id, company_id, effective_from)
         VALUES ($1, $2, $3, CURRENT_DATE)`,
        [employee.id, shift_id, companyId]
      );
    }

    res.status(201).json(employee);
  } catch (err) {
    console.error('Create Employee Error:', err);
    res.status(500).json({ error: 'Server error creating employee.' });
  }
};

const getEmployeeById = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT e.*, d.name as department_name FROM employees e 
       LEFT JOIN departments d ON e.department_id = d.id 
       WHERE e.id = $1 AND e.company_id = $2`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get Employee Error:', err);
    res.status(500).json({ error: 'Server error retrieving employee.' });
  }
};

const updateEmployee = async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;
  const { first_name, last_name, email, employee_code, designation_id, department_id, salary_info, joining_date, shift_id, status, role } = req.body;

  try {
    const result = await query(
      `UPDATE employees_dynamic SET data = $1 WHERE id = $2 AND company_id = $3 RETURNING *`,
      [req.body, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
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
    const result = await query('SELECT * FROM departments');
    res.json(result.rows);
  } catch (err) {
    console.error('Get Departments Error:', err);
    res.status(500).json({ error: 'Server error retrieving departments.' });
  }
};

const getDesignations = async (req, res) => {
  try {
    const result = await query('SELECT * FROM designations');
    res.json(result.rows);
  } catch (err) {
    console.error('Get Designations Error:', err);
    res.status(500).json({ error: 'Server error retrieving designations.' });
  }
};

module.exports = { getEmployees, createEmployee, getEmployeeById, updateEmployee, deleteEmployee, getDepartments, getDesignations };
