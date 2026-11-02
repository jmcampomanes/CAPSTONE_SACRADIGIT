/* ============================================
   SacraDigit — Parish Assistant: quick answers
   Common questions answered right here in the
   browser, without calling the AI.

   Deliberately cautious: a question is only
   answered if EVERY word in it is understood
   (see leftover()). "What time is Mass on Sunday?"
   is answered here; "What time is Mass on
   Christmas?" has a word we don't know, so it
   goes to the AI. Anything that returns null below
   falls through to OpenRouter as usual — including
   dates with a parish closure, where the wording
   needs more care than a template.

   To teach it a new question, add the words to
   that intent's list.
   ============================================ */

import { REQUIREMENTS, CERTIFICATES, FACILITIES, FUNDS, OFFERING_PER_INTENTION, SERVICE_NAMES_FIL } from './assistant-knowledge.js';
import { recurringMassesForDate, timeToMinutes } from '../weekly-mass-schedule.js';
import { liveStatus } from '../request-status.js';

/* ---------- reading the question ---------- */

const words = (list) => new Set(list.split(' '));

// Small words that never change what's being asked (English + Filipino/Taglish).
const FILLER = words('a an the is are do does i we my our me can could may please pls kindly you your ano ang ng sa mga ko ba po na nga naman yung ung nyo ninyo inyo hi hello');
const QUESTION = words('what whats how when where which paano pano saan nasaan kailan anong anu anung');

const normalize = (q) => q.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();

// The words in a question that neither FILLER nor this intent's list explains.
const leftover = (text, allowed) => text.split(' ').filter(w => w && !FILLER.has(w) && !QUESTION.has(w) && !allowed.has(w));
const understood = (text, allowed) => leftover(text, allowed).length === 0;

const t = (lang, en, fil) => (lang === 'fil' ? fil : en);
const bullets = (items) => items.map(i => `• ${i}`).join('\n');

/* ---------- dates ---------- */

const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const longDate = (iso, lang) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

const DAY_NAMES = [
  ['sunday', 'linggo'], ['monday', 'lunes'], ['tuesday', 'martes'], ['wednesday', 'miyerkules', 'miyerkoles'],
  ['thursday', 'huwebes'], ['friday', 'biyernes'], ['saturday', 'sabado'],
];
const closedDuring = (closures, fromISO, toISO) => closures.some(c => c.end >= fromISO && c.start <= toISO);

// Which day the question means: an ISO date, 'week' for all of them, or null if it names several.
function askedDay(text, now) {
  if (/\b(this week|ngayong linggo|linggong ito)\b/.test(text)) return 'week';
  const found = [];
  if (/\b(today|ngayon|ngayong araw)\b/.test(text) && !/\bngayong (?!araw)/.test(text)) found.push(0);
  if (/\b(tomorrow|bukas)\b/.test(text)) found.push(1);
  DAY_NAMES.forEach((names, day) => {
    if (names.some(n => new RegExp(`\\b${n}\\b`).test(text))) found.push((day - now.getDay() + 7) % 7);
  });
  if (found.length > 1) return null;
  return found.length ? localISO(addDays(now, found[0])) : 'week';
}

/* ---------- the questions we can answer ---------- */

const MASS_WORDS = words('mass masses misa misang time times oras schedule schedules sked iskedyul there meron may on at for this ngayon ngayong araw today tomorrow bukas week linggong ito regular weekly sunday monday tuesday wednesday thursday friday saturday linggo lunes martes miyerkules miyerkoles huwebes biyernes sabado');

async function massTimes(text, lang, facts) {
  if (!/\b(mass|masses|misa|misang)\b/.test(text) || !understood(text, MASS_WORDS)) return null;
  const now = new Date();
  const day = askedDay(text, now);
  if (!day) return null;
  const [weekly, masses, closures] = await Promise.all([facts.weekly(), facts.masses(), facts.closures()]);
  const todayISO = localISO(now);

  if (day === 'week') {
    const endISO = localISO(addDays(now, 6));
    if (closedDuring(closures, todayISO, endISO)) return null;
    const special = masses
      .filter(m => m.isSpecial && m.date >= todayISO && m.date <= endISO)
      .sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.time) - timeToMinutes(b.time))
      .map(m => `${longDate(m.date, lang)}, ${m.time}${m.title ? ` — ${m.title}` : ''}`);
    return [
      t(lang, 'Regular Mass times:', 'Regular na oras ng Misa:'),
      bullets(weekly.map(d => {
        const names = DAY_NAMES.find(n => n[0] === d.dayKey);
        const name = lang === 'fil' ? names[1][0].toUpperCase() + names[1].slice(1) : d.dayLabel;
        return `${name}: ${d.times.join(', ') || t(lang, 'no Mass', 'walang Misa')}`;
      })),
      ...(special.length ? ['', t(lang, 'Special Masses this week:', 'Espesyal na Misa ngayong linggo:'), bullets(special)] : []),
      '',
      t(lang, 'See Mass Schedule for any other date.', 'Tingnan ang Iskedyul ng Misa para sa ibang petsa.'),
    ].join('\n');
  }

  if (closedDuring(closures, day, day)) return null;
  const scheduled = masses.filter(m => m.date === day);
  const all = [...recurringMassesForDate(weekly, day, scheduled), ...scheduled]
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  if (!all.length) return t(lang, `There is no Mass listed for ${longDate(day, lang)}.`, `Walang nakalistang Misa sa ${longDate(day, lang)}.`);
  return [
    t(lang, `Mass on ${longDate(day, lang)}:`, `Misa sa ${longDate(day, lang)}:`),
    bullets(all.map(m => (m.isSpecial && m.title ? `${m.time} — ${m.title}` : m.time))),
  ].join('\n');
}

// Only the plain names: a word like "ninong" or "sick" alone isn't asking for the whole list.
const SERVICE_NAMES = {
  'Baptism': 'baptism baptized binyag binyagan pabinyag magpabinyag ipabinyag',
  'Confirmation': 'confirmation kumpil',
  'First Communion': 'first communion unang komunyon',
  'Wedding': 'wedding marriage kasal ikasal magpakasal',
  'Funeral Mass': 'funeral mass misa para yumao',
  'Inurnment': 'inurnment',
  'Anointing of the Sick': 'anointing of sick',
  'Confession / Reconciliation': 'confession reconciliation kumpisal',
};
const SERVICE_TEST = {
  'Baptism': /\b(baptism|baptized|binyag|binyagan|pabinyag|magpabinyag|ipabinyag)\b/,
  'Confirmation': /\b(confirmation|kumpil)\b/,
  'First Communion': /\b(first communion|unang komunyon)\b/,
  'Wedding': /\b(wedding|marriage|kasal|ikasal|magpakasal)\b/,
  'Funeral Mass': /\b(funeral mass|funeral)\b/,
  'Inurnment': /\binurnment\b/,
  'Anointing of the Sick': /\banointing of (the )?sick\b/,
  'Confession / Reconciliation': /\b(confession|reconciliation|kumpisal)\b/,
};
const NEED_RE = /\b(need|needed|requirement|requirements|require|required|kailangan|rekisitos|documents|dokumento)\b/;
const NEED_WORDS = words('need needed requirement requirements require required kailangan rekisitos documents dokumento for to of para have bring get magpa');

function requirements(text, lang) {
  if (!NEED_RE.test(text)) return null;
  const matches = Object.keys(SERVICE_TEST).filter(s => SERVICE_TEST[s].test(text));
  if (matches.length !== 1) return null;
  const service = matches[0];
  if (!understood(text, new Set([...NEED_WORDS, ...words(SERVICE_NAMES[service])]))) return null;
  const name = lang === 'fil' ? (SERVICE_NAMES_FIL[service] || service) : service;
  return [
    t(lang, `For ${name}, you will need:`, `Para sa ${name}, kailangan ang:`),
    bullets(REQUIREMENTS[service][lang]),
    '',
    t(lang, 'When you’re ready, go to Request a Service.', 'Kapag handa na, pumunta sa Humiling ng Serbisyo.'),
  ].join('\n');
}

const CERT_WORDS = words('certificate certificates sertipiko cert get request kumuha humingi humiling mag magrequest available types baptismal baptism confirmation first communion marriage kumpil kasal binyag to of para');

function certificates(text, lang) {
  if (!/\b(certificate|certificates|sertipiko|cert)\b/.test(text) || !understood(text, CERT_WORDS)) return null;
  return [
    t(lang, 'You can request these certificates online:', 'Maaari kang humiling ng mga certificate na ito online:'),
    bullets(CERTIFICATES[lang]),
    '',
    t(lang, `Go to Request a Certificate. Processing takes ${CERTIFICATES.processing.en}, and you can follow it in My Requests.`,
      `Pumunta sa Humiling ng Sertipiko. Tumatagal ito ng ${CERTIFICATES.processing.fil}, at masusubaybayan mo sa Aking mga Hiling.`),
  ].join('\n');
}

const REQUEST_WORDS = words('status request requests hiling hiniling aking of check show tingnan update');
const STATUS_LABELS = {
  en: { pending: 'Pending', approved: 'Ready for pick-up', released: 'Released', rejected: 'Not approved', scheduled: 'Scheduled', declined: 'Declined', completed: 'Completed', cancelled: 'Cancelled', void: 'Expired' },
  fil: { pending: 'Naghihintay', approved: 'Handa nang kunin', released: 'Nakuha na', rejected: 'Hindi naaprubahan', scheduled: 'Naka-iskedyul', declined: 'Tinanggihan', completed: 'Tapos na', cancelled: 'Kinansela', void: 'Nag-expire' },
};
const newestFirst = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

async function myRequests(text, lang, facts) {
  if (!/\b(request|requests|hiling|hiniling)\b/.test(text) || !/\b(my|ko|aking)\b/.test(text) || !understood(text, REQUEST_WORDS)) return null;
  if (!facts.signedIn) return null;
  const [certs, services] = await Promise.all([facts.myCertificates(), facts.myServices()]);
  const label = (r) => { const s = liveStatus(r); return STATUS_LABELS[lang][s] || String(s || '').replace(/-/g, ' '); };
  const certLines = [...certs].sort(newestFirst).slice(0, 5).map(r => `${r.certificateType}: ${label(r)}${r.rejectionReason ? ` (${r.rejectionReason})` : ''}`);
  const serviceLines = [...services].sort(newestFirst).slice(0, 5).map(r => `${r.type}: ${label(r)}${r.date ? ` — ${r.date}${r.time ? ` ${r.time}` : ''}` : ''}`);
  if (!certLines.length && !serviceLines.length) {
    return t(lang, 'You don’t have any requests yet. You can start one from Request a Certificate or Request a Service.',
      'Wala ka pang request. Maaari kang magsimula sa Humiling ng Sertipiko o Humiling ng Serbisyo.');
  }
  return [
    ...(certLines.length ? [t(lang, 'Your certificate requests (latest first):', 'Mga request mo ng certificate (pinakabago muna):'), bullets(certLines), ''] : []),
    ...(serviceLines.length ? [t(lang, 'Your service requests (latest first):', 'Mga request mo ng serbisyo (pinakabago muna):'), bullets(serviceLines), ''] : []),
    t(lang, 'Full details are in My Requests and Requested Services.', 'Kumpletong detalye sa Aking mga Hiling at Mga Hiniling na Serbisyo.'),
  ].join('\n');
}

const CONTACT_RE = /\b(contact|phone|telephone|landline|email|address|location|facebook|fb|office hours|oras ng opisina|numero)\b|\b(where|saan|nasaan)\b.*\b(parish|church|simbahan|parokya)\b/;
const CONTACT_WORDS = words('contact contacts phone telephone landline number numero email address location facebook fb page office opisina hours oras parish church simbahan parokya details info information reach call tawag to of');

async function contact(text, lang, facts) {
  if (!CONTACT_RE.test(text) || !understood(text, CONTACT_WORDS)) return null;
  const c = await facts.contact();
  const hours = c.officeHours?.[lang] || '';
  if (/\b(hours|oras)\b/.test(text) && !hours) return null;
  const lines = [
    hours && t(lang, `Office hours: ${hours}`, `Oras ng opisina: ${hours}`),
    c.phone && t(lang, `Phone: ${c.phone}`, `Telepono: ${c.phone}`),
    c.email && `Email: ${c.email}`,
    c.facebook && `Facebook: ${c.facebook}`,
    c.location && t(lang, `Address: ${c.location}`, `Address: ${c.location}`),
  ].filter(Boolean);
  return lines.length ? [c.name, bullets(lines)].join('\n') : null;
}

const LIVE_RE = /\b(livestream|livestreams|live stream|streaming|online mass|online misa|naka live|live ba)\b/;
const LIVE_WORDS = words('livestream livestreams live stream streaming online mass misa naka there meron may now ngayon today watch nood manood where link');

async function livestream(text, lang, facts) {
  if (!LIVE_RE.test(text) || !understood(text, LIVE_WORDS)) return null;
  const live = await facts.livestream();
  if (!live?.isLive) return t(lang, 'There’s no livestream right now.', 'Walang livestream ngayon.');
  return live.url
    ? t(lang, `Yes, we’re live now${live.platform ? ` on ${live.platform}` : ''}: ${live.url}`, `Oo, live kami ngayon${live.platform ? ` sa ${live.platform}` : ''}: ${live.url}`)
    : t(lang, 'Yes, we’re live now.', 'Oo, live kami ngayon.');
}

const HOW_WORDS = words('to of get for make mag magpa gusto want like would');

function howTo(text, lang) {
  if (/\b(donate|donation|donations|give|magbigay|donasyon)\b/.test(text) && understood(text, new Set([...HOW_WORDS, ...words('donate donation donations give magbigay donasyon online funds fund')]))) {
    return [
      t(lang, 'You can give online on the Donations page, to any of these funds:', 'Maaari kang magbigay online sa Mga Donasyon, sa alinman sa mga pondong ito:'),
      bullets(FUNDS.map(f => f.name)),
    ].join('\n');
  }
  if (/\b(facility|facilities|hall|pasilidad)\b/.test(text) && understood(text, new Set([...HOW_WORDS, ...words('book booking reserve rent facility facilities hall halls pasilidad available')]))) {
    return [
      t(lang, 'You can book these on the Facility Booking page:', 'Maaari mong i-book ang mga ito sa Pag-book ng Pasilidad:'),
      bullets(FACILITIES.map(f => (f.capacity ? `${f.name} (${f.capacity})` : f.name))),
    ].join('\n');
  }
  if (/\b(intention|intentions|intensyon)\b/.test(text) && understood(text, new Set([...HOW_WORDS, ...words('mass misa intention intentions intensyon offer offering alay mag how much magkano minimum sa')]))) {
    return t(lang, `You can offer one on the Mass Intentions page. The minimum offering is ₱${OFFERING_PER_INTENTION}, and one offering covers the whole intention.`,
      `Maaari kang mag-alay sa Mga Intensyon sa Misa. Ang pinakamababang alay ay ₱${OFFERING_PER_INTENTION}, at sapat ang isang alay sa buong intensyon.`);
  }
  return null;
}

function smallTalk(text, lang) {
  if (/^(hi|hello|hey|helo|kumusta|kamusta|good (morning|afternoon|evening)|magandang (umaga|tanghali|hapon|gabi))( po)?$/.test(text)) {
    return t(lang, 'Hello! 👋 How can I help you today?', 'Magandang araw! 👋 Paano kita matutulungan?');
  }
  if (/^(ok(ay)? )?(thanks|thank you|thanks po|thank you po|ty|salamat|salamat po|maraming salamat( po)?)$/.test(text)) {
    return t(lang, 'You’re welcome! 🙏', 'Walang anuman! 🙏');
  }
  return null;
}

/**
 * Answers a predictable question without the AI.
 * @param {string} question - what the parishioner typed
 * @param {'en'|'fil'} lang
 * @param {object} facts - the live data loaders from parish-assistant.js, plus `signedIn`
 * @returns {Promise<string|null>} plain-text reply, or null to let the AI handle it
 */
export async function quickAnswer(question, lang, facts) {
  const text = normalize(question);
  if (!text) return null;
  return smallTalk(text, lang)
    || requirements(text, lang)
    || certificates(text, lang)
    || howTo(text, lang)
    || await massTimes(text, lang, facts)
    || await livestream(text, lang, facts)
    || await contact(text, lang, facts)
    || await myRequests(text, lang, facts);
}
