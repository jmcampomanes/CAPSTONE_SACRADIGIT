/* ============================================
   SacraDigit — Marriage banns
   Before a wedding, the Church publishes the
   couple's intention to marry on three Sundays,
   so anyone who knows of an impediment can tell
   the parish priest. The Secretary publishes them
   from a Wedding booking on Schedule Offers; they
   then appear
     - on the public homepage (home.html),
     - in the parishioner portal's Announcements,
     - on a printout for the priest to read at Mass,
       for the bulletin board, and as a request
       letter for the other party's parish.

   Saved as an Announcement (no backend change):
     audience  BANNS_AUDIENCE ('Marriage Banns')
     title     'Marriage Banns: Groom & Bride'
     body      the notice, as plain text
     media     { kind: 'banns', items: [], startDate,
                 endDate (third Sunday — the notice
                 archives itself after it), banns: {
                 bookingId, groomName, brideName,
                 groomParish, brideParish, sundays } }
   Only names and parishes are published — never the
   wedding date, addresses or contact details.

   Pure helpers + functions that take the Amplify
   client, so the public homepage can pass its
   API-key client.
   ============================================ */

import { formatFullName } from './name-utils.js';

export const BANNS_AUDIENCE = 'Marriage Banns';
export const THIS_PARISH = 'Our Lady of Fatima Parish, Cubao';

/** The last of the three Sundays should fall at least this many days before the wedding. */
export const DAYS_BEFORE_WEDDING = 14;

const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => new Date(`${iso}T00:00:00`);
const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d); };

export const fmtLong = (iso) => (iso ? parse(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '');
export const fmtShort = (iso) => (iso ? parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const fmtMonthDay = (iso) => (iso ? parse(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '');

/** First Sunday on or after an ISO date. */
function sundayOnOrAfter(iso) {
  const d = parse(iso);
  return addDays(iso, (7 - d.getDay()) % 7);
}

/** Three consecutive Sundays starting from `firstSunday`. */
export const threeSundays = (firstSunday) => [firstSunday, addDays(firstSunday, 7), addDays(firstSunday, 14)];

/**
 * The first Sundays the Secretary can choose: from the coming Sunday (after
 * today) up to the latest start whose third Sunday is still at least
 * DAYS_BEFORE_WEDDING days before the wedding. Empty when the wedding is too
 * close for three Sundays.
 */
export function firstSundayChoices(weddingDate, today = isoOf(new Date()), daysBefore = DAYS_BEFORE_WEDDING) {
  if (!weddingDate) return [];
  const latestThird = addDays(weddingDate, -Math.max(1, daysBefore));
  const out = [];
  for (let s = sundayOnOrAfter(addDays(today, 1)); addDays(s, 14) <= latestThird; s = addDays(s, 7)) out.push(s);
  return out;
}

/**
 * Suggested first Sunday: the latest choice, so the three Sundays fall in
 * the weeks just before the wedding. Falls back to the coming Sunday when
 * the wedding is too close for three Sundays.
 */
export function suggestedFirstSunday(weddingDate, today = isoOf(new Date())) {
  const choices = firstSundayChoices(weddingDate, today);
  return choices.length ? choices[choices.length - 1] : sundayOnOrAfter(addDays(today, 1));
}

/** Which time of asking it is on `today`: 1, 2 or 3 (0 = not yet, 4 = finished). */
export function timeOfAsking(sundays, today = isoOf(new Date())) {
  if (!sundays?.length) return 0;
  if (today > sundays[2]) return 4;
  if (today > sundays[1]) return 3;
  if (today > sundays[0]) return 2;
  return 1;
}
export const ORDINAL = ['', 'first', 'second', 'third'];

/* ---------- from a Wedding booking ---------- */

function parseJson(v) {
  let x = v;
  for (let i = 0; i < 2 && typeof x === 'string'; i++) { try { x = JSON.parse(x); } catch { return {}; } }
  return x && typeof x === 'object' ? x : {};
}
const nameOf = (v) => (typeof v === 'string' ? v : formatFullName(v)).trim();

/** Names, parishes and date from a Wedding booking (Blessing record). */
export function coupleFromBooking(booking) {
  const d = parseJson(booking?.details);
  return {
    bookingId: booking?.id || '',
    groomName: nameOf(d["Groom's Full Name"]),
    brideName: nameOf(d["Bride's Full Name"]),
    groomParish: String(d["Groom's Parish"] || '').trim(),
    brideParish: String(d["Bride's Parish"] || '').trim(),
    weddingDate: booking?.date || booking?.preferredDate || '',
  };
}

/* ---------- the published notice ---------- */

const ofParish = (p) => `of ${p || THIS_PARISH}`;

/** The notice as plain text (Announcement body, homepage, portal). */
export function bannsBody(b) {
  return [
    `There is a promise of marriage between ${b.groomName}, ${ofParish(b.groomParish)}, and ${b.brideName}, ${ofParish(b.brideParish)}.`,
    `These banns are published on three Sundays: ${b.sundays.map(fmtMonthDay).join(', ').replace(/, ([^,]*)$/, ' and $1')}, ${parse(b.sundays[2]).getFullYear()}.`,
    'Anyone who knows of any impediment to this marriage is bound in conscience to make it known to the parish priest.',
  ].join('\n\n');
}

/** What the priest reads at Mass on a given Sunday (1–3). */
export function bannsReading(b, asking) {
  return `I publish the banns of marriage between ${b.groomName}, ${ofParish(b.groomParish)}, and ${b.brideName}, ${ofParish(b.brideParish)}. This is the ${ORDINAL[asking]} time of asking. If any of you know of any reason why these persons may not be joined together in Holy Matrimony, you are bound in conscience to make it known to the parish priest.`;
}

export const bannsTitle = (b) => `Marriage Banns: ${b.groomName} & ${b.brideName}`;

export const isBanns = (a) => a?.audience === BANNS_AUDIENCE;

/** { ...banns fields, sundays, startDate, endDate } from a banns Announcement (null if unreadable). */
export function readBanns(a) {
  if (!isBanns(a)) return null;
  const m = parseJson(a.media);
  const b = m.banns || {};
  const sundays = Array.isArray(b.sundays) && b.sundays.length === 3 ? b.sundays : null;
  return {
    id: a.id,
    published: a.published !== false,
    title: a.title || '',
    body: a.body || '',
    startDate: m.startDate || '',
    endDate: m.endDate || (sundays ? sundays[2] : ''),
    bookingId: b.bookingId || '',
    groomName: b.groomName || '',
    brideName: b.brideName || '',
    groomParish: b.groomParish || '',
    brideParish: b.brideParish || '',
    sundays,
    createdAt: a.createdAt,
  };
}

/** Banns showing today: published, started, and not past the third Sunday. */
export function isCurrent(b, today = isoOf(new Date())) {
  return !!b && b.published && (!b.startDate || b.startDate <= today) && (!b.endDate || b.endDate >= today);
}

/* ---------- reading and writing (pass in an Amplify client) ---------- */

const errorsOf = (res) => (res.errors?.length ? new Error(res.errors.map(e => e.message).join('; ')) : null);

/** Every banns notice (newest first). */
export async function listBanns(client) {
  const res = await client.models.Announcement.list({ filter: { audience: { eq: BANNS_AUDIENCE } }, limit: 1000 });
  const err = errorsOf(res); if (err) throw err;
  return (res.data || []).map(readBanns).filter(Boolean)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** Live list of every banns notice. */
export function watchBanns(client, onChange) {
  const sub = client.models.Announcement.observeQuery({ filter: { audience: { eq: BANNS_AUDIENCE } } }).subscribe({
    next: ({ items }) => onChange(items.map(readBanns).filter(Boolean)),
    error: (err) => console.error('Failed to load marriage banns:', err),
  });
  return () => sub.unsubscribe();
}

function payload(couple, firstSunday, today) {
  const sundays = threeSundays(firstSunday);
  const b = { ...couple, sundays };
  return {
    title: bannsTitle(b),
    body: bannsBody(b),
    audience: BANNS_AUDIENCE,
    published: true,
    media: JSON.stringify({
      kind: 'banns', items: [], startDate: today, endDate: sundays[2],
      banns: {
        bookingId: couple.bookingId, groomName: couple.groomName, brideName: couple.brideName,
        groomParish: couple.groomParish, brideParish: couple.brideParish, sundays,
      },
    }),
  };
}

/** Publishes (or re-publishes, when `existingId` is given) the banns for a couple. */
export async function publishBanns(client, couple, firstSunday, existingId = null) {
  const data = payload(couple, firstSunday, isoOf(new Date()));
  const res = existingId
    ? await client.models.Announcement.update({ id: existingId, ...data })
    : await client.models.Announcement.create(data);
  const err = errorsOf(res); if (err) throw err;
  return readBanns(res.data);
}

/** Takes the notice down (kept, unpublished — the Secretary can't delete Announcements). */
export async function withdrawBanns(client, id) {
  const res = await client.models.Announcement.update({ id, published: false });
  const err = errorsOf(res); if (err) throw err;
}
