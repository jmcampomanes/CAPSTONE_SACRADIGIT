/* ============================================
   SacraDigit — Ministry sign-ups (shared)
   Lectors, choir, altar servers and ushers see a
   monthly roster of the weekend and special Masses,
   volunteer for a slot, request a swap, or take over
   a slot someone needs swapped.

   Model MinistrySignup (see the backend prompt):
     ministry, massDate, massTime, massTitle,
     volunteerId (the volunteer's account id),
     volunteerName, swapRequested
   Rules (same as bookings): volunteering and
   withdrawing close the day before the Mass; asking
   for a swap or taking one over is allowed up to the
   day of the Mass.

   Used by user/user-ministry.js (sign-ups) and
   Sacradigit/ministry-roster.js (office roster).
   Serving earns the "Faithful Servant" badge (badges.js).
   ============================================ */

import { client } from './amplify-init.js';
import { mergeWeeklySchedule, recurringMassesForDate } from './weekly-mass-schedule.js';

/** Ministries and how many people each Mass needs. */
export const MINISTRIES = [
  { id: 'lector', label: 'Lectors', one: 'Lector', perMass: 2 },
  { id: 'choir', label: 'Choir', one: 'Choir member', perMass: 6 },
  { id: 'altar-server', label: 'Altar Servers', one: 'Altar server', perMass: 3 },
  { id: 'usher', label: 'Ushers', one: 'Usher', perMass: 4 },
];
export const ministryById = (id) => MINISTRIES.find(m => m.id === id);

export const ministryReady = () => !!client.models.MinistrySignup;

const pad = (n) => String(n).padStart(2, '0');
export const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => localIso(new Date());

export function toMinutes(time12) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time12 || '').trim());
  if (!m) return 24 * 60;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + parseInt(m[2], 10);
}

/** Same Mass time no matter how it was typed ("7:00 AM" / "07:00 AM"). */
export const normTime = (t) => { const mins = toMinutes(t); return mins >= 24 * 60 ? (t || '') : `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; };
export const massKey = (date, time) => `${date}|${normTime(time)}`;

/** Volunteering / withdrawing close the day before the Mass. */
export const canChangeSignup = (date) => date > todayIso();
/** A swap can be asked for or taken over up to the day of the Mass. */
export const canSwap = (date) => date >= todayIso();

/**
 * Live list of the month's rostered Masses: every Saturday-evening and
 * Sunday Mass from the weekly schedule, plus special Mass records.
 * onChange([{ key, date, time, title }]) — sorted by date and time.
 */
export function watchRosterMasses(year, month, onChange) {
  let weekly = mergeWeeklySchedule([]);
  let specials = [];
  const emit = () => {
    const masses = new Map();
    const last = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= last; day++) {
      const d = new Date(year, month, day);
      const iso = localIso(d);
      if (d.getDay() === 0 || d.getDay() === 6) {
        for (const m of recurringMassesForDate(weekly, iso)) {
          // Saturday: only the evening (anticipated) Masses
          if (d.getDay() === 6 && toMinutes(m.time) < 15 * 60) continue;
          masses.set(massKey(iso, m.time), { key: massKey(iso, m.time), date: iso, time: m.time, title: m.title || 'Sunday Mass' });
        }
      }
    }
    for (const m of specials) {
      const key = massKey(m.date, m.time);
      masses.set(key, { key, date: m.date, time: m.time, title: m.title || 'Special Mass' });
    }
    onChange([...masses.values()].sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.time) - toMinutes(b.time)));
  };

  const subs = [];
  if (client.models.WeeklyMassSchedule) {
    subs.push(client.models.WeeklyMassSchedule.observeQuery().subscribe({
      next: ({ items }) => { weekly = mergeWeeklySchedule(items); emit(); },
      error: (err) => { console.error('Failed to load weekly schedule:', err); emit(); },
    }));
  }
  const from = localIso(new Date(year, month, 1));
  const to = localIso(new Date(year, month + 1, 0));
  if (client.models.Mass) {
    subs.push(client.models.Mass.observeQuery({ filter: { date: { between: [from, to] } } }).subscribe({
      next: ({ items }) => { specials = items.filter(m => m.isSpecial && m.date && m.time); emit(); },
      error: (err) => { console.error('Failed to load special Masses:', err); emit(); },
    }));
  }
  emit();
  return () => subs.forEach(s => s.unsubscribe());
}

/** Live sign-ups for the month. */
export function watchSignups(year, month, onChange) {
  if (!ministryReady()) return () => {};
  const from = localIso(new Date(year, month, 1));
  const to = localIso(new Date(year, month + 1, 0));
  const sub = client.models.MinistrySignup.observeQuery({ filter: { massDate: { between: [from, to] } } }).subscribe({
    next: ({ items }) => onChange(items),
    error: (err) => console.error('Failed to load ministry sign-ups:', err),
  });
  return () => sub.unsubscribe();
}

/** Sign-ups grouped by Mass, then by ministry: Map(massKey → Map(ministryId → [signup])). */
export function groupSignups(signups) {
  const out = new Map();
  for (const s of signups) {
    const key = massKey(s.massDate, s.massTime);
    if (!out.has(key)) out.set(key, new Map());
    const byMin = out.get(key);
    if (!byMin.has(s.ministry)) byMin.set(s.ministry, []);
    byMin.get(s.ministry).push(s);
  }
  for (const byMin of out.values()) for (const list of byMin.values()) list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return out;
}

function check(result) {
  if (result?.errors) throw new Error(result.errors.map(e => e.message).join('; '));
  return result?.data;
}

export async function volunteer(mass, ministryId, me) {
  if (!canChangeSignup(mass.date)) throw new Error('Sign-ups close the day before the Mass.');
  return check(await client.models.MinistrySignup.create({
    ministry: ministryId, massDate: mass.date, massTime: mass.time, massTitle: mass.title,
    volunteerId: me.id, volunteerName: me.name, swapRequested: false,
  }));
}

export async function withdraw(signup) {
  if (!canChangeSignup(signup.massDate)) throw new Error('It’s too late to withdraw — ask for a swap instead.');
  return check(await client.models.MinistrySignup.delete({ id: signup.id }));
}

export async function setSwapRequested(signup, on) {
  if (!canSwap(signup.massDate)) throw new Error('This Mass has already passed.');
  return check(await client.models.MinistrySignup.update({ id: signup.id, swapRequested: !!on }));
}

/** Take over a slot someone asked to swap: it becomes yours. */
export async function takeOver(signup, me) {
  if (!canSwap(signup.massDate)) throw new Error('This Mass has already passed.');
  if (!signup.swapRequested) throw new Error('That slot isn’t up for a swap any more.');
  return check(await client.models.MinistrySignup.update({
    id: signup.id, volunteerId: me.id, volunteerName: me.name, swapRequested: false,
  }));
}

/** Office: remove someone from the roster. */
export async function removeSignup(signup) {
  return check(await client.models.MinistrySignup.delete({ id: signup.id }));
}

export const fmtMassDay = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (t) => (t || '').replace(/^0(\d)/, '$1');
export const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
