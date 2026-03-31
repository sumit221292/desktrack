const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, checkRole } = require('../middleware/auth');

router.use(authMiddleware);

// GET custom fields for a module
router.get('/', async (req, res) => {
  const { module } = req.query;
  const companyId = req.tenantId;
  
  try {
    const result = await query(
      'SELECT * FROM custom_fields WHERE module_name = $1 AND company_id = $2 ORDER BY id ASC',
      [module || 'employees', companyId]
    );

    // Fetch dynamic options for core fields
    const [depts, desgs, shifts] = await Promise.all([
      query('SELECT id, name FROM departments WHERE company_id = $1', [companyId]),
      query('SELECT id, name FROM designations WHERE company_id = $1', [companyId]),
      query('SELECT id, name FROM shifts WHERE company_id = $1', [companyId])
    ]);

    // Parse options and inject dynamic ones
    const fields = result.rows.map(field => {
      // Inject dynamic options for core fields
      if (field.field_id === 'department_id') {
        field.options = depts.rows.map(d => ({ label: d.name, value: d.id }));
      } else if (field.field_id === 'designation_id') {
        field.options = desgs.rows.map(d => ({ label: d.name, value: d.id }));
      } else if (field.field_id === 'shift_id') {
        field.options = shifts.rows.map(s => ({ label: s.name, value: s.id }));
      } else if (field.field_type === 'dropdown' && typeof field.options === 'string' && field.options) {
        try {
          field.options = JSON.parse(field.options);
        } catch (e) {
          field.options = field.options.split(',').map(opt => opt.trim());
        }
      }

      return {
        ...field,
        id: field.field_id,
        db_id: field.id
      };
    });

    res.json(fields);
  } catch (err) {
    console.error('Get Custom Fields Error:', err);
    res.status(500).json({ error: 'Server error retrieving custom fields.' });
  }
});

// CREATE custom field
router.post('/', checkRole(['SUPER_ADMIN', 'HR']), async (req, res) => {
  const companyId = req.tenantId;
  const { moduleName, fieldName, fieldType, isRequired, options } = req.body;

  // Auto-generate field_id from field name (e.g. "Passport Number" → "custom_passport_number")
  const fieldId = 'custom_' + fieldName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  try {
    const result = await query(
      `INSERT INTO custom_fields (module_name, field_name, field_type, is_required, options, company_id, field_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [moduleName.toLowerCase(), fieldName, fieldType, isRequired, typeof options === 'string' ? options : JSON.stringify(options), companyId, fieldId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create Custom Field Error:', err);
    res.status(500).json({ error: 'Server error creating custom field.' });
  }
});

// UPDATE custom field
router.put('/:id', checkRole(['SUPER_ADMIN', 'HR']), async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;
  const { moduleName, fieldName, fieldType, isRequired, options } = req.body;

  try {
    const result = await query(
      `UPDATE custom_fields SET module_name = $1, field_name = $2, field_type = $3, is_required = $4, options = $5
       WHERE id = $6 AND company_id = $7 RETURNING *`,
      [moduleName.toLowerCase(), fieldName, fieldType, isRequired, typeof options === 'string' ? options : JSON.stringify(options), id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom field not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Custom Field Error:', err);
    res.status(500).json({ error: 'Server error updating custom field.' });
  }
});

// DELETE custom field
router.delete('/:id', checkRole(['SUPER_ADMIN', 'HR']), async (req, res) => {
  const companyId = req.tenantId;
  const { id } = req.params;

  try {
    const result = await query(
      'DELETE FROM custom_fields WHERE id = $1 AND company_id = $2 RETURNING *',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom field not found.' });
    }

    res.json({ message: 'Custom field deleted successfully.' });
  } catch (err) {
    console.error('Delete Custom Field Error:', err);
    res.status(500).json({ error: 'Server error deleting custom field.' });
  }
});

// ─── Custom Field VALUES per entity (employee) ───────────────────────────

// GET values for an entity (employee)
router.get('/values/:entityId', async (req, res) => {
  const companyId = req.tenantId;
  const { entityId } = req.params;
  try {
    const result = await query(
      `SELECT cfv.field_id, cfv.value, cf.field_name, cf.field_type, cf.field_id as field_key
       FROM custom_field_values cfv
       JOIN custom_fields cf ON cfv.field_id = cf.id AND cf.company_id = $1
       WHERE cfv.entity_id = $2 AND cfv.company_id = $1`,
      [companyId, entityId]
    );
    // Return as a map: { field_key: value }
    const valuesMap = {};
    result.rows.forEach(r => { valuesMap[r.field_key] = r.value; });
    res.json(valuesMap);
  } catch (err) {
    console.error('Get Custom Field Values Error:', err);
    res.status(500).json({ error: 'Server error retrieving custom field values.' });
  }
});

// SAVE/UPDATE values for an entity (employee) — bulk upsert
router.post('/values/:entityId', async (req, res) => {
  const companyId = req.tenantId;
  const { entityId } = req.params;
  const { values } = req.body; // { field_db_id: value, ... }

  try {
    const promises = Object.entries(values || {}).map(([fieldId, value]) =>
      query(
        `INSERT INTO custom_field_values (company_id, entity_id, field_id, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (entity_id, field_id) DO UPDATE SET value = EXCLUDED.value`,
        [companyId, entityId, fieldId, String(value ?? '')]
      )
    );
    await Promise.all(promises);
    res.json({ message: 'Custom field values saved.' });
  } catch (err) {
    console.error('Save Custom Field Values Error:', err);
    res.status(500).json({ error: 'Server error saving custom field values.' });
  }
});

module.exports = router;

