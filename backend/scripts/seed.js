// Creates the schema and loads sample data into the Postgres database.
//   node scripts/seed.js          -> create tables; seed only if the database is empty
//   node scripts/seed.js --reset  -> drop all tables, recreate and reseed
//
// Sample data:
//   - 5 plans (from the original seed.sql)
//   - demo accounts: admin@lumen.com / admin123, aman|rahul|lokesh|harsh@example.com / password123
//   - 100 users, subscriptions and billing records from SubscriptionUseCase_Dataset.xlsx
//     (dataset users log in as user<N>@example.com / password123). The dataset's 100
//     product ids are mapped onto the 5 plans as ((productId - 1) % 5).
//     Dataset dates (Dec 2023 – Nov 2024) are shifted forward so the latest record falls on
//     today; a subscription's end date is its last renewal (or start) plus its billing period,
//     and "active" subscriptions whose end date has passed are stored as "expired".
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/database/pool');
const dataset = require('../src/data/dataset.json');

const reset = process.argv.includes('--reset');

const addDays = (iso, days) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const orNull = (v) => (v === '' || v === undefined ? null : v);

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (reset) {
      await client.query('DROP TABLE IF EXISTS billing, subscriptions, plans, users CASCADE');
      console.log('Dropped existing tables');
    }
    await client.query(fs.readFileSync(path.join(__dirname, '../src/database/schema.sql'), 'utf8'));

    const { rows: [{ count }] } = await client.query('SELECT COUNT(*)::int AS count FROM users');
    if (count > 0) {
      console.log(`Database already has ${count} users; skipping seed (use --reset to reseed).`);
      await client.query('COMMIT');
      return;
    }

    // Plans
    const plans = [
      ['Monthly Plan', 299, 10, 30, 'Basic plan with unlimited data per month'],
      ['Quarterly Plan', 599, 25, 90, 'Premium plan with unlimited data for 3 months'],
      ['Yearly Plan', 999, 50, 365, 'Enterprise plan with unlimited data for 12 months'],
      ['Postpaid Plan', 199, 5, 30, 'Discounted plan for postpaid users'],
      ['Top-up Plan', 99, 35, 30, 'Additional 10 GB data per month'],
    ];
    const planIds = [];
    for (const [name, price, quota, validity, desc] of plans) {
      const r = await client.query(
        'INSERT INTO plans (plan_name, price, quota_sessions, validity_days, description) VALUES ($1,$2,$3,$4,$5) RETURNING plan_id',
        [name, price, quota, validity, desc]
      );
      planIds.push(r.rows[0].plan_id);
    }

    const userHash = await bcrypt.hash('password123', 10);
    const adminHash = await bcrypt.hash('admin123', 10);
    const insertUser = async (name, email, phone, hash, role, status) =>
      (await client.query(
        'INSERT INTO users (name, email, phone, password_hash, role, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING user_id',
        [name, email, phone, hash, role, status]
      )).rows[0].user_id;
    const insertSub = async (userId, planId, type, status, start, extra = {}) =>
      (await client.query(
        `INSERT INTO subscriptions (user_id, plan_id, type, status, start_date, end_date, last_billed_date, last_renewed_date, terminated_date, grace_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING sub_id`,
        [userId, planId, type, status, start, extra.end || addDays(start, type === 'yearly' ? 365 : 30),
          orNull(extra.lastBilled), orNull(extra.lastRenewed), orNull(extra.terminated), extra.grace || 5]
      )).rows[0].sub_id;
    const insertBill = (subId, amount, date, status, method, txn) =>
      client.query(
        'INSERT INTO billing (sub_id, amount, billing_date, payment_status, payment_method, transaction_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [subId, amount, date, status, method, txn]
      );

    // Demo accounts (from the original seed.sql)
    await insertUser('Admin User', 'admin@lumen.com', '1234567892', adminHash, 'admin', 'active');
    const today = new Date().toISOString().slice(0, 10);
    const demo = [
      ['Aman Raj', 'aman@example.com', '1234567890', 0, 'active', 0],
      ['Rahul Singh', 'rahul@example.com', '1234567891', 1, 'active', 0],
      ['Lokesh Sahu', 'lokesh@example.com', '1234567893', 2, 'active', -15],
      ['Harsh Pandey', 'harsh@example.com', '1234567894', 0, 'expired', -45],
    ];
    for (const [i, [name, email, phone, planIdx, status, offset]] of demo.entries()) {
      const uid = await insertUser(name, email, phone, userHash, 'user', 'active');
      const start = addDays(today, offset);
      const sid = await insertSub(uid, planIds[planIdx], 'monthly', status, start, { lastBilled: start });
      await insertBill(sid, plans[planIdx][1], start, 'paid', ['credit_card', 'upi', 'debit_card'][i % 3], `TXN00${i + 1}`);
    }

    // Shift dataset dates so the most recent record lands on today
    const latest = [...dataset.Billing_Information.map((b) => b.billing_date), ...dataset.Subscriptions.map((x) => x['Start Date'])]
      .filter(Boolean).sort().pop();
    const shiftDays = Math.round((new Date(today) - new Date(latest)) / 86400000);
    const shift = (d) => (d ? addDays(d, shiftDays) : null);

    // Dataset users
    const userMap = new Map();
    for (const u of dataset.User_Data) {
      const status = String(u.Status).toLowerCase() === 'inactive' ? 'inactive' : 'active';
      userMap.set(Number(u['User Id']), await insertUser(u.Name, u.Email, String(u.Phone || ''), userHash, 'user', status));
    }

    // Dataset subscriptions
    const subMap = new Map();
    for (const s of dataset.Subscriptions) {
      const uid = userMap.get(Number(s['User Id']));
      if (!uid) continue;
      const raw = String(s.Status).toLowerCase();
      let status = ['active', 'paused', 'expired', 'cancelled'].includes(raw) ? raw : 'active';
      const planId = planIds[(Number(s['Product Id']) - 1) % planIds.length];
      const type = String(s['Subscription Type']).toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
      const start = shift(s['Start Date']);
      const lastRenewed = shift(s['Last Renewed Date']);
      const periodStart = lastRenewed && lastRenewed > start ? lastRenewed : start;
      const end = addDays(periodStart, type === 'yearly' ? 365 : 30);
      if (status === 'active' && end < today) status = 'expired';
      subMap.set(Number(s['Subscription Id']), await insertSub(uid, planId, type, status, start, {
        end, lastBilled: shift(s['Last Billed Date']), lastRenewed,
        terminated: shift(s['Terminated Date']), grace: Number(s['Grace Time']) || 5,
      }));
    }

    // Dataset billing
    let bills = 0;
    for (const b of dataset.Billing_Information) {
      const sid = subMap.get(Number(b.subscription_id));
      if (!sid) continue;
      const st = String(b.payment_status).toLowerCase();
      await insertBill(sid, b.amount, shift(b.billing_date), ['paid', 'pending', 'failed'].includes(st) ? st : 'pending', 'credit_card', `DS-${b.billing_id}`);
      bills++;
    }

    await client.query('COMMIT');
    console.log(`Seeded ${plans.length} plans, ${5 + userMap.size} users, ${4 + subMap.size} subscriptions, ${4 + bills} bills`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
