/* ============================================
   SacraDigit — Parishioner notifications
   The 🔔 bell in the parishioner portal's top bar.

   Notifications are worked out from records the
   parishioner can already read — nothing new is
   stored on the server:
   - their certificate requests, service bookings,
     facility bookings and Mass intentions changing
     status (approved, scheduled, ready, declined…)
   - a reminder the day before and on the day of a
     scheduled service
   - new parish announcements, changes to the
     regular Mass schedule, "we're live now"
   - a receipt for each gift they recorded

   Only the last 30 days are shown. What's been
   read is remembered per person, on this device.
   Each kind can be switched off on My Profile →
   Notifications (saved with savePrefs below).

   Device pop-ups (optional, the parishioner allows
   them once): shown while SacraDigit is open in a
   tab or running as the installed app. Alerts to a
   fully closed app would need Web Push (a server
   sending them) — not part of this.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUser } from '../auth.js';
import { currentLang } from '../ui-prefs.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const POLL_MS = 2 * 60 * 1000;
const MAX_ITEMS = 40;

/* ---------- preferences (shared with My Profile → Notifications) ---------- */

export const NOTIF_TYPES = [
  { id: 'certificate-status', label: 'Certificate Request Updates', desc: 'Your certificate request is approved, ready for pick-up, or not approved.' },
  { id: 'service-status', label: 'Service Requests & Reminders', desc: 'Your baptism, blessing or other service is scheduled, cancelled or done — plus a reminder the day before.' },
  { id: 'facility-booking-status', label: 'Facility Booking Updates', desc: 'Your facility booking request is approved or declined.' },
  { id: 'mass-intentions-status', label: 'Mass Intention Status Updates', desc: 'Your submitted Mass intention is scheduled or offered.' },
  { id: 'announcements', label: 'Parish Announcements', desc: 'New announcements from the parish, and when the parish goes live.' },
  { id: 'mass-schedule-changes', label: 'Mass Schedule Changes', desc: 'Changes to the regular weekly Mass schedule.' },
  { id: 'donation-receipts', label: 'Donation Receipts', desc: 'A thank-you receipt for each gift you give.' },
  { id: 'device', label: 'Show on this device', desc: 'Pop-up alerts on this phone or computer while SacraDigit is open or installed as an app.' },
];
const DEFAULT_OFF = new Set(['device']); // pop-ups need the browser's permission first

const key = (name) => `sacradigit_notif_${name}_${currentUser()?.sub || 'guest'}`;
const readJson = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export function loadPrefs() {
  const saved = readJson(key('prefs'), {});
  return Object.fromEntries(NOTIF_TYPES.map(t => [t.id, saved[t.id] ?? !DEFAULT_OFF.has(t.id)]));
}

export function savePrefs(prefs) {
  writeJson(key('prefs'), prefs);
  document.dispatchEvent(new CustomEvent('sacradigit:notif-prefs'));
}

/** Asks the browser for pop-up permission. Resolves true when allowed. */
export async function enableDeviceAlerts() {
  if (!('Notification' in window)) return false;
  const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  return result === 'granted';
}

/* ---------- wording ---------- */

const TXT = {
  en: {
    title: 'Notifications', markAll: 'Mark all as read', empty: 'You’re all caught up. Updates about your requests and the parish will appear here.',
    settings: 'Notification settings', allow: 'Turn on pop-up alerts', allowed: 'Pop-up alerts are on for this device.', blocked: 'Pop-ups are blocked in this browser’s site settings.',
    open: 'Notifications', unread: (n) => `${n} unread`, justNow: 'just now', minAgo: (n) => `${n} min ago`, hrAgo: (n) => `${n} hr ago`, dayAgo: (n) => (n === 1 ? 'yesterday' : `${n} days ago`),
  },
  fil: {
    title: 'Mga Abiso', markAll: 'Markahang nabasa lahat', empty: 'Wala kang bagong abiso. Dito lalabas ang mga update sa iyong mga request at sa parokya.',
    settings: 'Settings ng abiso', allow: 'I-on ang pop-up alerts', allowed: 'Naka-on ang pop-up alerts sa device na ito.', blocked: 'Naka-block ang pop-ups sa site settings ng browser na ito.',
    open: 'Mga Abiso', unread: (n) => `${n} hindi pa nababasa`, justNow: 'ngayon lang', minAgo: (n) => `${n} min ang nakalipas`, hrAgo: (n) => `${n} oras ang nakalipas`, dayAgo: (n) => (n === 1 ? 'kahapon' : `${n} araw ang nakalipas`),
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso, lang) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  .toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-US');
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function timeAgo(iso, lang) {
  const t = TXT[lang];
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minAgo(mins);
  if (mins < 24 * 60) return t.hrAgo(Math.round(mins / 60));
  return t.dayAgo(Math.round(mins / (24 * 60)));
}

/* ---------- data ---------- */

async function listAll(model, options = {}) {
  const items = [];
  let nextToken;
  do {
    const res = await model.list({ ...options, limit: 1000, nextToken });
    if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
    items.push(...res.data);
    nextToken = res.nextToken;
  } while (nextToken);
  return items;
}

// Staff can open the parishioner portal and read everyone's records —
// notifications are only ever about the signed-in person's own.
function mine(records) {
  const sub = currentUser()?.sub;
  return sub ? records.filter(r => (r.owner || '').split('::')[0] === sub) : [];
}

const safe = (p) => p.catch(err => { console.warn('Notifications: could not load one source.', err); return []; });
// A record the parishioner just created isn't news; a later status change is.
const changedLater = (r) => new Date(r.updatedAt) - new Date(r.createdAt) > 60 * 1000;

/** Everything worth telling this parishioner about, newest first. */
export async function collectNotifications(lang = currentLang()) {
  const prefs = loadPrefs();
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();
  const recent = (r) => (r.updatedAt || r.createdAt || '') >= since;
  const fil = lang === 'fil';
  const out = [];
  const add = (n) => out.push(n);

  const [certs, services, bookings, intentions, donations, announcements, weekly, live] = await Promise.all([
    prefs['certificate-status'] ? safe(listAll(client.models.CertificateRequest).then(mine)) : [],
    prefs['service-status'] ? safe(listAll(client.models.Blessing).then(mine)) : [],
    prefs['facility-booking-status'] ? safe(listAll(client.models.FacilityBooking).then(mine)) : [],
    prefs['mass-intentions-status'] ? safe(listAll(client.models.MassIntention).then(mine)) : [],
    prefs['donation-receipts'] ? safe(listAll(client.models.Donation).then(mine)) : [],
    prefs.announcements ? safe(listAll(client.models.Announcement, { filter: { published: { eq: true } } })) : [],
    prefs['mass-schedule-changes'] ? safe(listAll(client.models.WeeklyMassSchedule)) : [],
    prefs.announcements ? safe(listAll(client.models.LivestreamStatus)) : [],
  ]);

  for (const r of certs.filter(recent)) {
    const name = esc(r.certificateType);
    const msg = {
      approved: fil ? [`Aprubado ang iyong ${name}`, 'Inihahanda na ito. Aabisuhan ka kapag handa nang kunin.']
                    : [`Your ${name} request was approved`, 'It’s being prepared — we’ll let you know when it’s ready.'],
      released: fil ? [`Handa na ang iyong ${name}`, 'Maaari mo na itong kunin sa parish office. Magdala ng valid ID.']
                    : [`Your ${name} is ready`, 'Pick it up at the parish office. Please bring a valid ID.'],
      rejected: fil ? [`Hindi naaprubahan ang iyong ${name}`, r.rejectionReason ? esc(r.rejectionReason) : 'Makipag-ugnayan sa parish office para sa detalye.']
                    : [`Your ${name} request wasn’t approved`, r.rejectionReason ? esc(r.rejectionReason) : 'Please contact the parish office for details.'],
    }[r.status];
    if (msg) add({ id: `cert-${r.id}-${r.status}`, kind: 'certificate', at: r.updatedAt, title: msg[0], body: msg[1], href: 'user-my-requests.html' });
  }

  const today = localISO(new Date());
  const tomorrow = localISO(new Date(Date.now() + DAY_MS));
  for (const r of services) {
    const name = esc(r.type);
    const when = r.date ? `${fmtDate(r.date, lang)}${r.time ? `, ${esc(r.time)}` : ''}` : '';
    if (recent(r) && changedLater(r)) {
      const msg = {
        scheduled: fil ? [`Naka-iskedyul na ang ${name}`, when] : [`${name} is scheduled`, when],
        declined: fil ? [`Kinansela ang ${name}`, r.declineReason ? esc(r.declineReason) : 'Makipag-ugnayan sa parish office.'] : [`${name} was cancelled`, r.declineReason ? esc(r.declineReason) : 'Please contact the parish office.'],
        completed: fil ? [`Tapos na ang ${name}`, 'Salamat! Pagpalain ka ng Diyos.'] : [`${name} is complete`, 'Thank you — God bless!'],
      }[r.status];
      if (msg) add({ id: `svc-${r.id}-${r.status}-${r.date || ''}`, kind: 'service', at: r.updatedAt, title: msg[0], body: msg[1], href: 'user-requested-services.html' });
    }
    // Reminders: the day before and on the day.
    if (r.status === 'scheduled' && (r.date === today || r.date === tomorrow)) {
      const isToday = r.date === today;
      add({
        id: `remind-${r.id}-${r.date}-${isToday ? 'day' : 'eve'}`, kind: 'reminder',
        at: new Date(`${isToday ? today : localISO(new Date())}T06:00:00`).toISOString(),
        title: fil ? `Paalala: ${name} ${isToday ? 'ngayong araw' : 'bukas'}` : `Reminder: ${name} ${isToday ? 'today' : 'tomorrow'}`,
        body: `${r.time ? esc(r.time) : ''}${r.time ? ' · ' : ''}${fil ? 'Pumunta nang maaga.' : 'Please arrive a little early.'}`,
        href: 'user-requested-services.html',
      });
    }
  }

  for (const r of bookings.filter(r => recent(r) && changedLater(r))) {
    const name = esc(r.facilityName);
    const when = r.date ? `${fmtDate(r.date, lang)}${r.startTime ? `, ${esc(r.startTime)}` : ''}` : '';
    const msg = {
      approved: fil ? [`Aprubado ang booking mo sa ${name}`, when] : [`Your ${name} booking is approved`, when],
      declined: fil ? [`Hindi naaprubahan ang booking sa ${name}`, when] : [`Your ${name} booking was declined`, when],
    }[r.status];
    if (msg) add({ id: `fac-${r.id}-${r.status}`, kind: 'facility', at: r.updatedAt, title: msg[0], body: msg[1], href: 'user-facility-booking.html' });
  }

  for (const r of intentions.filter(r => recent(r) && changedLater(r))) {
    const when = r.massDate ? `${fmtDate(r.massDate, lang)}${r.massTime ? `, ${esc(r.massTime)}` : ''}` : '';
    const msg = {
      scheduled: fil ? ['Naka-iskedyul na ang iyong Mass intention', when] : ['Your Mass intention is scheduled', when],
      completed: fil ? ['Naialay na ang iyong Mass intention', when] : ['Your Mass intention was offered', when],
    }[r.status];
    if (msg) add({ id: `int-${r.id}-${r.status}`, kind: 'intention', at: r.updatedAt, title: msg[0], body: msg[1], href: 'user-mass-intentions.html' });
  }

  for (const r of donations.filter(recent)) {
    add({
      id: `don-${r.id}`, kind: 'donation', at: r.createdAt,
      title: fil ? `Salamat sa iyong ${peso(r.amount)}!` : `Thank you for your ${peso(r.amount)} gift!`,
      body: r.purpose ? esc(r.purpose) : '', href: 'user-donations.html',
    });
  }

  for (const a of announcements.filter(a => (a.createdAt || '') >= since)) {
    add({ id: `ann-${a.id}`, kind: 'announcement', at: a.createdAt, title: fil ? 'Bagong anunsyo' : 'New announcement', body: esc(a.title), href: 'user-announcements.html' });
  }

  const changedDays = weekly.filter(w => (w.updatedAt || '') >= since);
  if (changedDays.length) {
    const latest = changedDays.map(w => w.updatedAt).sort().pop();
    add({
      id: `sched-${latest}`, kind: 'schedule', at: latest,
      title: fil ? 'Nagbago ang iskedyul ng Misa' : 'The Mass schedule was updated',
      body: fil ? 'Tingnan ang bagong oras ng Misa.' : 'Check the new Mass times.', href: 'user-mass-schedule.html',
    });
  }

  const stream = live.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
  if (stream?.isLive && stream.url) {
    add({
      id: `live-${stream.updatedAt}`, kind: 'live', at: stream.updatedAt,
      title: fil ? '🔴 Live ngayon ang parokya' : '🔴 The parish is live now',
      body: esc(stream.platform || ''), href: stream.url, external: true,
    });
  }

  return out.filter(n => n.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ITEMS);
}

/* ---------- the bell ---------- */

const ICONS = {
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>',
  certificate: '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z"/>',
  service: '<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
  reminder: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  facility: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>',
  intention: '<path d="M9 7h6m-6 4h6m-6 4h4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>',
  donation: '<path d="M4.3 6.3a4.5 4.5 0 000 6.4L12 20.4l7.7-7.7a4.5 4.5 0 00-6.4-6.4L12 7.6l-1.3-1.3a4.5 4.5 0 00-6.4 0z"/>',
  announcement: '<path d="M11 5.9v13.3a1.8 1.8 0 01-3.4.6l-2.2-6.1M18 13a3 3 0 100-6M5.4 13.7A4 4 0 017 6h1.8c4.1 0 7.6-1.2 9.2-3v14c-1.5-1.8-5.1-3-9.2-3H7a4 4 0 01-1.6-.3z"/>',
  schedule: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  live: '<path d="M15 10l4.6-2.3A1 1 0 0121 8.6v6.8a1 1 0 01-1.4.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>',
};
const TONE = { certificate: '#4b50a0', service: '#0f8a7a', reminder: '#b45309', facility: '#6c91c2', intention: '#b5943e', donation: '#15803d', announcement: '#c2410c', schedule: '#1d4ed8', live: '#dc2626' };

const STYLE = `
  .pn-wrap { position: relative; display: inline-flex; }
  .pn-btn {
    position: relative; width: 1.75rem; height: 1.75rem; border-radius: 999px; border: 1.5px solid #c7cad6; background: #ffffff;
    color: #4b5563; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;
  }
  .pn-btn:hover { background: #f3f4f6; border-color: #9ca3af; color: #1e2a4a; }
  .pn-btn svg { width: 1rem; height: 1rem; }
  .pn-count {
    position: absolute; top: -0.45rem; right: -0.5rem; min-width: 1.1rem; height: 1.1rem; padding: 0 0.3rem; border-radius: 999px;
    background: #dc2626; color: #ffffff; font-size: 0.625rem; font-weight: 700; line-height: 1.1rem; text-align: center; border: 2px solid #ffffff;
  }
  .pn-panel {
    position: absolute; top: calc(100% + 0.6rem); right: -3.5rem; z-index: 85; width: 23rem; max-height: min(34rem, calc(100vh - 6rem));
    display: none; flex-direction: column; background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 0.875rem;
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.2); overflow: hidden; text-align: left; font-size: 0.8125rem;
  }
  .pn-open .pn-panel { display: flex; }
  .pn-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.8rem 1rem; border-bottom: 1px solid #f1f2f5; }
  .pn-head strong { font-size: 0.9rem; }
  .pn-mark { font: inherit; font-size: 0.75rem; font-weight: 600; color: #4b50a0; background: none; border: 0; cursor: pointer; padding: 0.2rem; }
  .pn-mark:disabled { color: #9ca3af; cursor: default; }
  .pn-close { display: none; width: 2rem; height: 2rem; border: 0; background: none; font-size: 1.4rem; line-height: 1; color: #6b7280; cursor: pointer; }
  .pn-list { overflow-y: auto; flex: 1; overscroll-behavior: contain; }
  .pn-item { display: flex; gap: 0.75rem; padding: 0.75rem 1rem; text-decoration: none; color: inherit; border-bottom: 1px solid #f5f6f8; position: relative; }
  .pn-item:hover { background: #fafbfc; }
  .pn-item.pn-unread { background: #f5f6fd; }
  .pn-item.pn-unread::after { content: ''; position: absolute; right: 0.9rem; top: 1.05rem; width: 0.5rem; height: 0.5rem; border-radius: 999px; background: #4b50a0; }
  .pn-icon { width: 2rem; height: 2rem; border-radius: 999px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .pn-icon svg { width: 1rem; height: 1rem; }
  .pn-text { min-width: 0; padding-right: 0.9rem; }
  .pn-title { font-weight: 600; color: #111827; line-height: 1.35; }
  .pn-body { color: #6b7280; margin-top: 0.1rem; line-height: 1.35; }
  .pn-time { color: #9ca3af; font-size: 0.7rem; margin-top: 0.25rem; }
  .pn-empty { padding: 2rem 1.25rem; text-align: center; color: #9ca3af; line-height: 1.5; }
  .pn-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.65rem 1rem; border-top: 1px solid #f1f2f5; background: #fafbfc; font-size: 0.75rem; }
  .pn-foot a, .pn-allow { color: #4b50a0; font-weight: 600; text-decoration: none; background: none; border: 0; font: inherit; cursor: pointer; padding: 0; }
  .pn-note { color: #6b7280; }
  @media (max-width: 640px) {
    .pn-panel { position: fixed; inset: 0; width: auto; max-height: none; border-radius: 0; border: 0; padding-bottom: env(safe-area-inset-bottom); }
    .pn-close { display: inline-block; }
    .pn-head { padding-top: calc(0.8rem + env(safe-area-inset-top)); }
  }
  :root[data-theme="dark"] .pn-btn { background: #1a2131; border-color: #3a4459; color: #b6bdca; }
  :root[data-theme="dark"] .pn-btn:hover { background: #242c3e; color: #f1f3f7; }
  :root[data-theme="dark"] .pn-count { border-color: #1a2131; }
  :root[data-theme="dark"] .pn-panel { background: #1a2131; color: #e5e8ef; border-color: #2c3547; }
  :root[data-theme="dark"] .pn-head, :root[data-theme="dark"] .pn-foot, :root[data-theme="dark"] .pn-item { border-color: #2c3547; }
  :root[data-theme="dark"] .pn-foot { background: #161c2a; }
  :root[data-theme="dark"] .pn-item:hover { background: #1f2738; }
  :root[data-theme="dark"] .pn-item.pn-unread { background: #212a45; }
  :root[data-theme="dark"] .pn-title { color: #f1f3f7; }
  :root[data-theme="dark"] .pn-body, :root[data-theme="dark"] .pn-note { color: #9aa3b5; }
  :root[data-theme="dark"] .pn-mark, :root[data-theme="dark"] .pn-foot a, :root[data-theme="dark"] .pn-allow, :root[data-theme="dark"] .pn-item.pn-unread::after { color: #b3b6e6; }
  :root[data-theme="dark"] .pn-item.pn-unread::after { background: #b3b6e6; }
`;

export function initNotifications() {
  if (!currentUser() || document.querySelector('.pn-wrap')) return;
  const lang = currentLang();
  const t = TXT[lang];

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'pn-wrap';
  wrap.setAttribute('data-no-translate', ''); // written in the chosen language already
  wrap.innerHTML = `
    <button type="button" class="pn-btn" aria-haspopup="true" aria-expanded="false" aria-label="${t.open}" title="${t.open}">
      ${ICONS.bell}<span class="pn-count" hidden></span>
    </button>
    <div class="pn-panel" role="dialog" aria-label="${t.title}">
      <div class="pn-head"><strong>${t.title}</strong><span><button type="button" class="pn-mark">${t.markAll}</button><button type="button" class="pn-close" aria-label="Close">×</button></span></div>
      <div class="pn-list" aria-live="polite"></div>
      <div class="pn-foot"><span class="pn-device"></span><a href="user-profile.html#notifications">${t.settings}</a></div>
    </div>`;

  // Sit in the top bar with the theme / language / help buttons.
  const group = document.querySelector('header .help-date-wrap') || document.querySelector('header');
  const prefsGroup = group?.querySelector('.ui-prefs');
  if (prefsGroup) prefsGroup.before(wrap); else group?.append(wrap);

  const btn = wrap.querySelector('.pn-btn');
  const count = wrap.querySelector('.pn-count');
  const listEl = wrap.querySelector('.pn-list');
  const markBtn = wrap.querySelector('.pn-mark');
  const deviceEl = wrap.querySelector('.pn-device');

  let items = [];
  const readIds = new Set(readJson(key('read'), []));
  const alerted = new Set(readJson(key('alerted'), []));
  let firstLoad = !localStorage.getItem(key('alerted'));

  const isUnread = (n) => !readIds.has(n.id);

  function paint() {
    const unread = items.filter(isUnread).length;
    count.hidden = unread === 0;
    count.textContent = unread > 9 ? '9+' : String(unread);
    btn.setAttribute('aria-label', unread ? `${t.open} — ${t.unread(unread)}` : t.open);
    markBtn.disabled = unread === 0;
    listEl.innerHTML = items.length
      ? items.map(n => `
        <a class="pn-item ${isUnread(n) ? 'pn-unread' : ''}" href="${esc(n.href)}" data-id="${esc(n.id)}" ${n.external ? 'target="_blank" rel="noopener"' : ''}>
          <span class="pn-icon" style="color:${TONE[n.kind]};background:${TONE[n.kind]}1a;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n.kind]}</svg></span>
          <span class="pn-text"><span class="pn-title">${n.title}</span>${n.body ? `<span class="pn-body" style="display:block">${n.body}</span>` : ''}<span class="pn-time" style="display:block">${esc(timeAgo(n.at, lang))}</span></span>
        </a>`).join('')
      : `<p class="pn-empty">${t.empty}</p>`;
    paintDevice();
  }

  function paintDevice() {
    if (!('Notification' in window) || !loadPrefs().device) { deviceEl.innerHTML = ''; return; }
    if (Notification.permission === 'granted') deviceEl.innerHTML = `<span class="pn-note">✓ ${t.allowed}</span>`;
    else if (Notification.permission === 'denied') deviceEl.innerHTML = `<span class="pn-note">${t.blocked}</span>`;
    else deviceEl.innerHTML = `<button type="button" class="pn-allow">${t.allow}</button>`;
  }

  function saveRead() {
    // Only remember ids that still exist, so the list doesn't grow forever.
    const live = new Set(items.map(n => n.id));
    writeJson(key('read'), [...readIds].filter(id => live.has(id)));
  }

  async function popUp(n) {
    const text = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const url = new URL(n.href, location.href).href;
    const options = { body: text(n.body), icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, badge: `${import.meta.env.BASE_URL}icons/icon-192.png`, tag: n.id, data: { url } };
    try {
      const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(text(n.title), options); return; }
      const note = new Notification(text(n.title), options);
      note.onclick = () => { window.focus(); location.href = url; };
    } catch (err) { console.warn('Could not show a pop-up notification:', err); }
  }

  async function refresh() {
    try { items = await collectNotifications(lang); } catch (err) { console.error('Could not load notifications:', err); return; }
    // First visit on this device: don't mark 30 days of history as "new" — only the last 7 days.
    if (firstLoad) {
      const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
      items.filter(n => n.at < weekAgo).forEach(n => readIds.add(n.id));
    }
    const fresh = items.filter(n => isUnread(n) && !alerted.has(n.id));
    // Pop-ups only for things that arrive while the portal is open, never a backlog.
    if (!firstLoad && loadPrefs().device && 'Notification' in window && Notification.permission === 'granted') {
      fresh.slice(0, 3).forEach(popUp);
    }
    fresh.forEach(n => alerted.add(n.id));
    writeJson(key('alerted'), [...alerted].slice(-200));
    firstLoad = false;
    saveRead();
    paint();
  }

  function open() {
    wrap.classList.add('pn-open');
    btn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    wrap.classList.remove('pn-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => { e.stopPropagation(); wrap.classList.contains('pn-open') ? close() : open(); });
  wrap.querySelector('.pn-close').addEventListener('click', close);
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('pn-open')) { close(); btn.focus(); } });

  markBtn.addEventListener('click', () => { items.forEach(n => readIds.add(n.id)); saveRead(); paint(); });
  listEl.addEventListener('click', (e) => {
    const a = e.target.closest('.pn-item');
    if (a) { readIds.add(a.dataset.id); saveRead(); }
  });
  deviceEl.addEventListener('click', async (e) => {
    if (!e.target.closest('.pn-allow')) return;
    await enableDeviceAlerts();
    paintDevice();
  });

  document.addEventListener('sacradigit:notif-prefs', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
  paint();
  refresh();
}
