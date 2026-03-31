const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authMiddleware, checkRole } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', shiftController.getShifts);
router.post('/', checkRole(['HR', 'SUPER_ADMIN']), shiftController.createShift);
router.put('/:id', checkRole(['HR', 'SUPER_ADMIN']), shiftController.updateShift);
router.delete('/:id', checkRole(['HR', 'SUPER_ADMIN']), shiftController.deleteShift);

module.exports = router;
