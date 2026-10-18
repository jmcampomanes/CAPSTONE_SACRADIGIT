require('dotenv').config();
const express = require('express');
const { CognitoJwtVerifier } = require('aws-jwt-verify');

const app = express();
app.use(express.json({ limit: '200kb' }));

/* ---------- CORS (only the site's own origins may call this) ---------- */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-chat-key, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ---------- shared-secret gate ---------- */

app.use((req, res, next) => {
  if (req.headers['x-chat-key'] !== process.env.CHAT_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

/* ---------- Cognito ID token verification — only signed-in parishioners may chat ---------- */

const jwtVerifier = process.env.COGNITO_USER_POOL_ID
  ? CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
      tokenUse: 'id',
    })
  : null;

async function requireSignedIn(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !jwtVerifier) throw new Error('Missing or unsupported authorization');
  await jwtVerifier.verify(token);
}

/* ---------- simple in-memory rate limiting (per IP) ---------- */

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map(); // key -> timestamps[]

function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

/* ---------- helpers ---------- */

const clean = (s, max) => String(s ?? '').slice(0, max);

function buildSystemPrompt(context, lang) {
  const langLine = lang === 'fil'
    ? 'Sumagot nang Filipino (Tagalog), maikli at magalang.'
    : 'Reply in English, concise and polite.';
  return [
    'You are the SacraDigit Parish Assistant, a chat assistant inside the parishioner portal of a Catholic parish.',
    langLine,
    'Only answer using the facts given below in PARISH CONTEXT (JSON). If something is not covered there, say you are not sure and suggest contacting the parish office — never invent Mass times, document requirements, or request statuses.',
    'Keep replies short: a few sentences, or a short list for multiple items. You may refer to a relevant portal page by name (e.g. "Mass Schedule", "Request a Certificate", "My Requests") but never invent a URL.',
    'PARISH CONTEXT.portalDirectory lists every page (tab) of the portal and what it does; currentPage is the page the parishioner has open. When someone asks where or how to do something, name the right page exactly as written there (use filipinoName when replying in Filipino) — the chat turns those names into links. Never mention a page that is not in portalDirectory.',
    'For pastoral concerns (confession, anointing of the sick, grief, spiritual direction), gently suggest they speak with a priest or the parish office directly instead of relying on this chat.',
    '',
    'PARISH CONTEXT (JSON):',
    JSON.stringify(context),
  ].join('\n');
}

/* ---------- the one endpoint ---------- */

app.post('/chat', async (req, res) => {
  try { await requireSignedIn(req); }
  catch (err) { console.error('Sign-in check failed:', err); return res.status(403).json({ success: false, error: 'Sign-in required' }); }

  const ip = req.ip || 'unknown';
  if (rateLimited(`ip:${ip}`)) {
    return res.status(429).json({ success: false, error: 'Too many requests — please slow down' });
  }

  const q = clean(req.body?.message, 500).trim();
  if (!q) return res.status(400).json({ success: false, error: 'Empty message' });

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
  const safeHistory = history.map(m => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: clean(m?.content, 1000),
  })).filter(m => m.content);

  const lang = req.body?.lang === 'fil' ? 'fil' : 'en';
  const messages = [
    { role: 'system', content: buildSystemPrompt(req.body?.context || {}, lang) },
    ...safeHistory,
    { role: 'user', content: q },
  ];

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.SITE_URL || '',
        'X-Title': process.env.SITE_NAME || 'SacraDigit',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!upstream.ok) {
      console.error('OpenRouter error', upstream.status, await upstream.text().catch(() => ''));
      return res.status(502).json({ success: false, error: 'The assistant is unavailable right now' });
    }

    const data = await upstream.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ success: false, error: 'The assistant is unavailable right now' });
    res.json({ success: true, reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'The assistant is unavailable right now' });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`AI chat proxy running on http://localhost:${PORT}`));
