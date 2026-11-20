// Data access layer (PostgreSQL via Neon).
const { pool, query } = require('./pool');

const USER_COLS = 'user_id, name, email, phone, role, status, created_at, updated_at';
const PLAN_FIELDS = ['plan_name', 'price', 'quota_sessions', 'validity_days', 'auto_renewal_allowed', 'description', 'status'];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const conflict = (message) => Object.assign(new Error(message), { status: 409 });
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Translate Postgres constraint errors into 4xx errors
function mapPgError(e) {
  if (e.code === '23505') return conflict('Email already registered');
  if (e.code === '23514' || e.code === '22P02') return badRequest('Invalid value: ' + (e.constraint || e.message));
  if (e.code === '23503') return conflict('Record is still referenced by other data');
  return e;
}
const safe = (fn) => async (...args) => {
  try { return await fn(...args); } catch (e) { throw mapPgError(e); }
};

// ---------------- Users ----------------
const findUserByEmail = safe(async (email) =>
  (await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]))[0] || null);

const createUser = safe(async ({ name, email, phone, password_hash, role = 'user' }) =>
  (await query(
    'INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
    [name, email, phone || null, password_hash, role]
  ))[0].user_id);

const getUserById = safe(async (id) =>
  (await query(`SELECT ${USER_COLS} FROM users WHERE user_id = $1`, [id]))[0] || null);

const getAllUsers = safe(async () => query(`SELECT ${USER_COLS} FROM users ORDER BY user_id`));

const updateUser = safe(async (id, fields) => {
  const keys = Object.keys(fields);
  if (!keys.length) return true;
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const rows = await query(
    `UPDATE users SET ${sets}, updated_at = now() WHERE user_id = $${keys.length + 1} RETURNING user_id`,
    [...keys.map((k) => fields[k]), id]
  );
  return rows.length > 0;
});

const deleteUser = safe(async (id) =>
  (await query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [id])).length > 0);

// ---------------- Plans ----------------
const getAllPlans = safe(async ({ activeOnly = false } = {}) =>
  query(`SELECT * FROM plans ${activeOnly ? "WHERE status = 'Active'" : ''} ORDER BY price`));

const getPlanById = safe(async (id) =>
  (await query('SELECT * FROM plans WHERE plan_id = $1', [id]))[0] || null);

const createPlan = safe(async (data) => {
  const d = pick(data, PLAN_FIELDS);
  const keys = Object.keys(d);
  const rows = await query(
    `INSERT INTO plans (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING plan_id`,
    keys.map((k) => d[k])
  );
  return rows[0].plan_id;
});

const updatePlan = safe(async (id, data) => {
  const d = pick(data, PLAN_FIELDS);
  const keys = Object.keys(d);
  if (!keys.length) return !!(await getPlanById(id));
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const rows = await query(
    `UPDATE plans SET ${sets}, updated_at = now() WHERE plan_id = $${keys.length + 1} RETURNING plan_id`,
    [...keys.map((k) => d[k]), id]
  );
  return rows.length > 0;
});

const deletePlan = safe(async (id) =>
  (await query('DELETE FROM plans WHERE plan_id = $1 RETURNING plan_id', [id])).length > 0);

// ---------------- Subscriptions ----------------
const SUB_SELECT = `
  SELECT s.*, p.plan_name, p.price, p.quota_sessions, p.validity_days
  FROM subscriptions s JOIN plans p ON p.plan_id = s.plan_id`;

const getSubscriptionsForUser = safe(async (userId) =>
  query(`${SUB_SELECT} WHERE s.user_id = $1 ORDER BY s.start_date DESC, s.sub_id DESC`, [userId]));

// Subscribe a user to a plan: cancels any active subscription, creates a new one and a paid bill.
const subscribe = safe(async (userId, planId, { paymentMethod = 'credit_card' } = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plan = (await client.query("SELECT * FROM plans WHERE plan_id = $1 AND status = 'Active'", [planId])).rows[0];
    if (!plan) throw Object.assign(new Error('Plan not found or inactive'), { status: 404 });

    await client.query(
      "UPDATE subscriptions SET status = 'cancelled', terminated_date = CURRENT_DATE WHERE user_id = $1 AND status IN ('active', 'paused')",
      [userId]
    );
    const sub = (await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, type, status, start_date, end_date, last_billed_date)
       VALUES ($1, $2, 'monthly', 'active', CURRENT_DATE, CURRENT_DATE + $3::int, CURRENT_DATE)
       RETURNING *`,
      [userId, planId, plan.validity_days]
    )).rows[0];
    const bill = (await client.query(
      `INSERT INTO billing (sub_id, amount, billing_date, payment_status, payment_method, transaction_id)
       VALUES ($1, $2, CURRENT_DATE, 'paid', $3, $4) RETURNING *`,
      [sub.sub_id, plan.price, paymentMethod, `TXN-${Date.now()}-${sub.sub_id}`]
    )).rows[0];
    await client.query('COMMIT');
    return { subscription: { ...sub, plan_name: plan.plan_name, price: plan.price }, bill };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

const cancelSubscription = safe(async (userId, subId) =>
  (await query(
    "UPDATE subscriptions SET status = 'cancelled', terminated_date = CURRENT_DATE WHERE sub_id = $1 AND user_id = $2 AND status IN ('active', 'paused') RETURNING sub_id",
    [subId, userId]
  )).length > 0);

// ---------------- Admin: customers & stats ----------------
const getCustomers = safe(async () => query(`
  SELECT u.user_id AS id, u.name, u.email, u.phone, u.status AS account_status, u.created_at,
         ls.status AS subscription_status, ls.plan_name AS subscription, ls.start_date,
         COALESCE(b.total_spent, 0) AS total_spent, b.last_payment
  FROM users u
  LEFT JOIN LATERAL (
    SELECT s.status, p.plan_name, s.start_date FROM subscriptions s JOIN plans p ON p.plan_id = s.plan_id
    WHERE s.user_id = u.user_id ORDER BY s.start_date DESC, s.sub_id DESC LIMIT 1
  ) ls ON true
  LEFT JOIN LATERAL (
    SELECT SUM(bi.amount) FILTER (WHERE bi.payment_status = 'paid') AS total_spent,
           MAX(bi.billing_date) FILTER (WHERE bi.payment_status = 'paid') AS last_payment
    FROM billing bi JOIN subscriptions s ON s.sub_id = bi.sub_id WHERE s.user_id = u.user_id
  ) b ON true
  WHERE u.role = 'user'
  ORDER BY u.user_id DESC`));

const getStats = safe(async () => {
  const [kpi] = await query(`
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM billing WHERE payment_status = 'paid')    AS total_revenue,
      (SELECT COALESCE(SUM(amount), 0) FROM billing WHERE payment_status = 'pending') AS pending_revenue,
      (SELECT COALESCE(SUM(amount), 0) FROM billing WHERE payment_status = 'failed')  AS failed_revenue,
      (SELECT COUNT(*) FROM users WHERE role = 'user')                                AS total_customers,
      (SELECT COUNT(*) FROM users WHERE role = 'user' AND status = 'active')          AS active_customers,
      (SELECT COUNT(*) FROM subscriptions)                                            AS total_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active')                    AS active_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status IN ('cancelled', 'expired'))   AS churned_subscriptions,
      (SELECT COUNT(DISTINCT s.user_id) FROM billing b JOIN subscriptions s ON s.sub_id = b.sub_id
        WHERE b.payment_status = 'paid')                                              AS paying_customers`);

  const revenueByMonth = await query(`
    SELECT to_char(date_trunc('month', billing_date), 'YYYY-MM') AS month,
           SUM(amount) FILTER (WHERE payment_status = 'paid') AS revenue,
           COUNT(*) AS bills
    FROM billing GROUP BY 1 ORDER BY 1 DESC LIMIT 24`);

  const subscriptionsByMonth = await query(`
    SELECT to_char(date_trunc('month', start_date), 'YYYY-MM') AS month,
           COUNT(*) AS new,
           COUNT(*) FILTER (WHERE status IN ('cancelled', 'expired')) AS churned
    FROM subscriptions GROUP BY 1 ORDER BY 1 DESC LIMIT 24`);

  const planDistribution = await query(`
    SELECT p.plan_name AS name, COUNT(s.sub_id) AS value
    FROM plans p LEFT JOIN subscriptions s ON s.plan_id = p.plan_id AND s.status IN ('active', 'paused')
    GROUP BY p.plan_id, p.plan_name ORDER BY value DESC`);

  const statusBreakdown = await query(`
    SELECT status AS name, COUNT(*) AS value FROM subscriptions GROUP BY status ORDER BY value DESC`);

  const topCustomers = await query(`
    SELECT u.user_id AS id, u.name, SUM(b.amount) AS total_spent,
           (SELECT p.plan_name FROM subscriptions s2 JOIN plans p ON p.plan_id = s2.plan_id
             WHERE s2.user_id = u.user_id ORDER BY s2.start_date DESC, s2.sub_id DESC LIMIT 1) AS plan
    FROM users u JOIN subscriptions s ON s.user_id = u.user_id
    JOIN billing b ON b.sub_id = s.sub_id AND b.payment_status = 'paid'
    GROUP BY u.user_id, u.name ORDER BY total_spent DESC LIMIT 5`);

  const recentActivity = await query(`
    SELECT b.billing_id AS id, b.payment_status AS type, u.name, p.plan_name, b.amount,
           b.billing_date AS date, b.created_at
    FROM billing b JOIN subscriptions s ON s.sub_id = b.sub_id
    JOIN users u ON u.user_id = s.user_id JOIN plans p ON p.plan_id = s.plan_id
    ORDER BY b.billing_date DESC, b.billing_id DESC LIMIT 8`);

  return {
    kpi: {
      ...kpi,
      churn_rate: kpi.total_subscriptions ? +(100 * kpi.churned_subscriptions / kpi.total_subscriptions).toFixed(1) : 0,
      arpu: kpi.paying_customers ? +(kpi.total_revenue / kpi.paying_customers).toFixed(2) : 0,
    },
    revenueByMonth: revenueByMonth.reverse(),
    subscriptionsByMonth: subscriptionsByMonth.reverse(),
    planDistribution,
    statusBreakdown,
    topCustomers,
    recentActivity,
  };
});

module.exports = {
  findUserByEmail, createUser, getUserById, getAllUsers, updateUser, deleteUser,
  getAllPlans, getPlanById, createPlan, updatePlan, deletePlan,
  getSubscriptionsForUser, subscribe, cancelSubscription,
  getCustomers, getStats,
};
