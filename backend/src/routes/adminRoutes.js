const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken, authorizeRoles('admin'));
router.get('/stats', ctrl.stats);
router.get('/customers', ctrl.customers);
router.post('/customers', ctrl.createCustomer);

module.exports = router;
