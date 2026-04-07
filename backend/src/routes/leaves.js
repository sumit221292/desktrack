const express = require('express');
const router = express.Router();
const c = require('../controllers/leaveController');
const { authMiddleware, checkRole } = require('../middleware/auth');

const HR = ['HR', 'SUPER_ADMIN'];
const ALL = ['HR', 'SUPER_ADMIN', 'EMPLOYEE', 'MANAGER'];

router.use(authMiddleware);

// Leave Types
router.get('/types', c.getLeaveTypes);
router.post('/types', checkRole(HR), c.createLeaveType);
router.put('/types/:id', checkRole(HR), c.updateLeaveType);
router.delete('/types/:id', checkRole(HR), c.deleteLeaveType);

// Leave Requests
router.get('/requests', c.getLeaveRequests);
router.post('/apply', c.applyLeave);
router.put('/requests/:id/review', checkRole(HR), c.reviewLeave);

// Leave Balances
router.get('/balances', c.getLeaveBalances);
router.post('/balances/init', checkRole(HR), c.initBalances);

module.exports = router;
