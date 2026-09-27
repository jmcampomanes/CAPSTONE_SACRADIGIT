/* ============================================
   SacraDigit — parish-wide data a parishioner
   may see, without anyone's personal details.

   Once the backend locks each parishioner's
   records to their owner, a parishioner can no
   longer list everyone's bookings, donations, or
   intentions. The pages that need parish-wide
   information get it here instead, from backend
   queries that return only what's safe to show:

     takenSlots(kind)      which service / facility
                           slots are booked (no names)
     faithfulGivers()      names + months in a row for
                           the Faithful Givers list
                           (no amounts, no anonymous
                           gifts, opt-outs removed)
     communityIntentions() names being prayed for at
                           each Mass (no donor, no
                           offering amount)

   Each helper falls back to reading the table
   directly when its query isn't deployed yet, so
   the pages keep working in the meantime.
   ============================================ */

import { client } from './amplify-init.js';
import { faithfulGivers as computeGivers, isoDate } from './badges.js';
import { optedOutKeys } from './mass-checkin.js';

const hasQuery = (name) => !!(client.queries && client.queries[name]);
const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const errorsOf = (res) => (res.errors && res.errors.length ? new Error(res.errors.map(e => e.message).join('; ')) : null);

function window400() {
  const from = new Date(); from.setDate(from.getDate() - 7);
  const to = new Date(); to.setDate(to.getDate() + 400);
  return { from: isoDate(from), to: isoDate(to) };
}

/* ---------- booked slots ---------- */

/**
 * kind 'blessing' → [{ type, date, preferredDate, time, status }] (every Blessing-model service)
 * kind 'facility' → [{ facilityName, date, startTime, endTime, status }]
 * Shaped like the records the slot pickers already understand.
 */
export async function fetchTakenSlots(kind) {
  if (hasQuery('takenSlots')) {
    const res = await client.queries.takenSlots({ kind, ...window400() });
    const err = errorsOf(res); if (err) throw err;
    return (res.data || []).map(r => kind === 'facility'
      ? { facilityName: r.name, date: r.date, startTime: r.time, endTime: r.endTime, status: r.status }
      : { type: r.name, date: r.date, preferredDate: r.date, time: r.time, status: r.status });
  }
  const model = kind === 'facility' ? client.models.FacilityBooking : client.models.Blessing;
  const { data } = await model.list({ limit: 1000 });
  return data || [];
}

/** Keeps a picker's "taken" data fresh: calls onChange(rows) now and every minute. */
export function watchTakenSlots(kind, onChange, { pollMs = 60000 } = {}) {
  let stopped = false;
  const tick = () => fetchTakenSlots(kind)
    .then(rows => { if (!stopped) onChange(rows); })
    .catch(err => console.error(`Failed to load booked ${kind} slots:`, err));
  tick();
  const timer = setInterval(tick, pollMs);
  return { refresh: tick, stop() { stopped = true; clearInterval(timer); } };
}

/* ---------- Faithful Givers ---------- */

/** [{ name, key, streak }] — longest streak first. */
export async function loadFaithfulGivers() {
  if (hasQuery('faithfulGivers')) {
    const res = await client.queries.faithfulGivers();
    const err = errorsOf(res); if (err) throw err;
    return parseJson(res.data) || [];
  }
  const [{ data }, optedOut] = await Promise.all([
    client.models.Donation.list({ limit: 1000 }),
    optedOutKeys().catch(() => new Set()),
  ]);
  return computeGivers(data || [], { optedOut });
}

/* ---------- fund totals ---------- */

/** { [purpose]: total amount } for the fund and goal progress bars (no names). */
export async function loadDonationTotals() {
  if (hasQuery('donationTotals')) {
    const res = await client.queries.donationTotals();
    const err = errorsOf(res); if (err) throw err;
    const rows = parseJson(res.data) || [];
    return Object.fromEntries(rows.map(r => [r.purpose, r.total || 0]));
  }
  const { data } = await client.models.Donation.list({ limit: 1000 });
  const totals = {};
  (data || []).forEach(d => { totals[d.purpose] = (totals[d.purpose] || 0) + (d.amount || 0); });
  return totals;
}

/* ---------- community Mass intentions ---------- */

/** [{ massDate, massTime, type, names, startTime, endTime }] */
export async function loadCommunityIntentions() {
  if (hasQuery('communityIntentions')) {
    const res = await client.queries.communityIntentions(window400());
    const err = errorsOf(res); if (err) throw err;
    return (parseJson(res.data) || []).map(r => ({ ...r, names: typeof r.names === 'string' ? r.names : JSON.stringify(r.names || []) }));
  }
  const { data } = await client.models.MassIntention.list({ limit: 1000 });
  return data || [];
}
