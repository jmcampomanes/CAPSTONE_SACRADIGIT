/* ============================================
   SacraDigit — Parish columbary
   The niche walls, who has reserved or bought each
   niche, payments, and who rests there. Used by
     Sacradigit/columbary.html  (office: map, reservations,
                                 payments, setup)
     user/user-columbary.html   (parishioners: availability
                                 map, request a niche)
     index.html                  (public "N niches available")
   Inurnments are booked like any other service
   ('Inurnment' in service-catalog.js).

   Parish rules (old parish website):
     - Payment in cash or installment
     - Vault can be used when fully paid
     - Perpetual use
     - Maintenance fee ₱100 per month, from first use

   Models (add to the backend, amplify/data/resource.ts):

     ColumbarySection: a.model({
       name: a.string().required(),   // 'Wall A — St. Joseph'
       code: a.string().required(),   // 'A' — starts each niche code (A-3-07)
       rows: a.integer().required(),  // row 1 = top
       columns: a.integer().required(),
       rowPrices: a.json(),           // [price of row 1, row 2, …]
       blocked: a.json(),             // ['3-7', …] row-column not for sale
       taken: a.json(),               // ['1-4', …] reserved or bought (no names)
       sortOrder: a.integer(),
       note: a.string(),
     }).authorization((allow) => [
       allow.publicApiKey().to(['read']),
       allow.authenticated().to(['read']),
       allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
       allow.groups(['staff']).to(['read', 'update']),
       allow.groups(['itech']).to(['read']),
     ]),

     NicheReservation: a.model({
       sectionId: a.id().required(),
       row: a.integer().required(),
       col: a.integer().required(),
       nicheCode: a.string().required(),
       ownerName: a.string().required(),
       ownerKey: a.string(),          // parishionerKey(ownerName)
       contact: a.string(),
       email: a.string(),
       price: a.float(),              // copied from the row price when reserved
       paymentPlan: a.string(),       // 'cash' | 'installment'
       status: a.string(),            // 'requested' | 'reserved' | 'paid' | 'declined' | 'cancelled'
       notes: a.string(),
       declineReason: a.string(),
       occupants: a.json(),           // [{ name, dateOfDeath, inurnedOn }]
       firstUseDate: a.date(),        // first inurnment — maintenance starts
       requestedOnline: a.boolean(),
     }).authorization((allow) => [
       allow.owner().to(['create', 'read']),
       allow.groups(['admin', 'staff']).to(['create', 'read', 'update', 'delete']),
       allow.groups(['itech']).to(['read']),
     ]),

     NichePayment: a.model({
       reservationId: a.id().required(),
       kind: a.string(),              // 'niche' | 'maintenance'
       amount: a.float().required(),
       paidOn: a.date(),
       orNumber: a.string(),          // official receipt number
       method: a.string(),            // 'Cash' | 'GCash' | 'Bank' | 'Check'
       note: a.string(),
       recordedByName: a.string(),
     }).authorization((allow) => [
       allow.groups(['admin', 'staff']).to(['create', 'read', 'update', 'delete']),
       allow.groups(['itech']).to(['read']),
     ]),

   Pure helpers + functions that take the Amplify client
   (the homepage passes its API-key client).
   ============================================ */

export const MAINTENANCE_PER_MONTH = 100;
export const ACTIVE = new Set(['requested', 'reserved', 'paid']);
export const OWNED = new Set(['reserved', 'paid']); // what goes into a section's `taken`

export const STATUS_LABEL = {
  requested: 'Request waiting', reserved: 'Reserved · paying', paid: 'Fully paid',
  declined: 'Declined', cancelled: 'Cancelled',
};

export const columbaryReady = (client) => !!(client.models.ColumbarySection && client.models.NicheReservation && client.models.NichePayment);

const pad2 = (n) => String(n).padStart(2, '0');
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const peso = (n) => {
  const v = Number(n || 0);
  const d = Number.isInteger(v) ? 0 : 2;
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};
export const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export function parseJson(v, fallback) {
  let x = v;
  for (let i = 0; i < 2 && typeof x === 'string'; i++) { try { x = JSON.parse(x); } catch { return fallback; } }
  return x ?? fallback;
}

export const cellKey = (row, col) => `${row}-${col}`;
export const nicheCode = (section, row, col) => `${section.code}-${row}-${pad2(col)}`;

/** A ColumbarySection record with its JSON fields parsed. */
export function readSection(s) {
  const rows = Math.max(1, Number(s.rows) || 1);
  const prices = parseJson(s.rowPrices, []);
  return {
    ...s,
    rows,
    columns: Math.max(1, Number(s.columns) || 1),
    rowPrices: Array.from({ length: rows }, (_, i) => Number(prices[i]) || 0),
    blocked: new Set(parseJson(s.blocked, [])),
    taken: new Set(parseJson(s.taken, [])),
    sortOrder: Number(s.sortOrder) || 0,
  };
}
export const sortSections = (list) => list.slice().sort((a, b) => a.sortOrder - b.sortOrder || String(a.code).localeCompare(String(b.code)));

/** A NicheReservation record with occupants parsed. */
export const readReservation = (r) => ({ ...r, occupants: parseJson(r.occupants, []), price: Number(r.price) || 0 });

/** Niches in a section that are for sale and not reserved or bought (public count). */
export function availableCount(section) {
  let n = 0;
  for (let r = 1; r <= section.rows; r++) for (let c = 1; c <= section.columns; c++) {
    const k = cellKey(r, c);
    if (!section.blocked.has(k) && !section.taken.has(k)) n++;
  }
  return n;
}
export const totalNiches = (section) => section.rows * section.columns - section.blocked.size;

/**
 * The state of each niche for the office map:
 * 'available' | 'blocked' | 'requested' | 'reserved' | 'paid' | 'occupied'.
 * `reservations` are every active reservation in this section.
 */
export function nicheState(section, row, col, reservation) {
  if (section.blocked.has(cellKey(row, col))) return 'blocked';
  if (!reservation) return 'available';
  if (reservation.occupants?.length) return 'occupied';
  return reservation.status; // requested | reserved | paid
}

/** Money on a reservation, from its payments. */
export function accountOf(reservation, payments, today = todayIso()) {
  const mine = payments.filter(p => p.reservationId === reservation.id);
  const paidNiche = mine.filter(p => (p.kind || 'niche') === 'niche').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paidMaint = mine.filter(p => p.kind === 'maintenance').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.max(0, reservation.price - paidNiche);
  const months = maintenanceMonths(reservation.firstUseDate, today);
  const maintDue = months * MAINTENANCE_PER_MONTH;
  return {
    payments: mine.sort((a, b) => String(b.paidOn || '').localeCompare(String(a.paidOn || ''))),
    paidNiche, balance, months, maintDue, paidMaint,
    maintArrears: Math.max(0, maintDue - paidMaint),
  };
}

/** Months of maintenance owed so far: from the month of first use through this month. */
export function maintenanceMonths(firstUseDate, today = todayIso()) {
  if (!firstUseDate || firstUseDate > today) return 0;
  const [fy, fm] = firstUseDate.split('-').map(Number);
  const [ty, tm] = today.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/* ---------- reading and writing (pass in an Amplify client) ---------- */

const errorsOf = (res) => (res.errors?.length ? new Error(res.errors.map(e => e.message).join('; ')) : null);

async function listAll(client, model, options = {}) {
  const items = [];
  let nextToken = null;
  do {
    const res = await client.models[model].list({ limit: 1000, ...options, nextToken });
    const err = errorsOf(res); if (err) throw err;
    items.push(...(res.data || []));
    nextToken = res.nextToken;
  } while (nextToken);
  return items;
}

export async function listSections(client) {
  return sortSections((await listAll(client, 'ColumbarySection')).map(readSection));
}

export function watch(client, model, onChange, options = {}) {
  const sub = client.models[model].observeQuery(options).subscribe({
    next: ({ items }) => onChange(items),
    error: (err) => console.error(`Failed to load ${model}:`, err),
  });
  return () => sub.unsubscribe();
}

async function write(promise) {
  const res = await promise;
  const err = errorsOf(res); if (err) throw err;
  return res.data;
}
export const create = (client, model, data) => write(client.models[model].create(data));
export const update = (client, model, data) => write(client.models[model].update(data));
export const remove = (client, model, id) => write(client.models[model].delete({ id }));

/** Section fields ready to save (JSON fields stringified). */
export function sectionPayload(s) {
  return {
    name: s.name, code: s.code, rows: s.rows, columns: s.columns,
    rowPrices: JSON.stringify(s.rowPrices || []),
    blocked: JSON.stringify([...(s.blocked || [])]),
    taken: JSON.stringify([...(s.taken || [])]),
    sortOrder: s.sortOrder || 0, note: s.note || '',
  };
}

/**
 * Rewrites a section's public `taken` list from its reservations, so the
 * homepage and parishioners see the right availability without seeing names.
 */
export async function syncTaken(client, section, reservations) {
  const taken = reservations
    .filter(r => r.sectionId === section.id && OWNED.has(r.status))
    .map(r => cellKey(r.row, r.col)).sort();
  const before = [...section.taken].sort();
  if (taken.join() === before.join()) return;
  await update(client, 'ColumbarySection', { id: section.id, taken: JSON.stringify(taken) });
}
