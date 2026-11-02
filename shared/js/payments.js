/* ============================================
   SacraDigit — Payments
   One PaymentRecord for every payment a parishioner
   tells us they made. There is no payment gateway,
   so the system can't see money arrive: the person
   enters their transaction number, and staff check
   it against the GCash/Maya history before marking
   it verified.

   Payment truth lives here and not on the request,
   because a parishioner can update their own request
   but only admin and staff can update this model
   (BACKEND_CHANGES.md).

   requestType  'Service' | 'Mass Intention' | 'Donation'
   status       'submitted' | 'verified' | 'rejected'

   Used by the request forms, the Donations and
   Schedule Offers pages, and the Payments report.
   ============================================ */

import { client } from './amplify-init.js';

export const PAYMENT_METHODS = ['GCash', 'Maya', 'Cash', 'Bank Transfer'];
export const PAYMENT_STATUS_LABELS = { submitted: 'Waiting for check', verified: 'Verified', rejected: 'Rejected' };

export const paymentsReady = () => !!client.models.PaymentRecord;

const errorsOf = (res) => (res.errors?.length ? new Error(res.errors.map(e => e.message).join('; ')) : null);

/** Same number however it was typed ("12 34-56" and "123456"). */
export const normalizeReference = (ref) => String(ref || '').replace(/[\s-]/g, '').toUpperCase();

/** A parishioner says they paid. */
export async function submitPayment({ requestType, requestId, payerName, amount, method, referenceNumber, note }) {
  const res = await client.models.PaymentRecord.create({
    requestType, requestId, payerName, amount: Number(amount), method,
    referenceNumber: normalizeReference(referenceNumber), status: 'submitted', note,
  });
  const err = errorsOf(res); if (err) throw err;
  return res.data;
}

/** Staff record a payment made at the office: already verified. */
export async function recordOfficePayment({ requestType, requestId, payerName, amount, method, referenceNumber, verifiedBy, note }) {
  const res = await client.models.PaymentRecord.create({
    requestType, requestId, payerName, amount: Number(amount), method,
    referenceNumber: normalizeReference(referenceNumber), status: 'verified',
    verifiedBy, verifiedAt: new Date().toISOString(), note,
  });
  const err = errorsOf(res); if (err) throw err;
  return res.data;
}

export async function listPayments() {
  const items = [];
  let nextToken;
  do {
    const res = await client.models.PaymentRecord.list({ limit: 1000, nextToken });
    const err = errorsOf(res); if (err) throw err;
    items.push(...res.data);
    nextToken = res.nextToken;
  } while (nextToken);
  return items;
}

/** Staff decision on a submitted payment. */
export async function reviewPayment(id, status, verifiedBy, note) {
  const res = await client.models.PaymentRecord.update({
    id, status, verifiedBy, verifiedAt: new Date().toISOString(), ...(note ? { note } : {}),
  });
  const err = errorsOf(res); if (err) throw err;
  return res.data;
}

/** Reference numbers used on more than one payment: staff should look twice. */
export function duplicateReferences(rows) {
  const seen = new Map();
  rows.filter(r => r.status !== 'rejected' && r.referenceNumber).forEach(r => {
    const key = normalizeReference(r.referenceNumber);
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}

/** The newest payment for a request, or null. */
export const paymentFor = (rows, requestId) => rows.filter(r => r.requestId === requestId)
  .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
