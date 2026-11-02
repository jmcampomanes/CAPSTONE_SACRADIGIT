/* ============================================
   SacraDigit — Public and private baptism
   Parishioners choose Private Baptism (the normal
   slot picker) or Public Baptism (one of the dates
   the parish announces). The office books either
   kind for walk-ins, and announces the dates on
   Schedule Offers.

   A public date is saved as an Announcement, like
   the marriage banns, so it needs no backend change
   and also shows in parishioners' Announcements:
     audience  PUBLIC_BAPTISM_AUDIENCE
     title     'Public Baptism: <date>'
     body      the notice, as plain text
     media     { kind: 'public-baptism', items: [],
                 startDate (today), endDate (the
                 baptism — it archives itself after),
                 baptism: { date, time, location,
                 capacity, closesOn, note, cancelled,
                 cancelReason } }

   Seats are counted from the takenSlots rows every
   page already has (no names): every active Baptism
   booking on that date and time. Private bookings
   can't take those seats, because holdRows() marks
   announced dates as full in the private slot picker.

   Saved on the request's `details`:
     BAPTISM_TYPE_KEY  'Public' | 'Private' (shown as is)
     PUBLIC_DATE_KEY   the announced date's id (hidden)
   Older Baptism requests have neither.

   Pure helpers + functions that take the Amplify
   client, so the public homepage can pass its
   API-key client.
   ============================================ */

import { parishRules, peso } from './parish-rules.js';
import { holdsSlot } from './request-status.js';

export const PUBLIC_BAPTISM_AUDIENCE = 'Public Baptism';
export const BAPTISM_TYPE_KEY = 'Baptism Type';
export const PUBLIC_DATE_KEY = 'Public Baptism Date Id';
export const BAPTISM_TYPE_LABELS = { public: 'Public', private: 'Private' };
export const NOT_SPECIFIED = 'Not specified';

/** Registration closes this many days before, matching the Baptism leadDays. */
export const DEFAULT_CLOSE_DAYS = 14;
export const DEFAULT_CAPACITY = 10;

const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => new Date(`${iso}T00:00:00`);
export const fmtLong = (iso) => (iso ? parse(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '');
export const fmtShort = (iso) => (iso ? parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const closingDateFor = (iso) => { const d = parse(iso); d.setDate(d.getDate() - DEFAULT_CLOSE_DAYS); return isoOf(d); };

function minutes(time12) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(time12 || '').trim());
  if (!m) return -1;
  return (parseInt(m[1], 10) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + parseInt(m[2], 10);
}

const errorsOf = (res) => (res.errors?.length ? new Error(res.errors.map(e => e.message).join('; ')) : null);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const isPublicBaptism = (a) => a?.audience === PUBLIC_BAPTISM_AUDIENCE;

/** The date stored in an Announcement, or null. */
export function readDate(a) {
  if (!isPublicBaptism(a)) return null;
  try {
    const b = JSON.parse(a.media || '{}').baptism;
    return b?.date ? { ...b, capacity: Number(b.capacity) || 0, id: a.id, published: a.published !== false, createdAt: a.createdAt } : null;
  } catch { return null; }
}

const byDate = (x, y) => x.date.localeCompare(y.date);

/** Every public date, soonest first. */
export async function listDates(client) {
  const res = await client.models.Announcement.list({ filter: { audience: { eq: PUBLIC_BAPTISM_AUDIENCE } }, limit: 1000 });
  const err = errorsOf(res); if (err) throw err;
  return (res.data || []).map(readDate).filter(Boolean).sort(byDate);
}

/** Live version of listDates(); returns a function to stop. */
export function watchDates(client, onChange) {
  const sub = client.models.Announcement.observeQuery({ filter: { audience: { eq: PUBLIC_BAPTISM_AUDIENCE } } }).subscribe({
    next: ({ items }) => onChange(items.map(readDate).filter(Boolean).sort(byDate)),
    error: (err) => console.error('Failed to load public baptism dates:', err),
  });
  return () => sub.unsubscribe();
}

function noticeBody(d) {
  return [
    `Public Baptism on ${fmtLong(d.date)} at ${d.time}, ${d.location}.`,
    `Register by ${fmtLong(d.closesOn)} under Request a Service, Baptism, or at the parish office.`,
    d.note || '',
  ].filter(Boolean).join('\n\n');
}

/** Publishes a new date, or saves changes when `id` is given. */
export async function saveDate(client, form, id = null) {
  const baptism = {
    date: form.date, time: form.time, location: form.location, capacity: Number(form.capacity),
    closesOn: form.closesOn, note: form.note || '',
  };
  const data = {
    title: `Public Baptism: ${fmtLong(form.date)}`,
    body: noticeBody(baptism),
    audience: PUBLIC_BAPTISM_AUDIENCE,
    published: true,
    media: JSON.stringify({ kind: 'public-baptism', items: [], startDate: isoOf(new Date()), endDate: form.date, baptism }),
  };
  const res = id ? await client.models.Announcement.update({ id, ...data }) : await client.models.Announcement.create(data);
  const err = errorsOf(res); if (err) throw err;
  return readDate(res.data);
}

/** Takes a date down and keeps the reason (kept, unpublished: the Secretary can't delete Announcements). */
export async function cancelDate(client, d, reason) {
  const { id, published, createdAt, ...baptism } = d;
  const res = await client.models.Announcement.update({
    id, published: false,
    media: JSON.stringify({ kind: 'public-baptism', items: [], startDate: isoOf(new Date()), endDate: d.date, baptism: { ...baptism, cancelled: true, cancelReason: reason } }),
  });
  const err = errorsOf(res); if (err) throw err;
}

/** Announced dates that haven't happened and aren't cancelled. */
export const upcomingDates = (dates, today = isoOf(new Date())) => dates.filter(d => d.published && !d.cancelled && d.date >= today);

const sameSlot = (row, d) => row.type === 'Baptism'
  && (row.date || row.preferredDate) === d.date
  && minutes(row.time) === minutes(d.time);

/** Seats taken on a date, from takenSlots rows or full Blessing records. */
export const seatsTaken = (rows, d, excludeId = null) => (rows || [])
  .filter(r => sameSlot(r, d) && holdsSlot(r) && !(excludeId && r.id === excludeId)).length;

/** Seats left, or null when the bookings couldn't be loaded. */
export const seatsLeft = (rows, d, excludeId = null) => (rows ? Math.max(0, d.capacity - seatsTaken(rows, d, excludeId)) : null);

/** 'open' | 'closed' | 'full' */
export function dateState(d, rows, { today = isoOf(new Date()), ignoreClosing = false } = {}) {
  if (!ignoreClosing && d.closesOn && today > d.closesOn) return 'closed';
  return seatsLeft(rows, d) === 0 ? 'full' : 'open';
}

/** Fake bookings that fill announced dates in the private slot picker. */
export const holdRows = (dates) => upcomingDates(dates).flatMap(d => Array.from(
  { length: Math.max(d.capacity, 200) },
  () => ({ type: 'Baptism', date: d.date, preferredDate: d.date, time: d.time, status: 'scheduled' }),
));

/** Details keys that only the system reads. */
export const isHiddenBaptismKey = (key) => key === PUBLIC_DATE_KEY;

function parseDetails(record) {
  const raw = record?.details;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

/** 'public' | 'private' | '' (an older request). */
export function baptismTypeOf(record) {
  const v = parseDetails(record)[BAPTISM_TYPE_KEY];
  return v === 'Public' ? 'public' : v === 'Private' ? 'private' : '';
}

/** "Public Baptism", "Private Baptism", or the stored type for everything else. */
export function serviceLabel(record) {
  if (record?.type !== 'Baptism') return record?.type || '';
  const t = baptismTypeOf(record);
  return t ? `${BAPTISM_TYPE_LABELS[t]} Baptism` : 'Baptism';
}

/** The request's details JSON with its type (and public date) set. */
export function detailsWithBaptismType(record, type, dateId = '') {
  const details = { ...parseDetails(record), [BAPTISM_TYPE_KEY]: BAPTISM_TYPE_LABELS[type] };
  if (dateId) details[PUBLIC_DATE_KEY] = dateId;
  else delete details[PUBLIC_DATE_KEY];
  return JSON.stringify(details);
}

/* ---------- Shared parts of the two request forms ---------- */

/** The required Private / Public choice. `prefix` keeps ids unique on the page. */
export function typeChooserHtml(prefix) {
  const f = parishRules().fees;
  const option = (value, title, fee, text) => `
    <label class="bt-type">
      <input type="radio" name="${prefix}-baptism-type" value="${value}" />
      <span class="bt-type-body">
        <span class="bt-type-head"><strong>${title}</strong><span class="bt-type-fee">${esc(peso(fee))}</span></span>
        <span class="bt-type-text">${text}</span>
      </span>
    </label>`;
  return `
    <fieldset class="bt-chooser sm:col-span-2" id="${prefix}-baptism-chooser">
      <legend class="form-label">Type of Baptism <span class="text-red-500">*</span></legend>
      ${option('private', 'Private Baptism', f.baptismPrivate, 'Your own ceremony, on a schedule you choose.')}
      ${option('public', 'Public Baptism', f.baptismPublic, 'With other families, on a date the parish announces.')}
    </fieldset>`;
}

/**
 * The announced dates as radio cards. Full or closed dates show but can't be
 * picked. rows: bookings, or null to hide the seat count. `officeNote` is
 * shown when no date is open.
 */
export function dateListHtml(prefix, dates, rows, { selectedId = '', ignoreClosing = false, officeNote = '' } = {}) {
  const list = upcomingDates(dates);
  if (!list.length) return `<p class="bt-empty">No public baptism dates are open right now. ${esc(officeNote)}</p>`;
  return `
    <div class="bt-dates" role="radiogroup" aria-label="Public baptism dates">
      ${list.map(d => {
        const state = dateState(d, rows, { ignoreClosing });
        const left = seatsLeft(rows, d);
        const tag = state === 'full' ? 'Full' : state === 'closed' ? 'Registration closed' : left === null ? '' : `${left} seat${left === 1 ? '' : 's'} left`;
        return `
        <label class="bt-date${state === 'open' ? '' : ' is-off'}">
          <input type="radio" name="${prefix}-public-date" value="${esc(d.id)}" ${state === 'open' ? '' : 'disabled'} ${d.id === selectedId && state === 'open' ? 'checked' : ''} />
          <span class="bt-date-body">
            <strong>${esc(fmtLong(d.date))}</strong>
            <span>${esc(d.time)}, ${esc(d.location)}</span>
            <span class="bt-date-close">Register by ${esc(fmtShort(d.closesOn))}</span>
            ${d.note ? `<span>${esc(d.note)}</span>` : ''}
          </span>
          ${tag ? `<span class="bt-date-tag">${esc(tag)}</span>` : ''}
        </label>`;
      }).join('')}
    </div>
    ${list.some(d => dateState(d, rows, { ignoreClosing }) === 'open') ? '' : `<p class="bt-empty">No public baptism dates are open right now. ${esc(officeNote)}</p>`}`;
}
