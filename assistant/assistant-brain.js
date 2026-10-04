/* ============================================
   SacraDigit — Parish Assistant: the "brain"
   Works out what a question is about (Mass
   times, a service, certificates, your requests…),
   which day it means and whether it was asked in
   English or Filipino, then builds the answer
   from live parish data.

   Runs entirely in the browser: no AI service,
   no API key, no cost, and nothing typed here
   leaves the site. Data comes in through `ctx`
   (see parish-assistant.js), so this file has no
   screen code and can be tested on its own.

   answerQuestion(question, ctx) → { html, chips, lang, intent }
   ============================================ */

import { SERVICE_TYPES } from '../service-catalog.js';
import { SERVICE_SCHEDULES, scheduleFor } from '../service-schedule.js';
import { DAY_ORDER, dayKeyForDate, timeToMinutes } from '../weekly-mass-schedule.js';
import {
  PARISH_CONTACT, REQUIREMENTS, CERTIFICATES, OFFERING_PER_INTENTION, SERVICE_NAMES_FIL, SERVICE_KEYWORDS,
} from './assistant-knowledge.js';

/* ---------- small helpers ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Lowercase, no accents or punctuation, single spaces, padded — so ` word ` matching works. */
export function normalize(s) {
  return ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '').replace(/[^a-z0-9₱\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

/** Typo distance; two swapped letters ("bapitsm") count as one typo. */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Does normalized text `n` contain keyword `kw`? Single long words also match small typos ("baptsm"). */
function has(n, kw) {
  const k = normalize(kw);
  if (n.includes(k)) return true;
  const word = k.trim();
  if (word.includes(' ') || word.length < 6) return false; // short words match exactly ("hours" ≠ "house")
  const allowed = word.length >= 8 ? 2 : 1;
  return n.trim().split(' ').some(t => t.length >= 4 && editDistance(t, word) <= allowed);
}

const hasAny = (n, list) => list.some(kw => has(n, kw));

/* ---------- language ---------- */

// Words that only show up in Filipino/Taglish questions.
const FIL_MARKERS = ['po', 'ba', 'ang', 'ng', 'mga', 'ano', 'anong', 'paano', 'pano', 'kailan', 'saan', 'magkano', 'ilan', 'pwede', 'puwede',
  'kailangan', 'gusto', 'ko', 'ako', 'namin', 'natin', 'ngayon', 'ngayong', 'bukas', 'misa', 'binyag', 'kasal', 'kumpil', 'salamat',
  'kumusta', 'kamusta', 'sa', 'wala', 'meron', 'mayroon', 'oras', 'lang', 'naman', 'nga', 'yung', 'yong', 'para', 'dito', 'kayo', 'magkakaroon'];

export function detectLang(question, uiLang = 'en') {
  const words = normalize(question).trim().split(' ');
  const hits = words.filter(w => FIL_MARKERS.includes(w)).length;
  if (hits >= 1) return 'fil';
  if (words.some(w => /^[a-z]{3,}$/.test(w))) return 'en';
  return uiLang === 'fil' ? 'fil' : 'en';
}

/* ---------- dates ---------- */

const DAY_WORDS = {
  sunday: ['sunday', 'sundays', 'linggo', 'sun'], monday: ['monday', 'lunes', 'mon'], tuesday: ['tuesday', 'martes', 'tue', 'tues'],
  wednesday: ['wednesday', 'miyerkules', 'miyerkoles', 'wed'], thursday: ['thursday', 'huwebes', 'thu', 'thurs'],
  friday: ['friday', 'biyernes', 'fri'], saturday: ['saturday', 'sabado', 'sat'],
};
const JS_DAY = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Which day(s) the question means: { kind: 'date', iso } | { kind: 'week' } | null */
export function parseDay(n, today) {
  if (hasAny(n, ['this week', 'next 7 days', 'weekly', 'every day', 'everyday', 'araw araw', 'ngayong linggo', 'buong linggo', 'isang linggo', 'linggo linggo', 'whole week', 'schedule for the week'])) return { kind: 'week' };
  if (hasAny(n, ['tomorrow', 'bukas'])) return { kind: 'date', iso: toISO(addDays(today, 1)) };
  if (hasAny(n, ['today', 'tonight', 'ngayon', 'ngayong araw', 'mamaya', 'this evening', 'this morning'])) return { kind: 'date', iso: toISO(today) };
  if (hasAny(n, ['weekend', 'sabado at linggo'])) return { kind: 'weekend' };
  for (const [key, words] of Object.entries(DAY_WORDS)) {
    if (words.some(w => n.includes(` ${w} `))) {
      const diff = (JS_DAY[key] - today.getDay() + 7) % 7;
      return { kind: 'date', iso: toISO(addDays(today, diff)) };
    }
  }
  return null;
}

/* ---------- understanding the question ---------- */

// Weight 3 = clearly about this topic; weight 1 = a hint that other topics can outweigh.
const INTENTS = [
  { id: 'my_requests', strong: ['my request', 'my requests', 'my certificate request', 'my booking', 'my bookings', 'request ko', 'aking request', 'mga request ko', 'booking ko', 'status of my', 'is it ready', 'ready na ba', 'ready for pick up', 'pwede na kunin', 'napprove', 'approved na', 'view requests', 'see requests', 'track request', 'requested services'], weak: ['status', 'nasaan na', 'request', 'requests', 'booking', 'bookings'] },
  { id: 'announcements', strong: ['announcement', 'announcements', 'news', 'balita', 'anunsyo', 'patalastas', 'whats new', 'what is new', 'upcoming events', 'parish events', 'event', 'events'], weak: ['update', 'updates'] },
  { id: 'account', strong: ['password', 'change password', 'my profile', 'profile', 'my account', 'log out', 'logout', 'sign out', 'dark mode', 'light mode', 'change language', 'filipino', 'tagalog', 'english', 'palitan ang password', 'mag logout'], weak: ['account', 'settings', 'language'] },
  { id: 'certificate', strong: ['certificate', 'certificates', 'cert', 'sertipiko', 'katibayan', 'certified true copy', 'copy of my baptism', 'copy of my marriage', 'record of my'], weak: ['copy', 'kopya', 'record'] },
  { id: 'intention', strong: ['mass intention', 'intention', 'intentions', 'pamisa', 'ipamisa', 'ipagmisa', 'ipagdasal', 'padasal', 'offer a mass', 'mass for my', 'mass for the', 'misa para sa', 'repose of the soul', 'thanksgiving mass'], weak: ['offering', 'handog'] },
  { id: 'facility', strong: ['facility', 'facilities', 'parish hall', 'multi purpose hall', 'function room', 'venue', 'pasilidad', 'bulwagan', 'catechetical room', 'adoration chapel', 'rent the', 'reserve a', 'book a room', 'book the hall', 'upa'], weak: ['hall', 'room', 'reserve', 'rent'] },
  { id: 'donation', strong: ['donate', 'donation', 'donations', 'abuloy', 'tithe', 'ikapu', 'magbigay', 'building fund', 'poor box', 'give online', 'love offering', 'magdonate', 'mag donate', 'gcash', 'maya'], weak: ['give', 'fund', 'bigay'] },
  { id: 'livestream', strong: ['livestream', 'live stream', 'online mass', 'streaming', 'facebook live', 'watch the mass', 'watch mass', 'live ba', 'naka live', 'mass online', 'misa online', 'live now', 'live today', 'mass live', 'live mass', 'is it live', 'live na', 'live ngayon'], weak: ['live', 'watch', 'panoorin'] },
  { id: 'badges', strong: ['badge', 'badges', 'check in', 'checkin', 'check-in', 'qr code', 'attendance', 'faith journey', 'faithful givers'], weak: ['qr'] },
  { id: 'closed', strong: ['closed', 'closure', 'sarado', 'walang misa', 'no mass', 'no masses', 'cancelled mass', 'walang serbisyo'], weak: ['holiday'] },
  { id: 'contact', strong: ['contact', 'phone number', 'telephone', 'email', 'office hours', 'parish office', 'opisina', 'telepono', 'numero', 'call the', 'tawagan', 'message the parish'], weak: ['address', 'office', 'where is the parish', 'saan ang simbahan', 'location'] },
  { id: 'mass', strong: ['mass', 'masses', 'misa', 'sunday mass', 'simba', 'magsisimba', 'anticipated', 'misa ngayon', 'mass schedule', 'mass times'], weak: ['schedule', 'time', 'oras', 'what time', 'anong oras'] },
  { id: 'help', strong: ['what can you do', 'what can i ask', 'help me', 'ano ang kaya mo', 'ano kaya mo', 'paano gamitin', 'how does this work'], weak: ['help', 'tulong'] },
  { id: 'thanks', strong: ['thank you', 'thanks', 'salamat', 'maraming salamat', 'thank u', 'ty po'], weak: [] },
  { id: 'greeting', strong: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'kumusta', 'kamusta', 'magandang umaga', 'magandang hapon', 'magandang gabi'], weak: [] },
];

/* ---------- autocorrect ---------- */

// Everyday words that must never be "corrected" into a parish word ("does" ≠ "dogs").
const COMMON = new Set(`a an the is are am was were be been being do does did done doing have has had having can could would should will shall may might must
  i me my mine you your yours we our us they them their he she it its his her this that these those there here what when where which who whom whose why how
  to for of in on at by with from about into onto over under after before between during without within again also just only still yet even ever never always
  and or but if then than so because while until not no yes please pls thanks thank okay ok sure very much many more most some any all each every other another
  need needs want wants like get gets got give gives take takes make makes know tell told say said see seen view show look find check track help ask asked
  go goes going come comes open close use used using let lets try keep put set send sent pay paid cost costs price prices fee fees free long soon
  now next last first new old good best right left same different easy hard ready done made time times day days week weeks month months year years
  people person family child children kid kids baby parents mother father wife husband son daughter friend name names number home work school church priest
  morning afternoon evening night noon later early late today tomorrow yesterday whats wheres hows dont cant wont im ive`.split(/\s+/).filter(Boolean));

let vocab = null;
function buildVocab() {
  const words = new Set();
  const add = (phrase) => normalize(phrase).trim().split(' ').forEach(w => { if (w.length >= 3 && !/\d/.test(w)) words.add(w); });
  INTENTS.forEach(it => [...it.strong, ...it.weak].forEach(add));
  SERVICE_TYPES.forEach(s => { add(s.name); add(SERVICE_NAMES_FIL[s.name] || ''); (SERVICE_KEYWORDS[s.name] || []).forEach(add); });
  Object.values(DAY_WORDS).flat().forEach(add);
  FIL_MARKERS.forEach(add);
  ['schedule', 'schedules', 'certificate', 'requirement', 'requirements', 'blessing', 'blessings', 'sacrament', 'sacraments', 'parish', 'office',
    'weekend', 'tomorrow', 'today', 'tonight', 'bukas', 'ngayon', 'mamaya', 'confession', 'intention', 'donation', 'facility', 'livestream',
    'announcement', 'baptismal', 'wedding', 'kailangan', 'magkano', 'paano', 'kailan', 'saan', 'requested', 'services', 'service'].forEach(add);
  return words;
}

/** Fixes misspelled words (and plurals) toward words the assistant knows. Returns the corrected, normalized text. */
export function autocorrect(n) {
  vocab ||= buildVocab();
  let changed = false;
  const out = n.trim().split(' ').map(t => {
    if (!t || t.length < 4 || /\d/.test(t) || COMMON.has(t) || vocab.has(t)) return t;
    for (const base of [t.replace(/ies$/, 'y'), t.replace(/es$/, ''), t.replace(/s$/, '')]) {
      if (base !== t && vocab.has(base)) return base; // plural → the word we know (no need to announce)
    }
    const allowed = t.length >= 7 ? 2 : 1;
    let best = null, bestD = allowed + 1;
    for (const v of vocab) {
      if (Math.abs(v.length - t.length) > allowed || v.length < 4) continue;
      const d = editDistance(t, v);
      if (d < bestD || (d === bestD && best && v[0] === t[0] && best[0] !== t[0])) { best = v; bestD = d; }
    }
    if (best) { changed = true; return best; }
    return t;
  });
  return { n: ' ' + out.join(' ') + ' ', changed };
}

/** The service a question names, if any (Baptism, Wedding, House Blessing…). */
export function findService(n) {
  let best = null, bestLen = 0;
  for (const s of SERVICE_TYPES) {
    const words = [s.name, SERVICE_NAMES_FIL[s.name] || '', ...(SERVICE_KEYWORDS[s.name] || [])].filter(Boolean);
    for (const w of words) {
      // Longest match wins, so "anniversary mass" beats "mass" and "house blessing" beats "house".
      if (has(n, w) && w.length > bestLen) { best = s; bestLen = w.length; }
    }
  }
  return best;
}

const VIEW_WORDS = ['see', 'view', 'check', 'track', 'find', 'show', 'look', 'where', 'nasaan', 'tingnan', 'makita', 'saan', 'follow up', 'status', 'list'];

export function understand(question, { today = new Date(), uiLang = 'en' } = {}) {
  const { n, changed } = autocorrect(normalize(question));
  const lang = detectLang(question, uiLang);
  const service = findService(n);
  const day = parseDay(n, today);

  const scores = new Map();
  for (const it of INTENTS) {
    let s = 0;
    for (const kw of it.strong) if (has(n, kw)) s += 3;
    for (const kw of it.weak) if (has(n, kw)) s += 1;
    if (s) scores.set(it.id, s);
  }
  if (service) scores.set('service', (scores.get('service') || 0) + 3);

  // "how to see/view/check requests", "saan makikita ang booking" → their own requests.
  if (!service && !scores.has('certificate') && hasAny(n, ['request', 'requests', 'booking', 'bookings']) && hasAny(n, VIEW_WORDS)) {
    scores.set('my_requests', (scores.get('my_requests') || 0) + 3);
  }

  // A service named together with "certificate" is a certificate question
  // ("baptismal certificate"); together with "my request"/"status" it's about their request.
  if (scores.has('certificate') && service) scores.set('service', 0);
  if (scores.has('my_requests') && (scores.get('my_requests') >= 3)) scores.set('service', 0);
  // "Funeral Mass", "Anniversary Mass": the service, not the Mass schedule.
  if (service && scores.has('mass') && service.category === 'special-mass') scores.set('mass', 0);
  // A day with nothing else ("sa Linggo?", "what about tomorrow") means Mass times.
  if (day && !scores.size) scores.set('mass', 1);

  // Earlier wins a tie: "ipamisa para sa yumao" is an intention, not a funeral booking.
  const order = ['my_requests', 'certificate', 'intention', 'service', 'facility', 'donation', 'livestream', 'badges', 'announcements', 'account', 'closed', 'mass', 'contact', 'help', 'thanks', 'greeting'];
  let intent = null, top = 0;
  for (const id of order) {
    const s = scores.get(id) || 0;
    if (s > top) { intent = id; top = s; }
  }
  return { intent, service, day, lang, n, corrected: changed ? n.trim() : null };
}

/* ---------- wording ---------- */

const T = {
  en: {
    daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], daily: 'Every day', monSat: 'Mon–Sat', monFri: 'Mon–Fri',
    today: 'today', tomorrow: 'tomorrow',
  },
  fil: {
    daysShort: ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'], daily: 'Araw-araw', monSat: 'Lunes–Sabado', monFri: 'Lunes–Biyernes',
    today: 'ngayon', tomorrow: 'bukas',
  },
};
const DAY_FIL = { sunday: 'Linggo', monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miyerkules', thursday: 'Huwebes', friday: 'Biyernes', saturday: 'Sabado' };

const serviceName = (s, lang) => (lang === 'fil' && SERVICE_NAMES_FIL[s.name]) ? `${SERVICE_NAMES_FIL[s.name]} (${s.name})` : s.name;

function daysText(days, lang) {
  const t = T[lang];
  if (days.length === 7) return t.daily;
  if (days.join() === '1,2,3,4,5,6') return t.monSat;
  if (days.join() === '1,2,3,4,5') return t.monFri;
  return days.map(d => t.daysShort[d]).join(', ');
}

function dayLabel(iso, today, lang) {
  const d = new Date(iso + 'T00:00:00');
  const key = dayKeyForDate(iso);
  const name = lang === 'fil' ? DAY_FIL[key] : key[0].toUpperCase() + key.slice(1);
  const date = d.toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric' });
  if (iso === toISO(today)) return `${lang === 'fil' ? 'Ngayong' : 'Today,'} ${name} (${date})`;
  if (iso === toISO(addDays(today, 1))) return `${lang === 'fil' ? 'Bukas,' : 'Tomorrow,'} ${name} (${date})`;
  return `${name}, ${date}`;
}

const link = (href, label) => `<a class="pa-link" href="${href}">${esc(label)} →</a>`;
const list = (items) => `<ul class="pa-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const pills = (times) => times.map(t => `<span class="pa-pill">${esc(t)}</span>`).join(' ');
const sortTimes = (ts) => [...new Set(ts)].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

/* ---------- answers ---------- */

async function massAnswer(q, ctx) {
  const { lang } = q;
  const today = ctx.today;
  const weekly = await ctx.data.weekly();
  const masses = await ctx.data.masses().catch(() => []);
  const byDay = new Map(weekly.map(w => [w.dayKey, w]));

  const timesOn = (iso) => {
    const regular = byDay.get(dayKeyForDate(iso))?.times || [];
    const extra = masses.filter(m => m.date === iso);
    return { regular, extra };
  };

  const specialsSoon = masses
    .filter(m => m.isSpecial && m.date >= toISO(today) && m.date <= toISO(addDays(today, 14)))
    .sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.time || '12:00 AM') - timeToMinutes(b.time || '12:00 AM'))
    .slice(0, 3);

  const saturdayNote = lang === 'fil'
    ? 'Ang Misa sa Sabado ng gabi ay <em>anticipated Mass</em> — tumutupad na ito sa obligasyon ng Linggo.'
    : 'Saturday evening Mass is an <em>anticipated Mass</em> — it fulfills your Sunday obligation.';

  let html;
  if (q.day?.kind === 'date' || q.day?.kind === 'weekend') {
    const dates = q.day.kind === 'weekend'
      ? [0, 1, 2, 3, 4, 5, 6].map(i => toISO(addDays(today, i))).filter(iso => ['saturday', 'sunday'].includes(dayKeyForDate(iso))).sort()
      : [q.day.iso];
    const blocks = dates.map(iso => {
      const { regular, extra } = timesOn(iso);
      const specials = extra.filter(m => m.isSpecial);
      const all = sortTimes([...regular, ...extra.filter(m => !m.isSpecial).map(m => m.time)]);
      let b = `<p><strong>${esc(dayLabel(iso, today, lang))}</strong><br>${all.length ? pills(all) : (lang === 'fil' ? 'Walang nakatakdang Misa.' : 'No Masses scheduled.')}</p>`;
      if (specials.length) {
        b += list(specials.map(m => `<strong>${esc(m.time)}</strong> — ${esc(m.title || m.note || (lang === 'fil' ? 'Espesyal na Misa' : 'Special Mass'))}`));
      }
      if (iso === toISO(today) && all.length) {
        const now = today.getHours() * 60 + today.getMinutes();
        const next = all.find(t => timeToMinutes(t) > now);
        b += `<p class="pa-muted">${next
          ? (lang === 'fil' ? `Susunod na Misa: <strong>${esc(next)}</strong>` : `Next Mass: <strong>${esc(next)}</strong>`)
          : (lang === 'fil' ? 'Tapos na ang mga Misa ngayong araw.' : 'Today’s Masses are over.')}</p>`;
      }
      return b;
    });
    html = blocks.join('');
    if (dates.some(iso => dayKeyForDate(iso) === 'saturday')) html += `<p class="pa-muted">${saturdayNote}</p>`;
  } else {
    html = `<p>${lang === 'fil' ? 'Ang regular na iskedyul ng Misa bawat linggo:' : 'Our regular weekly Mass schedule:'}</p>`;
    html += list(DAY_ORDER.map(({ key }) => {
      const w = byDay.get(key);
      const name = lang === 'fil' ? DAY_FIL[key] : key[0].toUpperCase() + key.slice(1);
      return `<strong>${esc(name)}</strong> ${w?.times?.length ? pills(w.times) : '—'}`;
    }));
    html += `<p class="pa-muted">${saturdayNote}</p>`;
  }
  if (specialsSoon.length && q.day?.kind !== 'date') {
    html += `<p><strong>${lang === 'fil' ? 'Mga paparating na Espesyal na Misa:' : 'Upcoming special Masses:'}</strong></p>`;
    html += list(specialsSoon.map(m => `${esc(dayLabel(m.date, today, lang))} · ${esc(m.time)} — ${esc(m.title || m.note || '')}`));
  }
  html += link('user-mass-schedule.html', lang === 'fil' ? 'Buksan ang Mass Schedule' : 'Open Mass Schedule');
  return {
    html,
    chips: lang === 'fil'
      ? ['Anong oras ang Misa bukas?', 'Misa ngayong linggo', 'May live stream ba?']
      : ['Mass times tomorrow', 'Mass this week', 'Is there a livestream?'],
  };
}

function serviceAnswer(q) {
  const { lang, service: s } = q;
  const sched = SERVICE_SCHEDULES[s.name] ? scheduleFor(s.name) : null;
  const reqs = REQUIREMENTS[s.name]?.[lang];
  let html = `<p><strong>${esc(serviceName(s, lang))}</strong>${lang === 'en' && s.desc ? ` — ${esc(s.desc)}` : ''}</p>`;
  if (sched) {
    const where = sched.location || (sched.locationField ? (lang === 'fil' ? 'sa address na ibibigay mo' : 'at the address you give') : '');
    html += list([
      `${lang === 'fil' ? 'Iskedyul' : 'Schedule'}: <strong>${esc(daysText(sched.days, lang))}</strong> · ${pills(sched.times)}`,
      where ? `${lang === 'fil' ? 'Lugar' : 'Where'}: ${esc(where)}` : null,
      sched.leadDays > 1
        ? (lang === 'fil' ? `Mag-book nang hindi bababa sa <strong>${sched.leadDays} araw</strong> bago` : `Book at least <strong>${sched.leadDays} days</strong> ahead`)
        : null,
    ].filter(Boolean));
  }
  if (reqs) {
    html += `<p><strong>${lang === 'fil' ? 'Karaniwang kailangan:' : 'What you usually need:'}</strong></p>${list(reqs.map(esc))}`;
    html += `<p class="pa-muted">${lang === 'fil' ? 'Kukumpirmahin ng parish office ang eksaktong mga kailangan.' : 'The parish office will confirm the exact requirements.'}</p>`;
  }
  html += link('user-request-service.html', lang === 'fil' ? `Mag-request ng ${SERVICE_NAMES_FIL[s.name] || s.name}` : `Request ${s.name}`);
  return {
    html,
    chips: lang === 'fil'
      ? ['Status ng mga request ko', 'Paano kumuha ng certificate?', 'Anong oras ang Misa sa Linggo?']
      : ['Status of my requests', 'How do I get a certificate?', 'Sunday Mass times'],
  };
}

function certificateAnswer(q) {
  const { lang, service } = q;
  const names = CERTIFICATES[lang];
  const CERT_FOR = { 'Baptism': 0, 'Confirmation': 1, 'First Communion': 2, 'Wedding': 3 };
  const wanted = service && names[CERT_FOR[service.name]];
  const steps = lang === 'fil'
    ? ['Buksan ang <strong>Request Certificate</strong> at piliin ang uri.', 'Punan ang mga detalye (pangalan, petsa, magulang) at ang layunin.', `Hintayin ang abiso — karaniwang <strong>${CERTIFICATES.processing.fil}</strong>.`, 'Kunin sa parish office. Magdala ng valid ID.']
    : ['Open <strong>Request Certificate</strong> and pick the type.', 'Fill in the details (names, dates, parents) and the purpose.', `Wait for the notice — usually <strong>${CERTIFICATES.processing.en}</strong>.`, 'Pick it up at the parish office. Bring a valid ID.'];
  let html = wanted
    ? `<p>${lang === 'fil' ? `Para makakuha ng <strong>${esc(wanted)}</strong>:` : `To get a <strong>${esc(wanted)}</strong>:`}</p>`
    : `<p>${lang === 'fil' ? 'Maaari kang mag-request ng:' : 'You can request:'} ${names.map(esc).join(', ')}.</p>`;
  html += `<ol class="pa-list">${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
  html += link('user-request-certificate.html', lang === 'fil' ? 'Mag-request ng Certificate' : 'Request a Certificate');
  html += ' ' + link('user-my-requests.html', lang === 'fil' ? 'Tingnan ang My Requests' : 'Track in My Requests');
  return { html, chips: lang === 'fil' ? ['Status ng mga request ko', 'Ano ang kailangan sa binyag?'] : ['Status of my requests', 'What do I need for a baptism?'] };
}

const CERT_STATUS = {
  en: { pending: 'Submitted — waiting for review', approved: 'Approved — being prepared', released: 'Released', rejected: 'Not approved' },
  fil: { pending: 'Naipasa — hinihintay ang review', approved: 'Aprubado — inihahanda na', released: 'Nai-release na', rejected: 'Hindi naaprubahan' },
};
const SERVICE_STATUS = {
  en: { pending: 'Waiting for the parish', scheduled: 'Scheduled', declined: 'Cancelled', completed: 'Completed' },
  fil: { pending: 'Hinihintay ang parokya', scheduled: 'Naka-iskedyul', declined: 'Kinansela', completed: 'Tapos na' },
};

async function myRequestsAnswer(q, ctx) {
  const { lang } = q;
  const [certs, services] = await Promise.all([ctx.data.myCertificates(), ctx.data.myServices()]);
  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric' }) : '';
  const rows = [
    ...certs.map(r => ({ at: r.createdAt, text: `<strong>${esc(r.certificateType)}</strong> — ${esc(CERT_STATUS[lang][r.status] || r.status || '')}${r.status === 'rejected' && r.rejectionReason ? ` (${esc(r.rejectionReason)})` : ''}` })),
    ...services.map(r => ({ at: r.createdAt, text: `<strong>${esc(r.type)}</strong> — ${esc(SERVICE_STATUS[lang][r.status] || r.status || '')}${r.status === 'scheduled' && r.date ? ` · ${esc(fmt(r.date + 'T00:00:00'))}${r.time ? ` ${esc(r.time)}` : ''}` : ''}` })),
  ].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 5);

  if (!rows.length) {
    return {
      html: `<p>${lang === 'fil' ? 'Wala ka pang request.' : 'You don’t have any requests yet.'}</p>${link('user-request-certificate.html', lang === 'fil' ? 'Mag-request ng Certificate' : 'Request a Certificate')} ${link('user-request-service.html', lang === 'fil' ? 'Mag-request ng Serbisyo' : 'Request a Service')}`,
      chips: lang === 'fil' ? ['Paano kumuha ng certificate?', 'Ano ang kailangan sa binyag?'] : ['How do I get a certificate?', 'What do I need for a baptism?'],
    };
  }
  return {
    html: `<p>${lang === 'fil' ? 'Ang pinakabago mong mga request:' : 'Your most recent requests:'}</p>${list(rows.map(r => r.text))}${link('user-my-requests.html', 'My Requests')} ${link('user-requested-services.html', 'Requested Services')}`,
    chips: lang === 'fil' ? ['Kailan makukuha ang certificate?', 'Contact ng parish office'] : ['How long do certificates take?', 'Parish office contact'],
  };
}

function intentionAnswer({ lang }) {
  const html = lang === 'fil'
    ? `<p>Ang <strong>Mass intention</strong> ay panalanging iniaalay sa Misa para sa isang tao o layunin — para sa kaluluwa ng yumao, paggaling, pasasalamat, o kaarawan.</p>${list([
      'Buksan ang <strong>Mass Intentions</strong> at pindutin ang Submit Intention.',
      'Piliin ang uri, ilagay ang mga pangalan, at ang petsa at oras ng Misa.',
      `Ang iminumungkahing handog ay <strong>₱${OFFERING_PER_INTENTION}</strong> bawat pangalan.`,
    ])}`
    : `<p>A <strong>Mass intention</strong> is a prayer offered at Mass for a person or purpose — the repose of a soul, healing, thanksgiving or a birthday.</p>${list([
      'Open <strong>Mass Intentions</strong> and tap Submit Intention.',
      'Choose the type, add the names, and pick the Mass date and time.',
      `The suggested offering is <strong>₱${OFFERING_PER_INTENTION}</strong> per name.`,
    ])}`;
  return { html: html + link('user-mass-intentions.html', lang === 'fil' ? 'Mag-submit ng Intention' : 'Submit an Intention'), chips: lang === 'fil' ? ['Anong oras ang Misa sa Linggo?'] : ['Sunday Mass times'] };
}

function facilityAnswer({ lang }, ctx) {
  const rows = ctx.facilities.map(f => `<strong>${esc(f.name)}</strong> — ${lang === 'fil' ? 'hanggang' : 'up to'} ${f.capacity} ${lang === 'fil' ? 'katao' : 'people'}`);
  return {
    html: `<p>${lang === 'fil' ? 'Maaari kang mag-book ng:' : 'You can book:'}</p>${list(rows)}<p class="pa-muted">${lang === 'fil' ? 'Pumili ng petsa at oras; aabisuhan ka kapag naaprubahan.' : 'Pick a date and time; you’ll be notified once it’s approved.'}</p>${link('user-facility-booking.html', lang === 'fil' ? 'Mag-book ng Facility' : 'Book a Facility')}`,
    chips: lang === 'fil' ? ['Status ng mga request ko'] : ['Status of my requests'],
  };
}

function donationAnswer({ lang }, ctx) {
  const funds = ctx.funds.map(f => `<strong>${esc(f.name)}</strong>${lang === 'en' && f.desc ? ` — ${esc(f.desc)}` : ''}`);
  return {
    html: `<p>${lang === 'fil' ? 'Salamat sa iyong kabutihang-loob! Maaari kang magbigay sa:' : 'Thank you for your generosity! You can give to:'}</p>${list(funds)}<p class="pa-muted">${lang === 'fil' ? 'Pindutin ang Give Now at pumili ng paraan (hal. GCash). Hindi ipinapakita kaninuman ang halaga.' : 'Tap Give Now and choose a method (e.g. GCash). Amounts are never shown to anyone.'}</p>${link('user-donations.html', lang === 'fil' ? 'Magbigay' : 'Give Now')}`,
    chips: lang === 'fil' ? ['Ano ang Faithful Givers?'] : ['What are badges?'],
  };
}

async function livestreamAnswer({ lang }, ctx) {
  const live = await ctx.data.livestream().catch(() => null);
  if (live?.isLive && live.url) {
    return {
      html: `<p>🔴 ${lang === 'fil' ? `<strong>Live ngayon</strong> sa ${esc(live.platform)}!` : `<strong>We’re live now</strong> on ${esc(live.platform)}!`}</p><a class="pa-link" href="${esc(live.url)}" target="_blank" rel="noopener">${lang === 'fil' ? 'Manood ngayon' : 'Watch now'} →</a>`,
      chips: [],
    };
  }
  return {
    html: `<p>${lang === 'fil' ? 'Walang live stream ngayon.' : 'The parish isn’t streaming right now.'}</p><p class="pa-muted">${lang === 'fil' ? 'Kapag nag-live ang parokya, lalabas ang “Watch Live” sa iyong Dashboard.' : 'When the parish goes live, a “Watch Live” banner appears on your Dashboard.'}</p>`,
    chips: lang === 'fil' ? ['Anong oras ang Misa ngayon?'] : ['Mass times today'],
  };
}

function badgesAnswer({ lang }) {
  const html = lang === 'fil'
    ? `<p>Sa bawat Misa, i-scan ang <strong>QR code</strong> sa screen ng simbahan (o i-type ang code) para mag-check in. Ang mga check-in at regular na pagbibigay ay nagbibigay ng <strong>badges</strong> sa iyong Faith Journey.</p>`
    : `<p>At Mass, scan the <strong>QR code</strong> on the church screen (or type the code) to check in. Check-ins and regular giving earn <strong>badges</strong> on your Faith Journey.</p>`;
  return { html: html + link('user-badges.html', lang === 'fil' ? 'Tingnan ang aking Badges' : 'See my Badges'), chips: lang === 'fil' ? ['Anong oras ang Misa sa Linggo?'] : ['Sunday Mass times'] };
}

async function closedAnswer({ lang }, ctx) {
  const closures = (await ctx.data.closures().catch(() => []))
    .filter(c => c.end >= toISO(ctx.today) && c.start <= toISO(addDays(ctx.today, 60)))
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!closures.length) {
    return { html: `<p>${lang === 'fil' ? 'Walang naka-anunsyong pagsasara sa susunod na 60 araw.' : 'No closures are announced for the next 60 days.'}</p>`, chips: lang === 'fil' ? ['Misa ngayong linggo'] : ['Mass this week'] };
  }
  const f = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric' });
  return {
    html: `<p>${lang === 'fil' ? 'Sarado ang mga serbisyo sa:' : 'Services are closed on:'}</p>${list(closures.map(c => `<strong>${esc(f(c.start))}${c.end !== c.start ? `–${esc(f(c.end))}` : ''}</strong> — ${esc(c.name || '')}`))}`,
    chips: lang === 'fil' ? ['Misa ngayong linggo'] : ['Mass this week'],
  };
}

async function announcementsAnswer({ lang }, ctx) {
  const items = (await ctx.data.announcements())
    .filter(a => a.published !== false)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 3);
  const f = (iso) => new Date(iso).toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric' });
  const html = items.length
    ? `<p>${lang === 'fil' ? 'Pinakabagong balita ng parokya:' : 'Latest from the parish:'}</p>${list(items.map(a => `<strong>${esc(a.title)}</strong>${a.createdAt ? ` <span class="pa-muted">· ${esc(f(a.createdAt))}</span>` : ''}`))}`
    : `<p>${lang === 'fil' ? 'Wala pang anunsyo sa ngayon.' : 'There are no announcements right now.'}</p>`;
  return { html: html + link('user-announcements.html', lang === 'fil' ? 'Lahat ng Anunsyo' : 'All Announcements'), chips: lang === 'fil' ? ['Misa ngayong linggo'] : ['Mass this week'] };
}

function accountAnswer(q) {
  const { lang, n } = q;
  const rows = [];
  if (hasAny(n, ['password', 'palitan ang password'])) rows.push(lang === 'fil' ? 'Para palitan ang password: <strong>My Profile → Security</strong>.' : 'To change your password: <strong>My Profile → Security</strong>.');
  if (hasAny(n, ['profile', 'my account', 'account', 'settings'])) rows.push(lang === 'fil' ? 'I-edit ang iyong pangalan at detalye sa <strong>My Profile</strong> (i-tap ang iyong pangalan sa ibaba ng menu).' : 'Edit your name and details in <strong>My Profile</strong> (tap your name at the bottom of the menu).');
  if (hasAny(n, ['log out', 'logout', 'sign out', 'mag logout'])) rows.push(lang === 'fil' ? 'Para mag-log out: i-tap ang iyong pangalan sa ibaba ng menu → <strong>Log Out</strong>.' : 'To log out: tap your name at the bottom of the menu → <strong>Log Out</strong>.');
  if (hasAny(n, ['dark mode', 'light mode'])) rows.push(lang === 'fil' ? 'Gamitin ang <strong>🌙 button</strong> sa itaas para sa dark/light mode.' : 'Use the <strong>🌙 button</strong> at the top for dark/light mode.');
  if (hasAny(n, ['language', 'filipino', 'tagalog', 'english', 'change language'])) rows.push(lang === 'fil' ? 'Gamitin ang <strong>EN / FIL</strong> button sa itaas para palitan ang wika.' : 'Use the <strong>EN / FIL</strong> button at the top to switch language.');
  if (!rows.length) rows.push(lang === 'fil' ? 'Nasa <strong>My Profile</strong> ang iyong account at password.' : 'Your account details and password are in <strong>My Profile</strong>.');
  return { html: list(rows) + link('user-profile.html', 'My Profile'), chips: lang === 'fil' ? ['Ano ang kaya mong sagutin?'] : ['What can you help with?'] };
}

async function contactAnswer({ lang }, ctx) {
  // Saved by ITech / the Head Admin (see ../parish-info.js); file defaults otherwise.
  const c = (await ctx?.data?.contact?.().catch(() => null)) || PARISH_CONTACT;
  const rows = [
    c.officeHours?.[lang] ? `${lang === 'fil' ? 'Oras ng opisina' : 'Office hours'}: ${esc(c.officeHours[lang])}` : null,
    c.phone ? `${lang === 'fil' ? 'Telepono' : 'Phone'}: <a class="pa-link-inline" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a>` : null,
    c.email ? `Email: <a class="pa-link-inline" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : null,
    c.facebook ? `Facebook: <a class="pa-link-inline" href="${esc(c.facebook)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : null,
  ].filter(Boolean);
  const html = rows.length
    ? `<p><strong>${esc(c.name)}</strong></p>${list(rows)}`
    : `<p>${lang === 'fil' ? `Para sa ibang tanong, bisitahin o kontakin ang parish office ng ${esc(c.name)}.` : `For anything else, please visit or contact the ${esc(c.name)} parish office.`}</p>`;
  return { html, chips: lang === 'fil' ? ['Ano ang kaya mong sagutin?'] : ['What can you help with?'] };
}

function helpAnswer({ lang }) {
  return {
    html: lang === 'fil'
      ? `<p>Ako ang <strong>Parish Assistant</strong> ng SacraDigit. Maaari mo akong tanungin tungkol sa:</p>${list(['Oras ng Misa (ngayon, bukas, Linggo…)', 'Binyag, Kasal, Kumpil at iba pang serbisyo — iskedyul at kailangan', 'Pagkuha ng certificate', 'Status ng iyong mga request', 'Mass intentions, facility booking, at donasyon', 'Mga anunsyo at ang iyong account (password, wika)'])}`
      : `<p>I’m SacraDigit’s <strong>Parish Assistant</strong>. You can ask me about:</p>${list(['Mass times (today, tomorrow, Sunday…)', 'Baptism, weddings, confirmation and other services — schedules and requirements', 'Getting a certificate', 'The status of your requests', 'Mass intentions, facility booking and donations', 'Announcements and your account (password, language)'])}`,
    chips: starterChips(lang),
  };
}

export const starterChips = (lang) => lang === 'fil'
  ? ['Anong oras ang Misa sa Linggo?', 'Ano ang kailangan sa binyag?', 'Paano kumuha ng certificate?', 'Status ng mga request ko']
  : ['What time is Mass on Sunday?', 'What do I need for a baptism?', 'How do I get a certificate?', 'Status of my requests'];

function fallback({ lang }) {
  return {
    html: lang === 'fil'
      ? `<p>Pasensya na, hindi ko pa alam ang sagot diyan. 🙏 Subukan ang isa sa mga ito, o itanong sa parish office.</p>`
      : `<p>Sorry, I don’t know that one yet. 🙏 Try one of these, or ask the parish office.</p>`,
    chips: starterChips(lang),
  };
}

/* ---------- entry point ---------- */

export async function answerQuestion(question, ctx) {
  const q = understand(question, { today: ctx.today, uiLang: ctx.uiLang });
  let out;
  try {
    switch (q.intent) {
      case 'mass': out = await massAnswer(q, ctx); break;
      case 'service': out = serviceAnswer(q); break;
      case 'certificate': out = certificateAnswer(q); break;
      case 'my_requests': out = await myRequestsAnswer(q, ctx); break;
      case 'intention': out = intentionAnswer(q); break;
      case 'facility': out = facilityAnswer(q, ctx); break;
      case 'donation': out = donationAnswer(q, ctx); break;
      case 'livestream': out = await livestreamAnswer(q, ctx); break;
      case 'badges': out = badgesAnswer(q); break;
      case 'closed': out = await closedAnswer(q, ctx); break;
      case 'announcements': out = await announcementsAnswer(q, ctx); break;
      case 'account': out = accountAnswer(q); break;
      case 'contact': out = await contactAnswer(q, ctx); break;
      case 'help': out = helpAnswer(q); break;
      case 'thanks':
        out = { html: `<p>${q.lang === 'fil' ? 'Walang anuman! Pagpalain ka ng Diyos. 🙏' : 'You’re welcome! God bless. 🙏'}</p>`, chips: [] }; break;
      case 'greeting':
        out = { html: `<p>${q.lang === 'fil' ? 'Magandang araw! Paano kita matutulungan?' : 'Hello! How can I help you today?'}</p>`, chips: starterChips(q.lang) }; break;
      default: out = fallback(q);
    }
  } catch (err) {
    console.error('Parish assistant could not answer:', err);
    out = {
      html: `<p>${q.lang === 'fil' ? 'Hindi ko makuha ang impormasyon ngayon. Pakisubukang muli mamaya.' : 'I couldn’t load that information right now. Please try again in a moment.'}</p>`,
      chips: [],
    };
  }
  // Say how a misspelled question was read, so a wrong guess is easy to spot.
  if (q.corrected && q.intent && !['greeting', 'thanks'].includes(q.intent)) {
    out = { ...out, html: `<p class="pa-muted pa-understood">${q.lang === 'fil' ? 'Ang pagkaintindi ko' : 'I read that as'}: “${esc(q.corrected)}”</p>${out.html}` };
  }
  return { ...out, lang: q.lang, intent: q.intent };
}
