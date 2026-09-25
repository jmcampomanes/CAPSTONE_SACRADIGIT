/* ============================================
   SacraDigit — Mass check-in (shared)
   Admin side opens a check-in session for a
   Mass and shows its QR code; parishioners scan
   it (or type the short code) to check in.

   The code itself is never stored: the session
   keeps only SHA-256(`${sessionId}:${CODE}`),
   and the backend's `checkIn` mutation checks
   the code, the time window, and duplicates.

   Needs the MassCheckInSession / MassCheckIn /
   ParishionerPreference models and the checkIn
   mutation (see the backend prompt). Until those
   are deployed, checkInReady() is false and the
   pages show a "not set up yet" note instead.
   ============================================ */

import { client } from './amplify-init.js';
import { parishionerKey } from './badges.js';

export function checkInReady() {
  return !!(client.models.MassCheckInSession && client.models.MassCheckIn && client.mutations && client.mutations.checkIn);
}

export function preferencesReady() {
  return !!client.models.ParishionerPreference;
}

// No 0/O, 1/I/L — easy to read off a screen and type.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** "K7PQ2M" → "K7P-Q2M" for display. */
export const formatCode = (code) => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code);

/** What a parishioner typed → the canonical code ("k7p q2m" → "K7PQ2M"). */
export const normalizeCode = (typed) => String(typed || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Parishioner link the QR code points to. */
export function checkInUrl(sessionId, code) {
  const url = new URL('../user/user-badges.html', window.location.href);
  url.searchParams.set('checkin', sessionId);
  url.searchParams.set('code', code);
  return url.toString();
}

/**
 * Opens check-in for a Mass. Returns { session, code }; the plain code
 * only lives in the caller's memory (and this browser's sessionStorage,
 * so a refresh of the admin screen can still show it).
 *   mass: { id?, date, time, title? }
 *   opens 30 min before the Mass, closes 90 min after it starts (or `minutes` from now).
 */
export async function startSession(mass, { minutesBefore = 30, minutesAfter = 90 } = {}) {
  const code = generateCode();
  const start = massStart(mass.date, mass.time) || new Date();
  const now = new Date();
  const opensAt = new Date(Math.min(now.getTime(), start.getTime() - minutesBefore * 60000));
  const closesAt = new Date(Math.max(now.getTime() + 15 * 60000, start.getTime() + minutesAfter * 60000));

  // Create first to get the id, then store the hash that includes it.
  const created = await client.models.MassCheckInSession.create({
    massId: mass.id || undefined,
    massDate: mass.date,
    massTime: mass.time,
    title: mass.title || undefined,
    codeHash: 'pending',
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    status: 'open',
  });
  if (created.errors) throw new Error(created.errors.map(e => e.message).join('; '));
  const session = created.data;
  const updated = await client.models.MassCheckInSession.update({
    id: session.id,
    codeHash: await sha256Hex(`${session.id}:${code}`),
  });
  if (updated.errors) throw new Error(updated.errors.map(e => e.message).join('; '));
  try { sessionStorage.setItem(`sacradigit_checkin_code_${session.id}`, code); } catch { /* private mode */ }
  return { session: updated.data, code };
}

export function rememberedCode(sessionId) {
  try { return sessionStorage.getItem(`sacradigit_checkin_code_${sessionId}`); } catch { return null; }
}

export async function closeSession(sessionId) {
  const res = await client.models.MassCheckInSession.update({ id: sessionId, status: 'closed', closesAt: new Date().toISOString() });
  if (res.errors) throw new Error(res.errors.map(e => e.message).join('; '));
  try { sessionStorage.removeItem(`sacradigit_checkin_code_${sessionId}`); } catch { /* ignore */ }
}

/** Live list of a session's check-ins → onChange(items). Returns an unsubscribe fn. */
export function watchSessionCheckIns(sessionId, onChange) {
  const sub = client.models.MassCheckIn.observeQuery({ filter: { sessionId: { eq: sessionId } } }).subscribe({
    next: ({ items }) => onChange(items),
    error: (err) => console.error('Failed to load check-ins:', err),
  });
  return () => sub.unsubscribe();
}

/** Sessions open right now (for typed codes, which don't say which Mass they're for). */
export async function openSessions() {
  const now = new Date().toISOString();
  const { data, errors } = await client.models.MassCheckInSession.list({
    filter: { status: { eq: 'open' }, closesAt: { gt: now }, opensAt: { le: now } },
    limit: 200,
  });
  if (errors) throw new Error(errors.map(e => e.message).join('; '));
  return data || [];
}

const REASONS = {
  not_found: 'That check-in code wasn’t found. Please scan the QR code again.',
  closed: 'Check-in for this Mass is closed.',
  bad_code: 'That code doesn’t match. Please check the code on the screen.',
  bad_name: 'Your name is missing from your profile.',
};

/**
 * Checks a parishioner in. With a sessionId (from the QR code) it goes
 * straight to that Mass; with only a typed code it tries each Mass open
 * right now. Returns { ok, already?, checkIn?, message }.
 */
export async function submitCheckIn({ sessionId, code, parishionerName }) {
  const clean = normalizeCode(code);
  if (clean.length < 4) return { ok: false, message: 'Please enter the code shown at church.' };
  const candidates = sessionId ? [sessionId] : (await openSessions()).map(s => s.id);
  if (!candidates.length) return { ok: false, message: 'There’s no Mass open for check-in right now.' };

  let last = null;
  for (const id of candidates) {
    const res = await client.mutations.checkIn({ sessionId: id, code: clean, parishionerName });
    if (res.errors) throw new Error(res.errors.map(e => e.message).join('; '));
    const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (body && body.ok) {
      return { ...body, message: body.already ? 'You’re already checked in for this Mass.' : 'You’re checked in. God bless!' };
    }
    last = body;
    if (body && body.reason !== 'bad_code') break; // wrong Mass only matters when guessing among several
  }
  return { ok: false, message: REASONS[last && last.reason] || 'Check-in didn’t go through. Please try again.' };
}

/** Every check-in for one parishioner (all pages). */
export async function listCheckInsFor(name) {
  const key = parishionerKey(name);
  const items = [];
  let nextToken = null;
  do {
    const { data, errors, nextToken: nt } = await client.models.MassCheckIn.list({ filter: { parishionerKey: { eq: key } }, limit: 500, nextToken });
    if (errors) throw new Error(errors.map(e => e.message).join('; '));
    items.push(...(data || []));
    nextToken = nt;
  } while (nextToken);
  return items;
}

/** Keys of parishioners who asked to be left off the Faithful Givers list. */
export async function optedOutKeys() {
  if (!preferencesReady()) return new Set();
  const { data } = await client.models.ParishionerPreference.list({ limit: 1000 });
  return new Set((data || []).filter(p => p.showOnHonorRoll === false).map(p => p.parishionerKey));
}

export async function getPreference(name) {
  if (!preferencesReady()) return null;
  const { data } = await client.models.ParishionerPreference.list({ filter: { parishionerKey: { eq: parishionerKey(name) } } });
  return (data || [])[0] || null;
}

export async function setShowOnHonorRoll(name, show) {
  const existing = await getPreference(name);
  const res = existing
    ? await client.models.ParishionerPreference.update({ id: existing.id, showOnHonorRoll: show })
    : await client.models.ParishionerPreference.create({ parishionerKey: parishionerKey(name), displayName: name, showOnHonorRoll: show });
  if (res.errors) throw new Error(res.errors.map(e => e.message).join('; '));
  return res.data;
}

/** Date of a Mass from its "YYYY-MM-DD" + "06:00 AM" parts. */
export function massStart(dateIso, time12) {
  if (!dateIso) return null;
  const m = String(time12 || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
  const d = new Date(`${dateIso}T00:00:00`);
  if (m) {
    let h = +m[1];
    const mer = (m[3] || '').toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    d.setHours(h, +m[2], 0, 0);
  }
  return d;
}
