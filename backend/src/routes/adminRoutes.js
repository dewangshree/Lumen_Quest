const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken, authorizeRoles('admin'));
router.get('/stats', ctrl.stats);
router.get('/customers', ctrl.customers);
router.post('/customers', ctrl.createCustomer);
router.get('/customers/:id', ctrl.customerDetail);
router.patch('/customers/:id', ctrl.updateCustomer);
router.post('/customers/:id/subscription', ctrl.assignPlan);
router.post('/subscriptions/:id/:action', ctrl.subscriptionAction);
router.get('/billing', ctrl.billing);
router.post('/billing/:id/mark-paid', ctrl.markPaid);
router.get('/plans', ctrl.plans);

module.exports = router;
