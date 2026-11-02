/* ============================================
   SacraDigit — Request status rules
   The flow for service requests once payments are on
   (paymentsReady() in payments.js):

     pending             waiting for the office
     temporary-approval  approved, slot held, amount set,
                         payment deadline running
     payment-submitted   the person sent a transaction
                         number; staff check it
     scheduled           paid and confirmed (shown as
                         Confirmed; older code and
                         records already use this word)
     declined, cancelled, void   ended

   If a temporary approval's deadline passes unpaid, the
   request counts as void straight away on every page and
   its slot is free. The site is static, so nothing runs
   at the deadline: a scheduled backend function stores
   the 'void' status (BACKEND_CHANGES.md), and until then
   staff press Mark Void.

   The approval's amount and deadline sit in `details`
   under TEMP_KEY. `details` is parishioner-editable, so
   payment truth stays in PaymentRecord (payments.js).

   No imports of the data client, so the public homepage
   can use this file too.
   ============================================ */

import { parishRules, kmBetween } from './parish-rules.js';

export const TEMP_KEY = 'Temporary Approval';
export const OFFERED_KEY = 'Offered Amount';
export const DISTANCE_KEY = 'Distance from Parish';
export const DISTANCE_FEE_KEY = 'Distance Fee';
export const DISTANCE_CHECK_KEY = 'Office to Confirm Distance';

export const STATUS_LABELS = {
  pending: 'Waiting for approval',
  'temporary-approval': 'Temporarily approved',
  'payment-submitted': 'Payment being checked',
  scheduled: 'Confirmed',
  completed: 'Completed',
  declined: 'Cancelled',
  cancelled: 'Cancelled',
  void: 'Void',
};

const IN_PROGRESS = new Set(['pending', 'temporary-approval', 'payment-submitted']);
export const isInProgress = (r) => IN_PROGRESS.has(r?.status);

const todayIso = () => new Date().toLocaleDateString('en-CA');

function parseDetails(record) {
  const raw = record?.details;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

/** { amount, note, deadline, by, at } or null. */
export const tempApprovalOf = (record) => parseDetails(record)[TEMP_KEY] || null;

/** True when the payment deadline passed with nothing submitted. */
export function isExpired(record, today = todayIso()) {
  if (record?.status !== 'temporary-approval') return false;
  const t = tempApprovalOf(record);
  return !!t?.deadline && t.deadline < today;
}

/** The status to show and to act on. */
export const liveStatus = (record) => (isExpired(record) ? 'void' : record?.status);

/** Whether this booking still takes up its slot. takenSlots rows carry no details, so
    an expired hold from those rows only frees up once the backend stores 'void'. */
export const holdsSlot = (record) => (record?.status === 'scheduled' || isInProgress(record)) && !isExpired(record);

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};

/** Never later than the day before the event. */
export function paymentDeadline(record, rules = parishRules(), today = todayIso()) {
  const due = addDays(today, rules.paymentDeadlineDays);
  const date = record?.date || record?.preferredDate;
  if (!date) return due;
  const lastDay = addDays(date, -1);
  return lastDay < due ? lastDay : due;
}

/** The request's details JSON with the approval recorded. */
export function detailsWithTempApproval(record, { amount, note, by }) {
  return JSON.stringify({
    ...parseDetails(record),
    [TEMP_KEY]: { amount: Number(amount), note: note || '', deadline: paymentDeadline(record), by, at: new Date().toISOString() },
  });
}

/** True while the person may cancel in the app. */
export function canCancelOnline(record, rules = parishRules(), today = todayIso()) {
  const date = record?.date || record?.preferredDate;
  return !date || addDays(today, rules.freeCancelDays) <= date;
}

export function cancellationTerms(rules = parishRules()) {
  const days = rules.freeCancelDays;
  return [
    `You can cancel in the app until ${days} day${days === 1 ? '' : 's'} before the date. After that, please call or visit the parish office.`,
    'A request not paid by its deadline becomes void, and its slot is given up.',
    rules.refundTerms,
  ].filter(Boolean).join(' ');
}

/** "14.6161576, 121.0078355" → { lat, lng } or null. */
function parsePin(pin) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(pin || '');
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

/**
 * What a pinned location adds to the bill.
 * { km, surcharge, outOfRange } or null when there's no pin or no bands are set.
 */
export function distanceCharge(pin, rules = parishRules()) {
  const at = typeof pin === 'string' ? parsePin(pin) : pin;
  if (!at || !rules.distanceBands.length) return null;
  const km = Math.round(kmBetween(rules.pin, at) * 10) / 10;
  const band = [...rules.distanceBands].sort((a, b) => a.upToKm - b.upToKm).find(b => km <= b.upToKm);
  return band ? { km, surcharge: band.surcharge, outOfRange: false } : { km, surcharge: 0, outOfRange: true };
}

/** The amount to suggest when the office approves, from what the request recorded. */
export function suggestedAmount(record, baseFee) {
  const d = parseDetails(record);
  const offered = Number(d[OFFERED_KEY]) || 0;
  return Math.max(baseFee, offered) + (Number(d[DISTANCE_FEE_KEY]) || 0);
}
