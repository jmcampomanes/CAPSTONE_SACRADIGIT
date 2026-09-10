/* ============================================
   weekly-mass-schedule.js — place at project root, next
   to mass-types.js / ph-locations.js / amplify-init.js.

   Single source of truth for the "Regular Weekly Mass
   Schedule" table shown on both the admin Masses page
   (Sacradigit/masses.js) and the parishioner Mass
   Schedule page (user/user-mass-schedule.js).

   Backed by the WeeklyMassSchedule model (one row per
   day of the week, keyed by `dayOfWeek`), but a day that
   has never been edited/saved yet has no row in the
   database — DEFAULTS below fills in for any day with no
   live record, so both pages render the same familiar
   schedule out of the box, before an admin edits anything.
   Once an admin edits and saves a day (Sacradigit/masses.js),
   that day's row overrides its default forever.
   ============================================ */

import { massTypeInfo } from './mass-types.js';

// Display order used by the weekly table — Monday first,
// Sunday last (not JS's native Sunday-first .getDay() order).
export const DAY_ORDER = [
  { key: 'monday',    label: 'Monday' },
  { key: 'tuesday',   label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday',  label: 'Thursday' },
  { key: 'friday',    label: 'Friday' },
  { key: 'saturday',  label: 'Saturday' },
  { key: 'sunday',    label: 'Sunday' },
];

// Falls back to these until a real WeeklyMassSchedule row
// exists for that day — same values the table always showed
// before it was wired to the database, so nothing changes
// visually until an admin actually edits a day.
export const WEEKLY_SCHEDULE_DEFAULTS = {
  monday:    { times: ['7:00 AM', '6:00 PM'],                        massType: 'daily',       label: null },
  tuesday:   { times: ['7:00 AM', '6:00 PM'],                        massType: 'daily',       label: null },
  wednesday: { times: ['7:00 AM', '6:00 PM'],                        massType: 'daily',       label: null },
  thursday:  { times: ['7:00 AM', '6:00 PM'],                        massType: 'daily',       label: null },
  friday:    { times: ['7:00 AM', '6:00 PM'],                        massType: 'daily',       label: null },
  saturday:  { times: ['7:00 AM', '6:00 PM'],                        massType: 'anticipated', label: null },
  sunday:    { times: ['6:00 AM', '8:00 AM', '10:00 AM', '5:00 PM'], massType: 'daily',       label: 'Sunday Mass' },
};

/**
 * mergeWeeklySchedule(liveRecords)
 * Combines live WeeklyMassSchedule rows (from
 * client.models.WeeklyMassSchedule.observeQuery()) with the
 * defaults above, one entry per day, always in DAY_ORDER.
 * Each entry carries `id` (the live record's id, or null if
 * this day is still showing its default — callers use this
 * to decide create() vs update()) and `displayType` (the
 * resolved label text: the row's own `label` override, or
 * the mass type's friendly label from mass-types.js).
 */
export function mergeWeeklySchedule(liveRecords = []) {
  const byDay = new Map(liveRecords.map(r => [r.dayOfWeek, r]));

  return DAY_ORDER.map(({ key, label: dayLabel }) => {
    const live = byDay.get(key);
    const source = live || WEEKLY_SCHEDULE_DEFAULTS[key];
    const massType = source.massType || 'daily';
    const label = source.label || null;

    return {
      dayKey: key,
      dayLabel,
      id: live ? live.id : null,
      times: Array.isArray(source.times) ? source.times : [],
      massType,
      label,
      displayType: label || massTypeInfo(massType).label,
    };
  });
}

// JS's native Date#getDay() is Sunday-first (0-6) — maps that index to
// our DAY_ORDER keys above.
const JS_WEEKDAY_TO_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function dayKeyForDate(iso) {
  return JS_WEEKDAY_TO_KEY[new Date(iso + 'T00:00:00').getDay()];
}

/** Parses a "h:mm AM/PM" string into minutes-since-midnight, for
    chronological sorting — works whether the hour is zero-padded
    ("07:00 AM") or not ("7:00 AM"). */
export function timeToMinutes(timeStr) {
  const [time, meridiem] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (meridiem === 'PM' && h !== 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * recurringMassesForDate(mergedSchedule, iso)
 * Expands the given date's day-of-week entry from a merged weekly
 * schedule (see mergeWeeklySchedule) into Mass-shaped objects — one
 * per time slot — so "today's schedule" views can show the recurring
 * pattern alongside any individually-scheduled Mass records for that
 * exact date, instead of only the latter. These are virtual (no
 * database row of their own — `id` is a synthetic string, not a real
 * Mass id), read-only entries: editing the pattern happens on the
 * Regular Weekly Mass Schedule table, not here.
 */
export function recurringMassesForDate(mergedSchedule, iso) {
  const dayKey = dayKeyForDate(iso);
  const dayEntry = mergedSchedule.find(w => w.dayKey === dayKey);
  if (!dayEntry) return [];

  return dayEntry.times.map(time => ({
    id: `recurring-${dayKey}-${time}`,
    date: iso,
    time,
    type: dayEntry.massType,
    title: dayEntry.displayType,
    note: 'Part of the regular weekly schedule.',
    isSpecial: false,
    isRecurring: true,
  }));
}