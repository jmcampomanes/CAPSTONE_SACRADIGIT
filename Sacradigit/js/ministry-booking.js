/* ============================================
   SacraDigit Admin — Ministry Bookings (shared)
   People who serve the parish — lectors, choir,
   altar servers, ushers, parish staff, and the
   parish's ministries and organizations — use the
   parish rooms with no fee, once the office has
   verified that they serve here.

   How someone is verified (checkServant):
     0. Verified Parish Server — the Head Admin approved
        their Parish Server application (../../shared/js/parish-servers.js)
        and it hasn't expired.
     1. Ministry Roster — they served at a Mass in
        the last 90 days, or are signed up for one in
        the next 60 (MinistrySignup, ../../shared/js/ministry.js).
     2. On file — the Head Admin vouched for them in
        the last 6 months (an earlier ministry booking).
     3. Otherwise the Head Admin vouches now: the office
        records the ministry, their role and who
        confirmed it. Filed by the Secretary, the booking
        holds the room as "Waiting for the Head Admin"
        until the Head Admin verifies it.

   A ministry booking is an ordinary FacilityBooking
   (so it blocks the room on every booking page),
   with its verification kept as JSON in `notes`.
   Used by ministry-bookings.js and facility-booking.js.
   ============================================ */

import { MINISTRIES } from '../../shared/js/ministry.js';
import { SERVER_GROUPS, isVerified as serverVerified } from '../../shared/js/parish-servers.js';

export const ROSTER_BACK_DAYS = 90;
export const ROSTER_AHEAD_DAYS = 60;
export const VOUCH_MONTHS = 6;
const TAG = 'ministry-booking';

/** Ministries and parish groups offered when the Head Admin vouches for someone. */
export const GROUPS = SERVER_GROUPS;

/** The verification saved with a booking, or null for an ordinary booking. */
export function readMinistry(booking) {
  if (!booking?.notes) return null;
  try {
    const n = JSON.parse(booking.notes);
    return n && n.kind === TAG ? n : null;
  } catch { return null; }
}
export const isMinistryBooking = (b) => !!readMinistry(b);
export const isWaiting = (b) => !!readMinistry(b)?.waiting;

/** `notes` for a ministry booking. */
export const ministryNotes = (info) => JSON.stringify({ kind: TAG, v: 1, ...info });

const nameKey = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();
const pad2 = (n) => String(n).padStart(2, '0');
export const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDay(d); };
export const addMonths = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return isoDay(d); };
export const longDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const massDay = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const ministryOf = (id) => MINISTRIES.find(m => m.id === id) || { label: id, one: id };

/**
 * Is this person verified as serving the parish?
 * Returns { method: 'roster' | 'on-file', group, role, proof, validUntil? } or null.
 */
export function checkServant(name, { signups = [], bookings = [], servers = [], today = isoDay(new Date()) } = {}) {
  const key = nameKey(name);
  if (!key) return null;

  // 0. A verified Parish Server (they applied on the parishioner portal; the Head Admin approved).
  const server = servers.filter(a => nameKey(a.applicantName) === key && serverVerified(a, today))
    .sort((a, b) => String(b.validUntil).localeCompare(String(a.validUntil)))[0];
  if (server) {
    return {
      method: 'server', group: server.ministry, role: server.role, validUntil: server.validUntil,
      proof: `Verified Parish Server — ${server.role}, ${server.ministry} (approved by ${server.reviewedBy || 'the Head Admin'})`,
    };
  }

  // 1. Ministry Roster: the latest Mass they served (or the next one they're down for).
  const from = addDays(today, -ROSTER_BACK_DAYS), to = addDays(today, ROSTER_AHEAD_DAYS);
  const theirs = signups.filter(s => nameKey(s.volunteerName) === key && s.massDate >= from && s.massDate <= to);
  if (theirs.length) {
    const served = theirs.filter(s => s.massDate <= today).sort((a, b) => b.massDate.localeCompare(a.massDate))[0];
    const next = theirs.filter(s => s.massDate > today).sort((a, b) => a.massDate.localeCompare(b.massDate))[0];
    const s = served || next;
    const m = ministryOf(s.ministry);
    const mass = `${massDay(s.massDate)}${s.massTime ? ` ${s.massTime.replace(/^0/, '')}` : ''} Mass`;
    return { method: 'roster', group: m.label, role: m.one, proof: `${m.one} · ${served ? 'served' : 'signed up for'} ${mass}` };
  }

  // 2. On file: the Head Admin vouched for them recently.
  const vouched = bookings
    .map(b => ({ b, info: readMinistry(b) }))
    .filter(({ b, info }) => info && !info.waiting && info.method === 'vouched' && nameKey(b.requesterName) === key && (info.validUntil || '') >= today)
    .sort((a, b) => (b.info.validUntil || '').localeCompare(a.info.validUntil || ''))[0];
  if (vouched) {
    const { info } = vouched;
    return {
      method: 'on-file', group: info.group, role: info.role, validUntil: info.validUntil,
      proof: `Vouched by ${info.verifiedBy || info.checkedBy || 'the Head Admin'} on ${longDate((info.verifiedAt || info.checkedAt).slice(0, 10))}${info.confirmedWith ? ` (confirmed with ${info.confirmedWith})` : ''}`,
    };
  }
  return null;
}

/** Names to suggest while typing: everyone on the recent roster, plus anyone on file. */
export function servantNames({ signups = [], bookings = [], servers = [], today = isoDay(new Date()) } = {}) {
  const names = new Map();
  servers.filter(a => serverVerified(a, today)).forEach(a => names.set(nameKey(a.applicantName), a.applicantName));
  const from = addDays(today, -ROSTER_BACK_DAYS), to = addDays(today, ROSTER_AHEAD_DAYS);
  signups.filter(s => s.volunteerName && s.massDate >= from && s.massDate <= to).forEach(s => names.set(nameKey(s.volunteerName), s.volunteerName));
  bookings.filter(b => readMinistry(b)?.method === 'vouched' && b.requesterName).forEach(b => names.set(nameKey(b.requesterName), b.requesterName));
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

/** How the verification reads in lists: label + badge class. */
export function verificationLabel(info) {
  if (!info) return null;
  if (info.waiting) return { text: 'Waiting for Head Admin', cls: 'badge-amber' };
  if (info.method === 'server') return { text: 'Parish Server', cls: 'badge-green' };
  if (info.method === 'roster') return { text: 'Ministry Roster', cls: 'badge-green' };
  if (info.method === 'on-file') return { text: 'On file', cls: 'badge-green' };
  return { text: 'Vouched by Head Admin', cls: 'badge-green' };
}
