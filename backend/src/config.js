const path = require('path');
const dotenv = require('dotenv');

// Local dev: .env.local (from `vercel env pull`) then .env. On Vercel, env vars are injected.
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

function secret(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`${name} environment variable is required in production`);
  return devFallback;
}

module.exports = {
  JWT_SECRET: secret('JWT_SECRET', 'dev-access-secret'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
};
