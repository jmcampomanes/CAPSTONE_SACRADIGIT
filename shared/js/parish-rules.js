/* ============================================
   SacraDigit — Parish rules and fees
   The one place every page reads the parish's
   address, map pin, fees and time limits from, so
   a number can never disagree between two pages.

   DEFAULT_RULES below is what the parish published.
   The Head Admin edits them on Parish Rules & Fees
   (Sacradigit/parish-rules.html); edits are saved in
   one ParishSettings record and laid on top of these
   defaults. Until that model is deployed
   (BACKEND_CHANGES.md) the defaults are used.

   Fee kinds:
     fixed   a set amount
     minimum at least this amount; the person may give more
     quoted  no online price: the office sets it per request,
             from what the parishioner additionally asks for

   Takes the Amplify client as an argument, so the
   public homepage can pass its API-key client.
   ============================================ */

export const PARISH_NAME = 'Our Lady of Fatima Parish (Diocese of Cubao)';

export const DEFAULT_RULES = {
  address: '37 Cordillera Street, 1100 Quezon City, Philippines',
  pin: { lat: 14.6161576, lng: 121.0078355 },
  fees: {
    massIntentionMin: 50,      // per intention, however many names it has
    blessingMin: 200,
    baptismPublic: 700,        // published as Common Baptism
    baptismPrivate: 3000,      // published as Solo Baptism
    sponsorExtraPublic: 50,    // each additional sponsor
    sponsorExtraPrivate: 100,
    weddingTotal: 18000,
    weddingDown: 5000,
  },
  paymentDeadlineDays: 3,      // after temporary approval
  freeCancelDays: 3,           // before the event
  serverScoutDays: 7,          // admins start filling slots
  serverSignupCloseDays: 3,
  // [{ upToKm, surcharge }], nearest first. Empty until the Head Admin sets them.
  distanceBands: [],
  refundTerms: '',             // the parish's own wording, shown with the cancellation terms
};

/* Labels are what the Parish Rules & Fees page shows. */
export const FEE_LABELS = {
  massIntentionMin: 'Mass intention (minimum per intention)',
  blessingMin: 'Blessings (minimum)',
  baptismPublic: 'Public Baptism (Common)',
  baptismPrivate: 'Private Baptism (Solo)',
  sponsorExtraPublic: 'Public Baptism, each additional sponsor',
  sponsorExtraPrivate: 'Private Baptism, each additional sponsor',
  weddingTotal: 'Wedding (total)',
  weddingDown: 'Wedding (down payment)',
};

const copy = (o) => JSON.parse(JSON.stringify(o));
let current = copy(DEFAULT_RULES);
let recordId = null;
const listeners = new Set();

function merge(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    ...copy(DEFAULT_RULES), ...s,
    pin: { ...DEFAULT_RULES.pin, ...(s.pin || {}) },
    fees: { ...DEFAULT_RULES.fees, ...(s.fees || {}) },
    distanceBands: Array.isArray(s.distanceBands) ? s.distanceBands : [],
  };
}

/** The rules in force right now (the defaults until loadParishRules() finishes). */
export const parishRules = () => current;
export const parishSettingsReady = (client) => !!client.models.ParishSettings;

/** Calls fn whenever saved rules arrive; returns a function to stop. */
export function onParishRules(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reads the saved rules. Never rejects: the defaults stay on any error. */
export async function loadParishRules(client) {
  if (!parishSettingsReady(client)) return current;
  try {
    const res = await client.models.ParishSettings.list({ limit: 1 });
    if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
    const row = res.data?.[0];
    if (row) {
      recordId = row.id;
      current = merge(typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings);
      listeners.forEach(fn => fn(current));
    }
  } catch (err) {
    console.warn('Parish settings unavailable, using the published defaults:', err);
  }
  return current;
}

/** Head Admin: saves the whole rule set. */
export async function saveParishRules(client, next, updatedByName) {
  const merged = merge(next);
  const data = { settings: JSON.stringify(merged), updatedByName };
  const res = recordId
    ? await client.models.ParishSettings.update({ id: recordId, ...data })
    : await client.models.ParishSettings.create(data);
  if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
  recordId = res.data?.id || recordId;
  current = merged;
  listeners.forEach(fn => fn(current));
  return current;
}

export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-US')}`;

/**
 * What a service costs, by its stored `type` (the display name).
 * baptismType: 'public' | 'private' for Baptism.
 * Returns { kind, amount, label }.
 */
export function feeFor(typeName, { baptismType = '', rules = current } = {}) {
  const f = rules.fees;
  if (typeName === 'Baptism' && baptismType) {
    const amount = baptismType === 'public' ? f.baptismPublic : f.baptismPrivate;
    return { kind: 'fixed', amount, label: `${peso(amount)} (the office may add to this for additional requests)` };
  }
  if (typeName === 'Wedding') {
    return { kind: 'fixed', amount: f.weddingTotal, label: `${peso(f.weddingTotal)} total, ${peso(f.weddingDown)} down payment` };
  }
  if (/blessing|dedication/i.test(typeName || '')) {
    return { kind: 'minimum', amount: f.blessingMin, label: `Minimum of ${peso(f.blessingMin)}` };
  }
  return { kind: 'quoted', amount: 0, label: 'To be confirmed by the parish office' };
}

/** Straight-line kilometres between two { lat, lng } points. */
export function kmBetween(a, b) {
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
