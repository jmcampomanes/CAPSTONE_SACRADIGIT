/* ============================================
   SacraDigit — Faith Journey badges
   Shared by the parishioner portal (My Badges,
   Dashboard, Donations) and the admin side.

   Badges are worked out from records the parish
   already keeps — Mass check-ins, donations, Mass
   intentions, blessings — so nothing extra is
   stored. They reward FAITHFULNESS, never money:
   giving badges and the Faithful Givers list look
   at how regularly someone gives, and amounts are
   never shown or compared.
   ============================================ */

/** Same key the backend uses: lowercased, trimmed, single-spaced name. */
export function parishionerKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/* ------------------------------------------
   Date helpers (all dates are local YYYY-MM-DD)
------------------------------------------ */

const pad2 = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISO = (iso) => new Date(`${iso}T00:00:00`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthKey = (iso) => iso.slice(0, 7); // "2026-09"

/** "06:00 AM" → minutes after midnight (null if unreadable). */
function minutesOf(time12) {
  const m = String(time12 || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return null;
  let h = +m[1];
  const mer = (m[3] || '').toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + +m[2];
}

/** Easter Sunday (Anonymous Gregorian algorithm). */
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * The Sunday a Mass counts toward: Sunday Masses count for that Sunday,
 * and Saturday Masses from 4 PM on (anticipated Mass) count for the next
 * day. Any other Mass → null.
 */
function obligationSunday(checkIn) {
  const d = parseISO(checkIn.massDate);
  if (d.getDay() === 0) return checkIn.massDate;
  const mins = minutesOf(checkIn.massTime);
  if (d.getDay() === 6 && mins !== null && mins >= 16 * 60) return isoDate(addDays(d, 1));
  return null;
}

/** Sunday that starts the week containing `d`. */
const sundayOf = (d) => addDays(d, -d.getDay());

/* ------------------------------------------
   Streak helpers
------------------------------------------ */

/**
 * Consecutive weeks (ending this week, or last week if this Sunday hasn't
 * come yet) in which the Sunday obligation was kept.
 */
function sundayStreak(sundays, today) {
  const set = new Set(sundays);
  let cur = sundayOf(today);
  if (!set.has(isoDate(cur))) cur = addDays(cur, -7); // this week isn't over yet
  let n = 0;
  while (set.has(isoDate(cur))) { n++; cur = addDays(cur, -7); }
  return n;
}

/** Longest run of consecutive weekly Sundays ever. */
function longestSundayRun(sundays) {
  const sorted = [...new Set(sundays)].sort();
  let best = 0, run = 0, prev = null;
  for (const s of sorted) {
    run = prev && (parseISO(s) - parseISO(prev)) / 86400000 === 7 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = s;
  }
  return best;
}

/** Consecutive calendar months with at least one gift, ending this month or last. */
export function monthStreak(dates, today = new Date()) {
  const set = new Set(dates.filter(Boolean).map(monthKey));
  let y = today.getFullYear(), m = today.getMonth();
  const key = () => `${y}-${pad2(m + 1)}`;
  const back = () => { m--; if (m < 0) { m = 11; y--; } };
  if (!set.has(key())) back(); // this month may simply not have come around yet
  let n = 0;
  while (set.has(key())) { n++; back(); }
  return n;
}

function longestMonthRun(dates) {
  const months = [...new Set(dates.filter(Boolean).map(monthKey))].sort();
  let best = 0, run = 0, prev = null;
  for (const mk of months) {
    const [y, m] = mk.split('-').map(Number);
    let consecutive = false;
    if (prev) { const [py, pm] = prev.split('-').map(Number); consecutive = (y * 12 + m) - (py * 12 + pm) === 1; }
    run = consecutive ? run + 1 : 1;
    best = Math.max(best, run);
    prev = mk;
  }
  return best;
}

/* ------------------------------------------
   Badge catalogue
   group: 'mass' | 'giving' | 'community'
   tier:  'bronze' | 'silver' | 'gold' (for icons)
   needsCheckIn: only meaningful once Mass
                 check-in is set up
------------------------------------------ */

const ICONS = {
  step:    '<path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.9l.9-5.4L4.2 8.7l5.4-.8z"/>',
  cross:   '<path d="M12 3v18M7 8h10"/>',
  flame:   '<path d="M12 21c-4 0-6.5-2.8-6.5-6.3 0-3.4 2.5-5.4 3.6-8.2.9 1.8 2 2.6 2.9 2.9C12.3 7 12.6 4.6 12 3c3.5 1.8 6.5 5.6 6.5 10.7 0 4.3-2.6 7.3-6.5 7.3z"/>',
  sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  star:    '<path d="M12 2l1.8 4.6L18 5l-1.6 4.4L21 12l-4.6 2.6L18 19l-4.2-1.6L12 22l-1.8-4.6L6 19l1.6-4.4L3 12l4.6-2.6L6 5l4.2 1.6z"/>',
  palm:    '<path d="M12 21V11M12 11c-2-3-6-3-8-1 3-.5 5.5.5 8 1zM12 11c2-3 6-3 8-1-3-.5-5.5.5-8 1zM12 11c-1-3.5-4-6-7-6 2.5 1.5 4.5 3.5 7 6zM12 11c1-3.5 4-6 7-6-2.5 1.5-4.5 3.5-7 6z"/>',
  church:  '<path d="M12 2v4M10 4h4M5 21V11l7-5 7 5v10M9 21v-5a3 3 0 016 0v5M3 21h18"/>',
  heart:   '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  hands:   '<path d="M7 11V6.5a1.5 1.5 0 013 0V11M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V13c0 4-2.5 7-6 7-2.5 0-4-1.4-5.4-3.4L3 14a1.6 1.6 0 012.5-2L7 13.5"/>',
  candle:  '<path d="M9 10h6v11H9zM12 10V7M12 7c-1.2-1-1.2-2.6 0-4 1.2 1.4 1.2 3 0 4z"/>',
  home:    '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/>',
  hammer:  '<path d="M14 6l4 4M12 8l4 4-8 8-4-4zM14 6l2-2 4 4-2 2"/>',
  dove:    '<path d="M3 13c3 0 5-1 7-4 1.5 3 4 4 7 3l4-3-2 5c-2 4-6 6-10 5l-3 2 1-4c-2-1-3-2-4-4z"/>',
  // extra choices for badges the admin makes (Sacradigit/badges.html)
  book:    '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7"/>',
  music:   '<path d="M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z"/>',
  bell:    '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>',
  crown:   '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5zM5 19h14"/>',
  shield:  '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"/>',
  rosary:  '<circle cx="12" cy="6" r="3"/><circle cx="6" cy="10" r="1.3"/><circle cx="18" cy="10" r="1.3"/><circle cx="7.5" cy="14.5" r="1.3"/><circle cx="16.5" cy="14.5" r="1.3"/><path d="M12 15v6M10 18h4"/>',
  users:   '<path d="M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8"/>',
  leaf:    '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l7-7"/>',
};

/** Icons the admin can pick for a new badge, in picker order. */
export const ICON_NAMES = Object.keys(ICONS);

const TIER_ORDER = { bronze: 1, silver: 2, gold: 3 };

export const BADGES = [
  // ---- Mass ----
  { id: 'first-step', group: 'mass', tier: 'bronze', icon: 'step', needsCheckIn: true,
    name: 'First Step', desc: 'Checked in at Mass for the first time.' },
  { id: 'faithful-month', group: 'mass', tier: 'silver', icon: 'cross', needsCheckIn: true,
    name: 'Faithful Month', desc: 'Kept every Sunday of a month (Saturday evening Mass counts).' },
  { id: 'steadfast-1', group: 'mass', tier: 'bronze', icon: 'flame', needsCheckIn: true,
    name: 'Steadfast', desc: 'Kept the Sunday Mass 4 weeks in a row.' },
  { id: 'steadfast-2', group: 'mass', tier: 'silver', icon: 'flame', needsCheckIn: true,
    name: 'Steadfast II', desc: 'Kept the Sunday Mass 12 weeks in a row.' },
  { id: 'steadfast-3', group: 'mass', tier: 'gold', icon: 'flame', needsCheckIn: true,
    name: 'Steadfast III', desc: 'Kept the Sunday Mass a whole year — 52 weeks in a row.' },
  { id: 'early-riser', group: 'mass', tier: 'bronze', icon: 'sun', needsCheckIn: true,
    name: 'Early Riser', desc: 'Heard 5 Masses that began before 7:00 AM.' },
  { id: 'simbang-gabi', group: 'mass', tier: 'gold', icon: 'star', needsCheckIn: true,
    name: 'Simbang Gabi', desc: 'Completed all nine Simbang Gabi Masses (Dec 16–24).' },
  { id: 'holy-week', group: 'mass', tier: 'gold', icon: 'palm', needsCheckIn: true,
    name: 'Holy Week Pilgrim', desc: 'Joined the Triduum: Holy Thursday, Good Friday, and the Easter Vigil or Easter Sunday.' },
  { id: 'masses-10', group: 'mass', tier: 'bronze', icon: 'church', needsCheckIn: true,
    name: 'Pilgrim', desc: 'Checked in at 10 Masses.' },
  { id: 'masses-50', group: 'mass', tier: 'silver', icon: 'church', needsCheckIn: true,
    name: 'Disciple', desc: 'Checked in at 50 Masses.' },
  { id: 'masses-100', group: 'mass', tier: 'gold', icon: 'church', needsCheckIn: true,
    name: 'Pillar of the Parish', desc: 'Checked in at 100 Masses.' },

  // ---- Giving (faithfulness, never amounts) ----
  { id: 'first-offering', group: 'giving', tier: 'bronze', icon: 'heart',
    name: 'First Offering', desc: 'Made a first offering to the parish.' },
  { id: 'faithful-giver-3', group: 'giving', tier: 'bronze', icon: 'hands',
    name: 'Faithful Giver', desc: 'Gave something 3 months in a row — any amount.' },
  { id: 'faithful-giver-6', group: 'giving', tier: 'silver', icon: 'hands',
    name: 'Faithful Giver II', desc: 'Gave something 6 months in a row — any amount.' },
  { id: 'faithful-giver-12', group: 'giving', tier: 'gold', icon: 'hands',
    name: 'Faithful Giver III', desc: 'Gave something every month for a year — any amount.' },
  { id: 'parish-builder', group: 'giving', tier: 'silver', icon: 'hammer',
    name: 'Parish Builder', desc: 'Helped build and care for the parish (Building Fund or a parish project).' },
  { id: 'heart-for-poor', group: 'giving', tier: 'silver', icon: 'dove',
    name: 'Heart for the Poor', desc: 'Gave to the Poor Box for parishioners in need.' },
  { id: 'intention', group: 'giving', tier: 'bronze', icon: 'candle',
    name: 'Prayer Offered', desc: 'Offered a Mass intention for a loved one.' },

  // ---- Community ----
  { id: 'blessed-home', group: 'community', tier: 'bronze', icon: 'home',
    name: 'Blessed Home', desc: 'Had a home, business, or vehicle blessed.' },
  { id: 'faithful-servant', group: 'community', tier: 'silver', icon: 'hands',
    name: 'Faithful Servant', desc: 'Served at Mass 4 times as a lector, choir member, altar server or usher.' },
];

export const BADGE_GROUPS = [
  { id: 'mass', label: 'Mass' },
  { id: 'giving', label: 'Giving' },
  { id: 'community', label: 'Community' },
  { id: 'honors', label: 'Parish Honors' }, // only badges the admin makes
];

export function badgeIconSvg(badge, cls = 'w-6 h-6') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[badge.icon] || ICONS.star}</svg>`;
}

/* ------------------------------------------
   Rules for badges the admin makes
   (CustomBadge records, see custom-badges.js)
   rule: { kind, target, from?, to?, match?, ministry? }
   Same records and the same faithfulness-not-money
   idea as the built-in badges above.
------------------------------------------ */

export const RULE_KINDS = [
  { id: 'masses', label: 'Masses attended', needsCheckIn: true, unit: 'Masses',
    describe: (r) => `Checked in at ${r.target} Mass${r.target === 1 ? '' : 'es'}.` },
  { id: 'masses-between', label: 'Masses during dates (feast, novena, event)', needsCheckIn: true, unit: 'Masses', dates: true,
    describe: (r) => `Heard ${r.target} Mass${r.target === 1 ? '' : 'es'} between ${fmtShort(r.from)} and ${fmtShort(r.to)}.` },
  { id: 'sunday-streak', label: 'Sundays in a row', needsCheckIn: true, unit: 'weeks in a row',
    describe: (r) => `Kept the Sunday Mass ${r.target} weeks in a row.` },
  { id: 'giving-months', label: 'Months of giving in a row', unit: 'months in a row',
    describe: (r) => `Gave something ${r.target} months in a row — any amount.` },
  { id: 'giving-fund', label: 'Gifts to a fund', unit: 'gifts', match: true,
    describe: (r) => `Gave to the ${r.match} ${r.target} time${r.target === 1 ? '' : 's'} — any amount.` },
  { id: 'intentions', label: 'Mass intentions offered', unit: 'intentions',
    describe: (r) => `Offered ${r.target} Mass intention${r.target === 1 ? '' : 's'}.` },
  { id: 'service', label: 'Times served in a ministry', unit: 'times served', ministry: true,
    describe: (r) => `Served at Mass ${r.target} time${r.target === 1 ? '' : 's'}${r.ministry ? ` (${r.ministryLabel || r.ministry})` : ''}.` },
];
export const ruleKind = (id) => RULE_KINDS.find(k => k.id === id);

function fmtShort(iso) {
  return iso ? parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '…';
}

/** Plain-English description of a rule, e.g. "Checked in at 20 Masses." */
export function describeRule(rule) {
  const kind = rule && ruleKind(rule.kind);
  return kind ? kind.describe({ ...rule, target: Number(rule.target) || 1 }) : '';
}

/** The parishioner's records, sorted once, for the built-in and admin-made badges. */
function badgeContext({ checkIns = [], donations = [], intentions = [], blessings = [], ministry = [] }, today) {
  const todayIso = isoDate(today);
  const ins = checkIns.filter(c => c.massDate && c.massDate <= todayIso)
    .sort((a, b) => (a.massDate + (a.checkedInAt || '')).localeCompare(b.massDate + (b.checkedInAt || '')));
  const sundays = [...new Set(ins.map(obligationSunday).filter(Boolean))].sort();
  const gifts = donations.filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
  const served = ministry.filter(s => s.massDate && s.massDate < todayIso).sort((a, b) => a.massDate.localeCompare(b.massDate));
  const offered = intentions.slice()
    .map(i => ({ ...i, on: i.massDate || String(i.createdAt || '').slice(0, 10) }))
    .sort((a, b) => String(a.on).localeCompare(String(b.on)));
  return { today, todayIso, ins, sundays, gifts, served, offered, blessings };
}

/** { earned, earnedOn?, progress } for one admin-made rule. */
function evaluateRule(rule, ctx) {
  const n = Math.max(1, Number(rule?.target) || 1);
  const nth = (arr, get) => (arr.length >= n ? get(arr[n - 1]) : undefined);
  const count = (arr, get, label) => ({
    earned: arr.length >= n, earnedOn: nth(arr, get),
    progress: { current: Math.min(arr.length, n), target: n, label },
  });
  switch (rule?.kind) {
    case 'masses': return count(ctx.ins, c => c.massDate, 'Masses');
    case 'masses-between': {
      const inRange = ctx.ins.filter(c => (!rule.from || c.massDate >= rule.from) && (!rule.to || c.massDate <= rule.to));
      return count(inRange, c => c.massDate, 'Masses');
    }
    case 'sunday-streak': {
      const best = longestSundayRun(ctx.sundays);
      return { earned: best >= n, progress: { current: Math.min(sundayStreak(ctx.sundays, ctx.today), n), target: n, label: 'weeks in a row' } };
    }
    case 'giving-months': {
      const dates = ctx.gifts.map(d => d.date);
      return { earned: longestMonthRun(dates) >= n, progress: { current: Math.min(monthStreak(dates, ctx.today), n), target: n, label: 'months in a row' } };
    }
    case 'giving-fund': {
      const want = String(rule.match || '').trim().toLowerCase();
      const toFund = want ? ctx.gifts.filter(d => String(d.purpose || '').toLowerCase().includes(want)) : [];
      return count(toFund, d => d.date, 'gifts');
    }
    case 'intentions': return count(ctx.offered, i => i.on, 'intentions');
    case 'service': {
      const served = rule.ministry ? ctx.served.filter(s => s.ministry === rule.ministry) : ctx.served;
      return count(served, s => s.massDate, 'times served');
    }
    default: return { earned: false };
  }
}

/* ------------------------------------------
   Working out one parishioner's badges
------------------------------------------ */

const PRE_BUILT = /BUILD|CONSTRUCT|RESTOR|RENOVAT|BELL|ROOF|ALTAR|CHAPEL/i;

/**
 * data: { checkIns, donations, intentions, blessings, ministry } — already
 * filtered to this parishioner. extra: { custom, awards } — the admin-made
 * badges (custom-badges.js fromRecord()) and this parishioner's hand-given
 * awards. Returns every badge with { earned, earnedOn?, progress?:
 * { current, target, label }, awardNote? }, earned ones first (newest first).
 */
export function computeBadges(data = {}, today = new Date(), { custom = [], awards = [] } = {}) {
  const ctx = badgeContext(data, today);
  const { todayIso, ins, gifts, blessings } = ctx;
  const { intentions = [] } = data;

  const out = {};
  const set = (id, earned, extra = {}) => { out[id] = { earned: !!earned, ...extra }; };
  const nth = (arr, n, get) => (arr.length >= n ? get(arr[n - 1]) : undefined);

  // --- Mass ---
  set('first-step', ins.length >= 1, { earnedOn: nth(ins, 1, c => c.massDate), progress: { current: Math.min(ins.length, 1), target: 1, label: 'Mass' } });

  const { sundays } = ctx;

  // Faithful Month: every Sunday of some fully-past month
  let fmEarnedOn;
  const byMonth = {};
  sundays.forEach(s => { (byMonth[monthKey(s)] = byMonth[monthKey(s)] || new Set()).add(s); });
  for (const mk of Object.keys(byMonth).sort()) {
    const [y, m] = mk.split('-').map(Number);
    const all = [];
    for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d = addDays(d, 1)) if (d.getDay() === 0) all.push(isoDate(d));
    if (all.every(s => s <= todayIso) && all.every(s => byMonth[mk].has(s))) { fmEarnedOn = all[all.length - 1]; break; }
  }
  const thisMonth = monthKey(todayIso);
  const sundaysThisMonth = [];
  for (let d = new Date(today.getFullYear(), today.getMonth(), 1); d.getMonth() === today.getMonth(); d = addDays(d, 1)) if (d.getDay() === 0) sundaysThisMonth.push(isoDate(d));
  set('faithful-month', !!fmEarnedOn, { earnedOn: fmEarnedOn,
    progress: { current: (byMonth[thisMonth] || new Set()).size, target: sundaysThisMonth.length, label: 'Sundays this month' } });

  const streakNow = sundayStreak(sundays, today);
  const bestRun = longestSundayRun(sundays);
  [['steadfast-1', 4], ['steadfast-2', 12], ['steadfast-3', 52]].forEach(([id, n]) => {
    set(id, bestRun >= n, { progress: { current: Math.min(streakNow, n), target: n, label: 'weeks in a row' } });
  });

  const early = ins.filter(c => { const mins = minutesOf(c.massTime); return mins !== null && mins < 7 * 60; });
  set('early-riser', early.length >= 5, { earnedOn: nth(early, 5, c => c.massDate), progress: { current: Math.min(early.length, 5), target: 5, label: 'early Masses' } });

  // Simbang Gabi: Dec 16–24 of one year, all nine days
  const sgByYear = {};
  ins.forEach(c => {
    const d = parseISO(c.massDate);
    if (d.getMonth() === 11 && d.getDate() >= 16 && d.getDate() <= 24) (sgByYear[d.getFullYear()] = sgByYear[d.getFullYear()] || new Set()).add(d.getDate());
  });
  const sgDone = Object.entries(sgByYear).find(([, s]) => s.size === 9);
  const sgYear = today.getMonth() === 11 || !sgByYear[today.getFullYear() - 1] ? today.getFullYear() : today.getFullYear() - 1;
  set('simbang-gabi', !!sgDone, { earnedOn: sgDone ? `${sgDone[0]}-12-24` : undefined,
    progress: { current: (sgByYear[sgYear] || new Set()).size, target: 9, label: `nights (${sgYear})` } });

  // Holy Week: Thu + Fri + (Sat Vigil or Easter Sunday), same year
  const dates = new Set(ins.map(c => c.massDate));
  let hwEarnedOn;
  const years = [...new Set(ins.map(c => +c.massDate.slice(0, 4)))];
  let hwProgress = 0;
  const hwCheck = (y) => {
    const easter = easterSunday(y);
    const thu = isoDate(addDays(easter, -3)), fri = isoDate(addDays(easter, -2));
    const vigil = isoDate(addDays(easter, -1)), sun = isoDate(easter);
    const parts = [dates.has(thu), dates.has(fri), dates.has(vigil) || dates.has(sun)];
    return { count: parts.filter(Boolean).length, done: parts.every(Boolean), on: sun };
  };
  for (const y of years.sort()) { const r = hwCheck(y); if (r.done && !hwEarnedOn) hwEarnedOn = r.on; }
  hwProgress = hwCheck(today.getFullYear()).count;
  set('holy-week', !!hwEarnedOn, { earnedOn: hwEarnedOn, progress: { current: hwProgress, target: 3, label: 'Triduum days this year' } });

  [['masses-10', 10], ['masses-50', 50], ['masses-100', 100]].forEach(([id, n]) => {
    set(id, ins.length >= n, { earnedOn: nth(ins, n, c => c.massDate), progress: { current: Math.min(ins.length, n), target: n, label: 'Masses' } });
  });

  // --- Giving ---
  set('first-offering', gifts.length >= 1, { earnedOn: nth(gifts, 1, d => d.date), progress: { current: Math.min(gifts.length, 1), target: 1, label: 'offering' } });
  const giftDates = gifts.map(d => d.date);
  const mStreak = monthStreak(giftDates, today);
  const mBest = longestMonthRun(giftDates);
  [['faithful-giver-3', 3], ['faithful-giver-6', 6], ['faithful-giver-12', 12]].forEach(([id, n]) => {
    set(id, mBest >= n, { progress: { current: Math.min(mStreak, n), target: n, label: 'months in a row' } });
  });
  const builder = gifts.find(d => /building fund/i.test(d.purpose || '') || (PRE_BUILT.test(d.purpose || '') && !/poor|youth|sunday/i.test(d.purpose || '')));
  set('parish-builder', !!builder, { earnedOn: builder?.date });
  const poor = gifts.find(d => /poor/i.test(d.purpose || ''));
  set('heart-for-poor', !!poor, { earnedOn: poor?.date });
  const intent = intentions.slice().sort((a, b) => String(a.massDate || a.createdAt).localeCompare(String(b.massDate || b.createdAt)))[0];
  set('intention', !!intent, { earnedOn: intent ? (intent.massDate || String(intent.createdAt || '').slice(0, 10)) : undefined });

  // --- Community ---
  const blessed = blessings.find(b => /bless/i.test(b.type || '') && (b.status === 'completed' || (b.status === 'scheduled' && b.date && b.date < todayIso)));
  set('blessed-home', !!blessed, { earnedOn: blessed?.date });

  // Ministry sign-ups (../ministry.js) for Masses that have already happened
  const { served } = ctx;
  set('faithful-servant', served.length >= 4, { earnedOn: nth(served, 4, s => s.massDate), progress: { current: Math.min(served.length, 4), target: 4, label: 'times served' } });

  // --- Badges the admin made: earned by their rule, or given by hand ---
  const awardOf = new Map(awards.map(a => [a.badgeId, a]));
  const extra = custom.map(b => {
    const byRule = b.mode === 'auto' ? evaluateRule(b.rule, ctx) : { earned: false };
    const award = awardOf.get(b.recordId);
    if (byRule.earned || !award) return { ...b, ...byRule };
    return { ...b, earned: true, earnedOn: award.awardedOn || String(award.createdAt || '').slice(0, 10), awardNote: award.note || '' };
  });

  return [...BADGES.map(b => ({ ...b, ...out[b.id] })), ...extra]
    .sort((a, b) => (b.earned - a.earned) ||
      (a.earned ? String(b.earnedOn || '').localeCompare(String(a.earnedOn || '')) : 0) ||
      (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]));
}

/* ------------------------------------------
   Faithful Givers (public honor roll)
------------------------------------------ */

/**
 * People who have given something at least `minMonths` months in a row
 * (ending this month or last). Anonymous gifts never count toward the
 * public list, anyone who opted out (showOnHonorRoll === false) is left
 * off, and amounts are never used — only which months someone gave in.
 * Returns [{ name, key, streak }], longest streak first, then by name.
 */
export function faithfulGivers(donations, { optedOut = new Set(), minMonths = 3, today = new Date() } = {}) {
  const byDonor = new Map();
  for (const d of donations) {
    if (d.anonymous || !d.donor || !d.date) continue;
    const key = parishionerKey(d.donor);
    if (optedOut.has(key)) continue;
    if (!byDonor.has(key)) byDonor.set(key, { name: d.donor.trim(), dates: [] });
    byDonor.get(key).dates.push(d.date);
  }
  return [...byDonor.entries()]
    .map(([key, v]) => ({ key, name: v.name, streak: monthStreak(v.dates, today) }))
    .filter(g => g.streak >= minMonths)
    .sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
}

export const streakLabel = (n) => (n >= 12 ? `${Math.floor(n / 12)} year${n >= 24 ? 's' : ''}${n % 12 ? ` ${n % 12} mo` : ''} of faithful giving` : `${n} months in a row`);
