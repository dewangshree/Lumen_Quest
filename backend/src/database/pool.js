const { Pool, types } = require('pg');
require('../config');

// Return NUMERIC columns as JS numbers and DATE columns as 'YYYY-MM-DD' strings
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(1082, (v) => v);
// COUNT(*) returns bigint (int8); values here are small, so parse as number
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Run `vercel env pull .env.local` in backend/ to fetch it.');
}

// Use full certificate verification for Neon (sslmode=verify-full); keep everything else from the URL.
const url = new URL(connectionString);
if (url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'verify-full');

const pool = new Pool({ connectionString: url.toString(), max: 3 });

const query = async (text, params) => (await pool.query(text, params)).rows;

module.exports = { pool, query };
