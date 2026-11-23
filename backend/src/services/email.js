// Transactional email over SMTP (Gmail App Password works out of the box).
// Configure with SMTP_USER, SMTP_PASS and optionally SMTP_HOST/SMTP_PORT/MAIL_FROM/APP_URL.
// When SMTP isn't configured, emails are skipped and the app keeps working.
const nodemailer = require('nodemailer');

const APP_URL = (process.env.APP_URL || 'https://dewangshree.github.io/Lumen_Quest').replace(/\/$/, '');
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return transporter;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
      <tr><td style="background:#0f172a;padding:20px 28px">
        <span style="display:inline-block;background:#0d9488;color:#fff;border-radius:8px;padding:4px 9px;font-weight:700">⚡</span>
        <span style="color:#fff;font-size:18px;font-weight:600;margin-left:8px">SubsPro</span>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:22px">${title}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">
        You're receiving this because an account was created on SubsPro with this email address.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a>`;

async function send(to, subject, html, text) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email] SMTP not configured; skipped "${subject}"`);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || `SubsPro <${process.env.SMTP_USER}>`, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { sent: false, reason: 'error' };
  }
}

function sendWelcomeEmail({ name, email }) {
  const first = esc(String(name).split(' ')[0] || 'there');
  const html = layout(`Welcome to SubsPro, ${first}! 🎉`, `
    <p style="line-height:1.6;color:#334155">Your account is ready. Pick a plan, manage your subscription and download invoices any time from your dashboard.</p>
    <ul style="line-height:1.8;color:#334155;padding-left:18px">
      <li>Compare plans and subscribe in a few clicks</li>
      <li>Pause or switch plans whenever you need</li>
      <li>Get personalised suggestions to save money</li>
    </ul>
    <p style="margin:24px 0">${button(`${APP_URL}/subscribe/`, 'Browse plans')}</p>
    <p style="color:#64748b;font-size:14px">Signed up as <strong>${esc(email)}</strong>. Sign in at <a href="${APP_URL}/login/?as=customer" style="color:#0d9488">${APP_URL}/login</a>.</p>`);
  const text = `Welcome to SubsPro, ${name}!\n\nYour account is ready. Browse plans: ${APP_URL}/subscribe/\nSign in: ${APP_URL}/login/?as=customer`;
  return send(email, 'Welcome to SubsPro 🎉', html, text);
}

function sendAccountCreatedEmail({ name, email, tempPassword }) {
  const first = esc(String(name).split(' ')[0] || 'there');
  const html = layout(`Your SubsPro account is ready, ${first}`, `
    <p style="line-height:1.6;color:#334155">An administrator created an account for you. Use these details to sign in, then change your password from <em>Profile &amp; Security</em>.</p>
    <table role="presentation" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px">
      <tr><td style="color:#64748b;padding:4px 12px 4px 0">Email</td><td><strong>${esc(email)}</strong></td></tr>
      <tr><td style="color:#64748b;padding:4px 12px 4px 0">Temporary password</td><td><code style="font-size:15px">${esc(tempPassword)}</code></td></tr>
    </table>
    <p style="margin:24px 0">${button(`${APP_URL}/login/?as=customer`, 'Sign in')}</p>`);
  const text = `Your SubsPro account is ready.\nEmail: ${email}\nTemporary password: ${tempPassword}\nSign in: ${APP_URL}/login/?as=customer`;
  return send(email, 'Your SubsPro account is ready', html, text);
}

module.exports = { sendWelcomeEmail, sendAccountCreatedEmail, isEmailConfigured: () => !!getTransporter() };
