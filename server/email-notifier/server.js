require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { CognitoJwtVerifier } = require('aws-jwt-verify');

const app = express();
app.use(express.json());

/* ---------- CORS (only the site's own origins may call this) ---------- */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-notify-key, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ---------- shared-secret gate ---------- */

app.use((req, res, next) => {
  if (req.headers['x-notify-key'] !== process.env.NOTIFY_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

/* ---------- simple in-memory rate limiting (per IP and per recipient) ---------- */

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // key -> timestamps[]

function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

/* ---------- Cognito ID token verification (admin/staff only, for service-update) ---------- */

const jwtVerifier = process.env.COGNITO_USER_POOL_ID
  ? CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
      tokenUse: 'id',
    })
  : null;

async function requireStaff(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !jwtVerifier) throw new Error('Missing or unsupported authorization');
  const payload = await jwtVerifier.verify(token);
  const groups = payload['cognito:groups'] || [];
  if (!groups.includes('admin') && !groups.includes('staff')) throw new Error('Not staff');
}

/* ---------- mail transport (Gmail via OAuth2 — no plaintext password stored) ---------- */

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_USER,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});

/* ---------- helpers ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Strip control characters (incl. CR/LF) so nothing can inject extra mail headers or lines.
const clean = (s, max = 200) => String(s ?? '').replace(/[\r\n\x00-\x1f]+/g, ' ').trim().slice(0, max);
// Each line sanitized the same way as clean(); capped so a crafted payload can't blow up the email.
const cleanLines = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 20).map(l => clean(l, 200)).filter(Boolean);

const KIND_BUILDERS = {
  'signup-code': ({ name }) => ({
    subject: 'Confirm your SacraDigit account',
    text: `Hi ${name || 'there'},\n\nWe just sent a 6-digit verification code to this email address to confirm your new SacraDigit parishioner account.\n\nPlease check your inbox (and spam folder) for a message from AWS Cognito and enter that code on the sign-up screen. If you didn't try to create a SacraDigit account, you can ignore this message.\n\n— SacraDigit`,
  }),
  'password-reset': ({ name }) => ({
    subject: 'SacraDigit password reset requested',
    text: `Hi ${name || 'there'},\n\nWe just sent a 6-digit code to this email address to reset your SacraDigit password.\n\nPlease check your inbox (and spam folder) for a message from AWS Cognito and enter that code on the reset screen. If you didn't request this, you can ignore this message — your password will stay the same.\n\n— SacraDigit`,
  }),
  'service-update': ({ name, serviceType, status, date, time, declineReason, location, contact, detailsLines }) => {
    const who = name || 'there';
    const service = serviceType || 'service request';
    if (status === 'declined') {
      return {
        subject: `Update on your ${service} request`,
        text: `Hi ${who},\n\nWe're sorry — your ${service} request could not be scheduled.${declineReason ? `\n\nReason: ${declineReason}` : ''}\n\nPlease contact the parish office if you have questions or would like to submit a new request.\n\n— SacraDigit`,
      };
    }
    const facts = [
      `Service: ${service}`,
      `Date: ${date || 'TBD'}`,
      ...(time ? [`Time: ${time}`] : []),
      ...(location ? [`Location: ${location}`] : []),
      ...(contact ? [`Contact: ${contact}`] : []),
      ...detailsLines,
    ];
    const factBlock = facts.join('\n');
    return {
      subject: `Confirmed: your ${service} request`,
      text: `Hi ${who},\n\nGood news — your ${service} request is confirmed. Here are the details:\n\n${factBlock}\n\nYou can see this anytime under "Requested Services" in SacraDigit. If anything above looks wrong, please contact the parish office.\n\n— SacraDigit`,
    };
  },
};

/* ---------- the one endpoint ---------- */

app.post('/notify-parishioner', async (req, res) => {
  const { kind, to } = req.body || {};
  const build = KIND_BUILDERS[kind];
  if (!build) return res.status(400).json({ success: false, error: 'Unsupported notification kind' });
  if (!EMAIL_RE.test(String(to || ''))) return res.status(400).json({ success: false, error: 'Invalid recipient email' });

  const ip = req.ip || 'unknown';
  if (rateLimited(`ip:${ip}`) || rateLimited(`to:${to}`)) {
    return res.status(429).json({ success: false, error: 'Too many requests — please slow down' });
  }

  if (kind === 'service-update') {
    try { await requireStaff(req); }
    catch { return res.status(403).json({ success: false, error: 'Staff sign-in required' }); }
  }

  const data = {
    name: clean(req.body.name, 100),
    serviceType: clean(req.body.serviceType, 100),
    status: clean(req.body.status, 30),
    date: clean(req.body.date, 40),
    time: clean(req.body.time, 40),
    declineReason: clean(req.body.declineReason, 400),
    location: clean(req.body.location, 200),
    contact: clean(req.body.contact, 60),
    detailsLines: cleanLines(req.body.detailsLines),
  };

  try {
    const { subject, text } = build(data);
    await transporter.sendMail({ from: process.env.GMAIL_USER, to, subject, text });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Could not send the email' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Email notifier running on http://localhost:${PORT}`));
