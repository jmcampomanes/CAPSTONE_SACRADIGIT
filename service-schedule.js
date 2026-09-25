/* ============================================
   SacraDigit — Fixed Service Schedules
   Shared by user/user-request-service.js (parishioner
   slot picker) and the admin Blessings / Schedule
   Offers pages.

   Every requestable service has fixed weekly time
   slots with a capacity. A parishioner picks one open
   slot and the request is saved straight away as
   status 'scheduled' (date + time filled in) — there
   is no pending/approve/decline step anymore. The
   admin can still cancel a booking if the parish
   can't honour it (status 'declined' + declineReason).

   Keys match the `type` stored on Blessing records
   (the service's display name in
   user-request-service.js's catalog).

   days: 0 = Sunday … 6 = Saturday
   capacity: bookings allowed per slot (e.g. group
             baptisms take many families at once)
   leadDays: earliest bookable day, counted from today
   windowDays: how far ahead the picker shows
   location: where it happens; `locationField` means
             "use this detail the requester typed"

   Closures: any SpecialSchedule record with type
   CLOSURE_TYPE ("No Services (Parish Closed)") blocks
   every slot from its startDate to endDate. Admins add
   these on the Special Schedules page.
   ============================================ */

const WEEKDAYS = [1, 2, 3, 4, 5, 6];      // Mon–Sat
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export const SERVICE_SCHEDULES = {
  // Sacraments
  'Baptism':                     { days: [0],       times: ['10:00 AM', '11:00 AM'],                         capacity: 10, leadDays: 7,  windowDays: 60,  location: 'Main Church' },
  'Confirmation':                { days: [6],       times: ['09:00 AM'],                                     capacity: 20, leadDays: 14, windowDays: 90,  location: 'Main Church' },
  'First Communion':             { days: [6],       times: ['09:00 AM'],                                     capacity: 30, leadDays: 14, windowDays: 90,  location: 'Main Church' },
  'Confession / Reconciliation': { days: [6],       times: ['04:00 PM', '04:30 PM', '05:00 PM'],             capacity: 5,  leadDays: 1,  windowDays: 21,  location: 'Main Church' },
  'Anointing of the Sick':       { days: EVERY_DAY, times: ['09:00 AM', '02:00 PM'],                         capacity: 1,  leadDays: 1,  windowDays: 14,  locationField: 'Location (Home / Hospital)' },
  'Wedding':                     { days: WEEKDAYS,  times: ['08:00 AM', '10:00 AM', '01:00 PM', '03:00 PM'], capacity: 1,  leadDays: 60, windowDays: 365, location: 'Main Church' },
  'Holy Orders':                 { days: [6],       times: ['09:00 AM'],                                     capacity: 1,  leadDays: 90, windowDays: 365, location: 'Main Church' },

  // Special Masses
  'Funeral Mass':                { days: WEEKDAYS,  times: ['08:00 AM', '10:00 AM', '02:00 PM'],             capacity: 1,  leadDays: 1,  windowDays: 14,  location: 'Main Church' },
  'Anniversary Mass':            { days: [5, 6],    times: ['10:00 AM', '03:00 PM'],                         capacity: 1,  leadDays: 7,  windowDays: 120, location: 'Main Church' },
  'Baccalaureate Mass':          { days: [1, 2, 3, 4, 5], times: ['09:00 AM', '02:00 PM'],                   capacity: 1,  leadDays: 14, windowDays: 180, location: 'Main Church' },

  // Blessings
  'House Blessing':              { days: WEEKDAYS,  times: ['09:00 AM', '10:30 AM', '02:00 PM', '03:30 PM'], capacity: 1,  leadDays: 2,  windowDays: 45,  locationField: 'Complete Address' },
  'Vehicle / Item Blessing':     { days: EVERY_DAY, times: ['08:00 AM', '05:00 PM'],                         capacity: 5,  leadDays: 1,  windowDays: 30,  location: 'Church Parking Area' },
  'Business Dedication':         { days: WEEKDAYS,  times: ['09:00 AM', '02:00 PM'],                         capacity: 1,  leadDays: 3,  windowDays: 60,  locationField: 'Business Address' },
  'Pet Blessing':                { days: [6],       times: ['03:00 PM'],                                     capacity: 10, leadDays: 1,  windowDays: 45,  location: 'Church Grounds' },
};

// Used for any type that isn't in the table above (e.g. an old record
// type), so the picker still works instead of breaking.
const DEFAULT_SCHEDULE = { days: WEEKDAYS, times: ['09:00 AM', '02:00 PM'], capacity: 1, leadDays: 1, windowDays: 30, location: 'Main Church' };

// Statuses that hold a slot. 'declined' (cancelled) frees it again.
const ACTIVE_STATUSES = new Set(['scheduled', 'pending']);

export const CLOSURE_TYPE = 'No Services (Parish Closed)';

/** Pull the closure ranges out of a list of SpecialSchedule records. */
export function closuresFrom(specialSchedules = []) {
  return specialSchedules
    .filter(s => s.type === CLOSURE_TYPE && s.startDate)
    .map(s => ({ start: s.startDate, end: s.endDate || s.startDate, name: s.name }));
}

/** The closure covering an ISO date, or null. */
export function closureOn(iso, closures = []) {
  return closures.find(c => iso >= c.start && iso <= c.end) || null;
}

/**
 * Live-subscribe to closure ranges. Calls onChange(closures) on every
 * update; quietly does nothing if the SpecialSchedule model isn't deployed.
 */
export function watchClosures(client, onChange) {
  if (!client.models.SpecialSchedule) return;
  client.models.SpecialSchedule.observeQuery().subscribe({
    next: ({ items }) => onChange(closuresFrom(items)),
    error: (err) => console.error('Failed to load parish closures:', err),
  });
}

export function scheduleFor(type) {
  return SERVICE_SCHEDULES[type] || DEFAULT_SCHEDULE;
}

export function toLocalISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Plain-English summary, e.g. "Sundays · 10:00 AM, 11:00 AM". */
export function describeSchedule(type) {
  const s = scheduleFor(type);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let days;
  if (s.days.length === 7) days = 'Daily';
  else if (s.days.join() === WEEKDAYS.join()) days = 'Mon–Sat';
  else if (s.days.join() === '1,2,3,4,5') days = 'Mon–Fri';
  else days = s.days.map(d => names[d]).join(', ');
  return `${days} · ${s.times.join(', ')}`;
}

/** The date a slot record occupies: confirmed `date`, else the pending `preferredDate`. */
function slotDateOf(record) {
  return record.status === 'pending' ? (record.preferredDate || record.date) : (record.date || record.preferredDate);
}

/** Map of "YYYY-MM-DD|hh:MM AM" -> booked count, for one service type. */
export function bookedCounts(records, type, { excludeId } = {}) {
  const counts = new Map();
  records.forEach(r => {
    if (r.type !== type || !ACTIVE_STATUSES.has(r.status) || r.id === excludeId) return;
    const date = slotDateOf(r);
    if (!date || !r.time) return;
    const key = `${date}|${r.time}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

/**
 * Upcoming bookable days for a service, each with its fixed slots and
 * how many places are left. Days where every slot is full are still
 * returned (flagged `full`) so the picker can show them greyed out.
 */
export function availableDays(type, records, { from = new Date(), excludeId, ignoreLead = false, closures = [] } = {}) {
  const s = scheduleFor(type);
  const counts = bookedCounts(records, type, { excludeId });
  const days = [];

  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const nowMinutes = from.getHours() * 60 + from.getMinutes();
  const firstOffset = ignoreLead ? 0 : s.leadDays;

  for (let offset = firstOffset; offset <= s.windowDays; offset++) {
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    if (!s.days.includes(d.getDay())) continue;

    const iso = toLocalISODate(d);
    const closure = closureOn(iso, closures);
    if (closure) {
      days.push({ date: iso, slots: [], full: true, closed: closure.name });
      continue;
    }
    const slots = s.times
      .filter(time => offset > 0 || timeToMinutes(time) > nowMinutes) // same-day: only later slots
      .map(time => {
        const booked = counts.get(`${iso}|${time}`) || 0;
        return { time, booked, remaining: Math.max(0, s.capacity - booked), capacity: s.capacity };
      });
    if (!slots.length) continue;

    days.push({ date: iso, slots, full: slots.every(x => x.remaining === 0) });
  }
  return days;
}

/** True if the given slot still has room (used as a last check right before saving). */
export function slotHasRoom(type, records, date, time, { excludeId, closures = [] } = {}) {
  if (closureOn(date, closures)) return false;
  const s = scheduleFor(type);
  const booked = bookedCounts(records, type, { excludeId }).get(`${date}|${time}`) || 0;
  return booked < s.capacity;
}

/** Where the service takes place, using the requester's own address field when the service goes to them. */
export function locationFor(type, details = {}) {
  const s = scheduleFor(type);
  if (s.locationField && details[s.locationField]) return details[s.locationField];
  return s.location || 'Main Church';
}

/**
 * Audit trail: records an admin booking action (e.g. 'Cancel') in the
 * existing AccessLog model, which shows on Cloud Access → Recent Access
 * Log and the admin's Profile → Activity Log. Never throws — a failed
 * log entry must not undo or block the action itself.
 */
export async function logBookingAction(client, { action, record, reason = '', userName = 'Parish Admin' }) {
  if (!client.models.AccessLog || !record) return;
  const when = [record.date || record.preferredDate, record.time].filter(Boolean).join(' ');
  const fileName = `Booking: ${record.type} — ${record.requesterName}${when ? ` (${when})` : ''}${reason ? ` · ${reason}` : ''}`;
  try {
    await client.models.AccessLog.create({ userName, fileName, action });
  } catch (err) {
    console.warn('Could not write audit log entry:', err);
  }
}

/**
 * Downloads a one-event .ics file for a booked service so the
 * parishioner can add it to Google/Apple/Outlook calendar. Times are
 * written as floating local time (no timezone), which calendar apps
 * read as the viewer's own zone — correct for a local parish.
 */
export function downloadBookingIcs({ title, date, time, location = '', description = '', durationMinutes = 60, uid }) {
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  const d = date.replace(/-/g, '');
  const hhmm = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}${String(mins % 60).padStart(2, '0')}00`;
  const esc = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SacraDigit//Parish Services//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid || `${d}-${hhmm(start)}-${Math.random().toString(36).slice(2)}`}@sacradigit`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${hhmm(start)}`,
    `DTEND:${d}T${hhmm(end)}`,
    `SUMMARY:${esc(title)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`Reminder: ${title} tomorrow`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${String(title).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'booking'}-${date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function timeToMinutes(time12) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12 || '');
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

/**
 * Renders a date-strip + time-slot picker into `container` and calls
 * onChange({ date, time }) whenever the selection changes (null when
 * cleared). Returns { refresh(records), getValue(), clear() } so the
 * page can re-render it on live data updates without losing the
 * current selection unless that slot just filled up.
 */
export function createSlotPicker(container, { type, records = [], closures = [], excludeId, ignoreLead = false, onChange = () => {} }) {
  let current = null;
  let days = [];
  let activeDate = null;
  let latestRecords = records;
  let latestClosures = closures;

  const fmtDay = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return {
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.getDate(),
      mon: d.toLocaleDateString('en-US', { month: 'short' }),
    };
  };

  function render() {
    days = availableDays(type, latestRecords, { excludeId, ignoreLead, closures: latestClosures });

    if (!days.length || days.every(d => d.closed)) {
      container.innerHTML = '<p class="slot-empty">No schedule is open for this service right now. Please contact the parish office.</p>';
      return;
    }

    // Drop the selection if its slot filled up in the meantime
    if (current) {
      const d = days.find(x => x.date === current.date);
      const slot = d && !d.closed && d.slots.find(x => x.time === current.time);
      if (!slot || slot.remaining === 0) { current = null; onChange(null); }
    }

    if (!activeDate || !days.some(d => d.date === activeDate && !d.closed)) {
      activeDate = (current && current.date) || (days.find(d => !d.full) || days.find(d => !d.closed)).date;
    }
    const active = days.find(d => d.date === activeDate);

    container.innerHTML = `
      <p class="slot-hint">${describeSchedule(type)}</p>
      <div class="slot-days" role="listbox" aria-label="Available dates">
        ${days.map(d => {
          const f = fmtDay(d.date);
          const title = d.closed ? ` title="Parish closed: ${d.closed.replace(/"/g, '&quot;')}"` : '';
          return `<button type="button" class="slot-day${d.date === activeDate ? ' active' : ''}${d.full ? ' full' : ''}${d.closed ? ' closed' : ''}" data-date="${d.date}" ${d.full ? 'disabled' : ''} aria-selected="${d.date === activeDate}"${title}>
            <span class="slot-day-dow">${f.dow}</span>
            <span class="slot-day-num">${f.day}</span>
            <span class="slot-day-mon">${d.closed ? 'Closed' : d.full ? 'Full' : f.mon}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="slot-times" role="listbox" aria-label="Available times">
        ${active.slots.map(sl => {
          const selected = current && current.date === active.date && current.time === sl.time;
          const left = sl.capacity > 1 ? `${sl.remaining} of ${sl.capacity} left` : (sl.remaining ? 'Open' : 'Booked');
          return `<button type="button" class="slot-time${selected ? ' selected' : ''}" data-time="${sl.time}" ${sl.remaining === 0 ? 'disabled' : ''} aria-selected="${!!selected}">
            <span class="slot-time-label">${sl.time}</span>
            <span class="slot-time-left">${sl.remaining === 0 ? 'Full' : left}</span>
          </button>`;
        }).join('')}
      </div>
    `;
  }

  container.addEventListener('click', (e) => {
    const dayBtn = e.target.closest('.slot-day');
    if (dayBtn && !dayBtn.disabled) {
      activeDate = dayBtn.dataset.date;
      render();
      return;
    }
    const timeBtn = e.target.closest('.slot-time');
    if (timeBtn && !timeBtn.disabled) {
      current = { date: activeDate, time: timeBtn.dataset.time };
      render();
      onChange(current);
    }
  });

  render();

  return {
    refresh(nextRecords) { latestRecords = nextRecords; render(); },
    setClosures(nextClosures) { latestClosures = nextClosures; render(); },
    getValue() { return current; },
    clear() { current = null; activeDate = null; render(); },
  };
}
