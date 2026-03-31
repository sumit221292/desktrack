const express = require('express');
const router = express.Router();
const c = require('../controllers/payrollController');
const { authMiddleware, checkRole } = require('../middleware/auth');

const HR   = ['HR', 'SUPER_ADMIN'];
const ALL  = ['HR', 'SUPER_ADMIN', 'EMPLOYEE'];

router.use(authMiddleware);

// Salary structures
router.get('/salary-structures',                        checkRole(ALL), c.getSalaryStructures);
router.get('/salary-structures/:employeeId/history',    checkRole(ALL), c.getSalaryStructureHistory);
router.get('/salary-structures/:employeeId',            checkRole(ALL), c.getSalaryStructure);
router.post('/salary-structures/:employeeId',           checkRole(HR),  c.upsertSalaryStructure);

// Form 16
router.get('/form16',       checkRole(ALL), c.getForm16List);
router.post('/form16',      checkRole(HR),  c.uploadForm16);
router.delete('/form16/:id',checkRole(HR),  c.deleteForm16);

// Tax Declarations
router.get('/tax-declarations',             checkRole(ALL), c.getTaxDeclarations);
router.post('/tax-declarations/:employeeId',checkRole(ALL), c.upsertTaxDeclaration);

// Payroll — static routes before /:id
router.get('/summary', checkRole(ALL), c.getPayrollSummary);
router.get('/history', checkRole(ALL), c.getPayrollHistory);
router.post('/run',    checkRole(HR),  c.runPayroll);
router.get('/',        checkRole(ALL), c.getPayrollRecords);

// Dynamic /:id routes last
router.get('/:id/payslip', checkRole(ALL), c.getPayslip);
router.put('/:id',         checkRole(HR),  c.updatePayrollRecord);

module.exports = router;
