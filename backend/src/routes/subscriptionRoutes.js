const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subscriptionController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.get('/me', ctrl.getMine);
router.get('/me/billing', ctrl.billing);
router.get('/me/summary', ctrl.summary);
router.post('/me/billing/:billingId/pay', ctrl.payBill);
router.post('/', ctrl.subscribe);
router.post('/:id/cancel', ctrl.cancel);
router.post('/:id/pause', ctrl.pause);
router.post('/:id/resume', ctrl.resume);

module.exports = router;
