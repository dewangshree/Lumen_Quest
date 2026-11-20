const repo = require('../database/repo');
const handle = require('../utils/handle');

// GET /api/subscriptions/me
exports.getMine = handle(async (req, res) => {
  res.json(await repo.getSubscriptionsForUser(req.user.id));
});

// POST /api/subscriptions  { plan_id, payment_method? }
exports.subscribe = handle(async (req, res) => {
  const { plan_id, payment_method } = req.body || {};
  if (!plan_id) return res.status(400).json({ message: 'plan_id is required' });
  const allowed = ['credit_card', 'debit_card', 'upi', 'cash'];
  const method = allowed.includes(payment_method) ? payment_method : 'credit_card';
  const result = await repo.subscribe(req.user.id, plan_id, { paymentMethod: method });
  res.status(201).json({ message: 'Subscribed successfully', ...result });
});

// POST /api/subscriptions/:id/cancel
exports.cancel = handle(async (req, res) => {
  const ok = await repo.cancelSubscription(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Active subscription not found' });
  res.json({ message: 'Subscription cancelled' });
});

// POST /api/subscriptions/:id/pause
exports.pause = handle(async (req, res) => {
  const ok = await repo.pauseSubscription(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Active subscription not found' });
  res.json({ message: 'Subscription paused' });
});

// POST /api/subscriptions/:id/resume
exports.resume = handle(async (req, res) => {
  const ok = await repo.resumeSubscription(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Paused subscription not found' });
  res.json({ message: 'Subscription resumed' });
});

// GET /api/subscriptions/me/billing
exports.billing = handle(async (req, res) => {
  res.json(await repo.getBillingForUser(req.user.id));
});

// GET /api/subscriptions/me/summary
exports.summary = handle(async (req, res) => {
  const summary = await repo.getCustomerSummary(req.user.id);
  if (!summary) return res.status(404).json({ message: 'User not found' });
  res.json(summary);
});

// POST /api/subscriptions/me/billing/:billingId/pay  { payment_method? }
exports.payBill = handle(async (req, res) => {
  const allowed = ['credit_card', 'debit_card', 'upi', 'cash'];
  const method = allowed.includes((req.body || {}).payment_method) ? req.body.payment_method : 'upi';
  const ok = await repo.payBill(req.user.id, req.params.billingId, method);
  if (!ok) return res.status(404).json({ message: 'Unpaid bill not found' });
  res.json({ message: 'Payment successful' });
});
