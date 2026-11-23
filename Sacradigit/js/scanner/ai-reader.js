/* ============================================
   SacraDigit — AI reader client
   Talks to the local AI reader service
   (server/ai-ocr: PaddleOCR + Qwen2.5-VL through
   Ollama). It is optional: when the service isn't
   running, aiReaderReady() is false and the scanner
   uses the built-in Tesseract reader as before.

   Set where the service lives with
     VITE_OCR_API_URL   (default in `npm run dev`: http://127.0.0.1:8008)
     VITE_OCR_API_KEY   (only if OCR_API_KEY is set on the service)
   In a production build there is no default, so the
   deployed site never probes the visitor's computer
   unless you configure a URL.
   ============================================ */

import { DOC_TYPES, buildRows, rowsToText, averageConfidence, parseDate, splitName } from './scan-engine.js';

const BASE = String(import.meta.env.VITE_OCR_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8008' : '')).replace(/\/$/, '');
const KEY = import.meta.env.VITE_OCR_API_KEY || '';

const SEND_MAX_SIDE = 2400;          // matches the service's OCR_MAX_SIDE
const SCAN_TIMEOUT_MS = 12 * 60 * 1000; // a CPU-only laptop can take a few minutes per page

const authHeaders = () => (KEY ? { 'x-ocr-key': KEY } : {});

/* ------------------------------------------
   Is the service up, with its AI model ready?
------------------------------------------ */

let health = { at: 0, ready: false };

export async function aiReaderReady({ force = false } = {}) {
  if (!BASE) return false;
  if (!force && Date.now() - health.at < 15000) return health.ready;
  let ready = false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(`${BASE}/health`, { headers: authHeaders(), signal: ctl.signal });
    ready = r.ok && !!(await r.json()).ready;
  } catch { ready = false; }
  clearTimeout(timer);
  health = { at: Date.now(), ready };
  return ready;
}

/* ------------------------------------------
   Reading a page
------------------------------------------ */

function fitCanvas(src) {
  const k = Math.min(1, SEND_MAX_SIDE / Math.max(src.width, src.height));
  if (k === 1) return src;
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const toJpeg = (canvas) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the page image'))), 'image/jpeg', 0.92));

/**
 * Reads one page with the AI reader.
 *   source      canvas of the page, already rotated the right way up
 *   docTypeKey  key of DOC_TYPES (birth, baptism, …)
 *   onProgress({ stage: 'ai', progress })   (progress is an estimate, 0–1)
 * Returns the same shape as scanPage() plus `ai: { docType, model, fields, seconds }`
 * (fields: what the AI read, per form-field key). Throws if the service
 * fails or the AI step didn't run — the caller then falls back to Tesseract.
 */
export async function scanPageAi(source, { docTypeKey, onProgress = () => {} }) {
  const spec = DOC_TYPES[docTypeKey];
  const canvas = fitCanvas(source);
  const blob = await toJpeg(canvas);

  const form = new FormData();
  form.append('image', blob, 'page.jpg');
  form.append('docLabel', spec ? spec.label : 'Certificate');
  form.append('fields', JSON.stringify((spec?.fields || []).map(({ key, label, kind }) => ({ key, label, kind }))));

  // The service gives no live progress, so show a slow estimate that never reaches 100%.
  const started = Date.now();
  onProgress({ stage: 'ai', progress: 0 });
  const tick = setInterval(() => {
    const s = (Date.now() - started) / 1000;
    onProgress({ stage: 'ai', progress: 1 - 1 / (1 + s / 45), seconds: Math.round(s) });
  }, 1000);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SCAN_TIMEOUT_MS);
  let data;
  try {
    const r = await fetch(`${BASE}/scan`, { method: 'POST', body: form, headers: authHeaders(), signal: ctl.signal });
    if (!r.ok) throw new Error(`AI reader answered ${r.status}`);
    data = await r.json();
  } finally {
    clearTimeout(timer);
    clearInterval(tick);
  }

  if (!data.ai?.used) throw new Error(data.ai?.error || 'The AI step did not run');

  const rows = buildRows(data.words || []);
  return {
    canvas,
    words: data.words || [],
    rows,
    text: data.text || rowsToText(rows),
    confidence: averageConfidence(rows),
    skew: 0,
    ai: { docType: docTypeKey, model: data.ai.model, fields: data.fields || {}, seconds: data.seconds },
  };
}

/**
 * Turns the AI's answers into the same { value, text, conf } shape that
 * extractFields() returns, so the form fills the same way for both readers.
 */
export function aiFieldsToFound(ai, spec) {
  const out = {};
  if (!ai || !spec) return out;
  for (const f of spec.fields) {
    const hit = ai.fields[f.key];
    if (!hit || !hit.value) continue;
    let value = hit.value;
    if (f.kind === 'name') value = splitName(hit.value);
    else if (f.kind === 'date') value = /^\d{4}-\d{2}-\d{2}$/.test(hit.value) ? hit.value : (parseDate(hit.value) || hit.value);
    out[f.key] = { value, text: hit.value, conf: hit.conf, words: [], ai: true };
  }
  return out;
}
