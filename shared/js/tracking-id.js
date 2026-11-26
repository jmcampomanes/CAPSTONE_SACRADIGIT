/* ============================================
   SacraDigit — Tracking numbers
   Every request, booking, intention, donation and payment
   gets a reference number that nobody else shares, so a
   person's record can be found again from one number:

       SRV-1A2B-3C4D-5E6F      a service or blessing request
       CRT-…                   a certificate request
       DON-…                   a donation
       MIN-…                   a Mass intention
       PAY-…                   a payment (what the person paid)
       FAC-…                   a facility booking

   The number is the first 12 hex digits of the record's own
   database id (a random UUID), so it is unique to that record,
   needs no extra field, and can be worked out anywhere the
   record is shown, by the parishioner and by the parish office.
   Pure functions: no page, no network.
   ============================================ */

const PREFIX = {
  service: 'SRV', certificate: 'CRT', donation: 'DON', intention: 'MIN', payment: 'PAY', booking: 'FAC', record: 'REC',
};

/** "SRV-1A2B-3C4D-5E6F" for a record id, or '' when the id is missing or too short. */
export function trackingId(kind, id) {
  const hex = String(id || '').replace(/[^0-9a-f]/gi, '').toUpperCase().slice(0, 12);
  if (hex.length < 12 || !PREFIX[kind]) return '';
  return `${PREFIX[kind]}-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/** What someone typed as a reference number ("srv 1a2b 3c4d"), as letters and digits only, or '' if it isn't one. */
export function trackingQuery(text) {
  const t = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return new RegExp(`^(${Object.values(PREFIX).join('|')})[0-9A-F]{3,12}$`).test(t) ? t : '';
}

/** True when the record's number starts with what was typed (a full or partial reference number). */
export function matchesTracking(query, kind, id) {
  const q = trackingQuery(query);
  const code = trackingId(kind, id).replace(/-/g, '');
  return !!q && !!code && code.startsWith(q);
}
