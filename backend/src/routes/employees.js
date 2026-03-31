const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authMiddleware, checkRole } = require('../middleware/auth');

// All employee routes require authentication
router.use(authMiddleware);

router.get('/', checkRole(['HR', 'MANAGER', 'SUPER_ADMIN', 'EMPLOYEE']), employeeController.getEmployees);
router.post('/', checkRole(['HR', 'SUPER_ADMIN', 'EMPLOYEE']), employeeController.createEmployee);

// Meta endpoints for dropdowns (must be before /:id)
router.get('/meta/departments', employeeController.getDepartments);
router.post('/meta/departments', checkRole(['HR', 'SUPER_ADMIN']), employeeController.createDepartment);
router.put('/meta/departments/:id', checkRole(['HR', 'SUPER_ADMIN']), employeeController.updateDepartment);
router.delete('/meta/departments/:id', checkRole(['HR', 'SUPER_ADMIN']), employeeController.deleteDepartment);

router.get('/meta/designations', employeeController.getDesignations);
router.post('/meta/designations', checkRole(['HR', 'SUPER_ADMIN']), employeeController.createDesignation);
router.put('/meta/designations/:id', checkRole(['HR', 'SUPER_ADMIN']), employeeController.updateDesignation);
router.delete('/meta/designations/:id', checkRole(['HR', 'SUPER_ADMIN']), employeeController.deleteDesignation);

router.get('/:id', checkRole(['HR', 'MANAGER', 'SUPER_ADMIN', 'EMPLOYEE']), employeeController.getEmployeeById);
router.put('/:id', checkRole(['HR', 'SUPER_ADMIN', 'EMPLOYEE']), employeeController.updateEmployee);
router.delete('/:id', checkRole(['HR', 'SUPER_ADMIN', 'EMPLOYEE']), employeeController.deleteEmployee);

module.exports = router;

