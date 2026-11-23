const bcrypt = require('bcryptjs');
const repo = require('../database/repo');
const handle = require('../utils/handle');
const { sendAccountCreatedEmail } = require('../services/email');

// GET /api/admin/stats
exports.stats = handle(async (req, res) => {
  res.json(await repo.getStats());
});

// GET /api/admin/customers
exports.customers = handle(async (req, res) => {
  res.json(await repo.getCustomers());
});

// POST /api/admin/customers  { name, email, phone?, plan_id? }
// Creates a customer with a temporary password and optionally subscribes them to a plan.
exports.createCustomer = handle(async (req, res) => {
  const { name, email, phone, plan_id } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: 'name and email are required' });

  const tempPassword = Math.random().toString(36).slice(2, 10) + 'A1';
  const password_hash = await bcrypt.hash(tempPassword, 10);
  const userId = await repo.createUser({ name, email, phone, password_hash, role: 'user' });
  let subscription = null;
  if (plan_id) subscription = (await repo.subscribe(userId, plan_id)).subscription;

  const mail = await sendAccountCreatedEmail({ name, email, tempPassword });
  res.status(201).json({ message: 'Customer created', userId, tempPassword, subscription, emailSent: mail.sent });
});

// GET /api/admin/customers/:id
exports.customerDetail = handle(async (req, res) => {
  const detail = await repo.getCustomerDetail(req.params.id);
  if (!detail) return res.status(404).json({ message: 'Customer not found' });
  res.json(detail);
});

// PATCH /api/admin/customers/:id  { status: 'active' | 'inactive' }
exports.updateCustomer = handle(async (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ message: 'status must be active or inactive' });
  const detail = await repo.getCustomerDetail(req.params.id);
  if (!detail) return res.status(404).json({ message: 'Customer not found' });
  await repo.updateUser(req.params.id, { status });
  res.json({ message: `Customer marked ${status}` });
});

// POST /api/admin/customers/:id/subscription  { plan_id }
exports.assignPlan = handle(async (req, res) => {
  const { plan_id } = req.body || {};
  if (!plan_id) return res.status(400).json({ message: 'plan_id is required' });
  const detail = await repo.getCustomerDetail(req.params.id);
  if (!detail) return res.status(404).json({ message: 'Customer not found' });
  const { subscription } = await repo.subscribe(req.params.id, plan_id, { paymentMethod: 'cash' });
  res.status(201).json({ message: `Customer moved to ${subscription.plan_name}`, subscription });
});

// POST /api/admin/subscriptions/:id/(pause|resume|cancel)
const ACTIONS = { pause: 'pauseSubscription', resume: 'resumeSubscription', cancel: 'cancelSubscription' };
const PAST = { pause: 'paused', resume: 'resumed', cancel: 'cancelled' };
exports.subscriptionAction = handle(async (req, res) => {
  const fn = ACTIONS[req.params.action];
  if (!fn) return res.status(404).json({ message: 'Unknown action' });
  const owner = await repo.getSubscriptionOwner(req.params.id);
  if (!owner) return res.status(404).json({ message: 'Subscription not found' });
  const ok = await repo[fn](owner, req.params.id);
  if (!ok) return res.status(409).json({ message: `Subscription cannot be ${PAST[req.params.action]} in its current state` });
  res.json({ message: `Subscription ${PAST[req.params.action]}` });
});

// GET /api/admin/billing?status=paid|pending|failed
exports.billing = handle(async (req, res) => {
  const status = ['paid', 'pending', 'failed'].includes(req.query.status) ? req.query.status : undefined;
  res.json(await repo.getAllBills({ status }));
});

// POST /api/admin/billing/:id/mark-paid  { payment_method? }
exports.markPaid = handle(async (req, res) => {
  const allowed = ['credit_card', 'debit_card', 'upi', 'cash'];
  const method = allowed.includes((req.body || {}).payment_method) ? req.body.payment_method : 'cash';
  const ok = await repo.markBillPaid(req.params.id, method);
  if (!ok) return res.status(404).json({ message: 'Unpaid bill not found' });
  res.json({ message: 'Bill marked as paid' });
});

// GET /api/admin/plans  (plans with subscriber counts, including inactive plans)
exports.plans = handle(async (req, res) => {
  const [plans, usage] = await Promise.all([repo.getAllPlans(), repo.getPlanUsage()]);
  const byId = new Map(usage.map((u) => [u.plan_id, u]));
  res.json(plans.map((p) => ({ ...p, ...(byId.get(p.plan_id) || { active_subscribers: 0, total_subscriptions: 0 }) })));
});
