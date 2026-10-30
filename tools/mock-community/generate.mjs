#!/usr/bin/env node
/* ============================================
   Mock community generator
   Builds a whole fake parish community: family trees,
   households, sacramental registers, certificate
   requests, and test cases for record auto-fill.

     node tools/mock-community/generate.mjs
     node tools/mock-community/generate.mjs --seed 7 --scale 2 --out some/folder

   The same seed always produces the same people.
   Output is local JSON only: nothing here writes to the
   database. See mock-data/README.md for the file guide.

   Two stages:
     1. simulate()  runs year by year from 1925, so every
        marriage, birth, death and move-in happens in order.
     2. buildRegisters() reads that history and writes the
        parish registers. The parish began in 1974, so older
        events correctly have no record here.
   ============================================ */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SURNAMES_COMMON, SURNAMES_OTHER, GIVEN_NAMES, COMPOUND, SAINT_NAMES, BARANGAYS, STREETS,
  PRIESTS, BISHOPS, CATECHISTS, OTHER_PARISHES, HOSPITALS, BURIAL_PLACES,
} from './names.mjs';
import { buildIndex, findRecords, nameKey, weddingCheck } from './lookup.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const SEED = Number(flag('seed', 20261030));
const SCALE = Number(flag('scale', 1));
const OUT = resolve(ROOT, flag('out', 'mock-data'));

const TODAY = '2026-10-30';
const REGISTER_START = 1974; // the homepage gives the parish's founding year
const PARISH = 'Our Lady of Fatima Parish';
const MOCK_EMAIL_DOMAIN = 'mock-sacradigit.test'; // .test can never reach a real inbox
const EMPTY_NAME = { firstName: '', middleName: '', lastName: '', extension: '' };

/* The app's source files are ES modules in a CommonJS package, so load them as data: URLs. */
const loadAppModule = (file) => import(`data:text/javascript;base64,${readFileSync(resolve(ROOT, file)).toString('base64')}`);
const { PH_REGIONS } = await loadAppModule('shared/js/ph-locations.js');
const { formatFullName } = await loadAppModule('shared/js/name-utils.js');

/* ---------- seeded randomness ---------- */

let rngState = SEED >>> 0;
function rand() { // mulberry32
  rngState = (rngState + 0x6D2B79F5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p) => rand() < p;
const pick = (list) => list[Math.floor(rand() * list.length)];
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---------- dates (plain ISO strings, compared as text) ---------- */

const toISO = (d) => d.toISOString().slice(0, 10);
const minDateOf = (a, b) => (a < b ? a : b);
const asDate = (iso) => new Date(`${iso}T00:00:00Z`);
const yearOf = (iso) => Number(iso.slice(0, 4));
const addDays = (iso, n) => toISO(new Date(asDate(iso).getTime() + n * 86400000));
const addYears = (iso, n) => {
  const d = asDate(iso);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return toISO(d);
};
const dateInYear = (y) => minDateOf(addDays(`${y}-01-01`, int(0, 364)), TODAY);
const minDate = (...dates) => dates.filter(Boolean).sort()[0] || null;
const maxDate = (...dates) => dates.filter(Boolean).sort().at(-1) || null;
function ageOn(birth, on) {
  const years = yearOf(on) - yearOf(birth);
  return on.slice(5) >= birth.slice(5) ? years : years - 1;
}
/** First date on or after `iso` falling on weekday `dow` (0 = Sunday). */
function onOrAfterWeekday(iso, dow) {
  return addDays(iso, (dow - asDate(iso).getUTCDay() + 7) % 7);
}
const nthWeekday = (year, month, dow, nth) =>
  addDays(onOrAfterWeekday(`${year}-${String(month).padStart(2, '0')}-01`, dow), (nth - 1) * 7);

/* ---------- people ---------- */

const persons = [];
const byId = new Map();
const unions = [];
const unionById = new Map();
const seekAt = new Map();      // year -> person ids looking for a spouse
const birthAt = new Map();     // year -> union ids expecting a child
const loneBirthAt = new Map(); // year -> women who have a child outside a union
const fixedPartner = new Map();// mother id -> father id who later marries her
const adoptAt = new Map();     // year -> union ids adopting a child
const queue = (map, year, value) => { if (!map.has(year)) map.set(year, []); map.get(year).push(value); };
const personOf = (id) => byId.get(id);

function surname() { return chance(0.35) ? pick(SURNAMES_COMMON) : pick(SURNAMES_OTHER); }

function givenName(sex, birthYear) {
  const era = GIVEN_NAMES.find(e => birthYear <= e.until);
  const key = sex === 'M' ? 'male' : 'female';
  const compound = birthYear >= 1950 ? 0.14 : 0.05;
  if (chance(compound)) return `${pick(COMPOUND[key].heads)} ${pick(COMPOUND[key].tails)}`;
  return pick(era[key]);
}

function birthPlace(local) {
  const region = local || chance(0.25) ? PH_REGIONS[0] : pick(PH_REGIONS);
  const city = local && chance(0.85) ? 'Quezon City' : pick(region.cities);
  return { region: region.name, city };
}

function sampleDeath(birthDate) {
  const y = yearOf(birthDate);
  const infantRisk = y < 1950 ? 0.07 : y < 1980 ? 0.03 : 0.008;
  if (chance(infantRisk)) {
    const early = addDays(birthDate, int(20, 900));
    return early > TODAY ? null : early;
  }
  const lifespan = Math.max(19, Math.min(103, 75 + gauss() * 11));
  const date = addDays(birthDate, Math.round(lifespan * 365.25));
  return date > TODAY ? null : date;
}

function addPerson({ sex, birthDate, first, middle = '', last, ext = '', fatherId = null, motherId = null, origin, residentFrom = null, place }) {
  const name = { firstName: first, middleName: middle, lastName: last, extension: ext };
  const p = {
    id: `P${String(persons.length + 1).padStart(5, '0')}`,
    isMock: true,
    sex,
    birthName: { ...name },
    currentName: { ...name },
    nameHistory: [{ name: { ...name }, from: birthDate, reason: 'birth' }],
    birthDate,
    birthPlace: place || null,
    deathDate: birthDate ? sampleDeath(birthDate) : null,
    fatherId,
    motherId,
    biologicalFatherId: null,
    biologicalMotherId: null,
    origin,
    residentFrom,
    residentUntil: null,
    unionIds: [],
    baptizedElsewhere: null,
    confirmedElsewhere: null,
  };
  persons.push(p);
  byId.set(p.id, p);
  return p;
}

function rename(p, date, changes, reason) {
  const name = { ...p.currentName, ...changes };
  p.nameHistory.push({ name: { ...name }, from: date, reason });
  p.currentName = name;
}

/** The name a person legally carried on a date. */
function nameAt(p, date) {
  let current = p.birthName;
  for (const entry of p.nameHistory) if (entry.from <= date) current = entry.name;
  return current;
}

const aliveOn = (p, date) => p.birthDate && p.birthDate <= date && (!p.deathDate || p.deathDate >= date);
const residentOn = (p, date) => !!p.residentFrom && p.residentFrom <= date && (!p.residentUntil || p.residentUntil > date);

/** Parent records that exist only so a certificate can name them; their dates are unknown. */
function addParentStubs(p) {
  const father = addPerson({ sex: 'M', birthDate: null, first: givenName('M', 1910), middle: surname(), last: p.birthName.lastName, origin: 'parent-record-only' });
  const mother = addPerson({ sex: 'F', birthDate: null, first: givenName('F', 1912), middle: surname(), last: p.birthName.middleName || surname(), origin: 'parent-record-only' });
  p.fatherId = father.id;
  p.motherId = mother.id;
}

function addOutsider({ sex, birthDate, origin, residentFrom = null, stubParents = true }) {
  const y = yearOf(birthDate);
  const p = addPerson({ sex, birthDate, first: givenName(sex, y), middle: surname(), last: surname(), origin, residentFrom, place: birthPlace(false) });
  if (p.deathDate && p.deathDate < addYears(birthDate, 60)) { // keep outsiders from dying before they arrive
    const later = addYears(birthDate, int(60, 85));
    p.deathDate = later > TODAY ? null : later;
  }
  if (stubParents) addParentStubs(p);
  return p;
}

/* ---------- relationships ---------- */

function ancestors(p, depth = 3, out = new Set()) {
  out.add(p.id);
  if (depth === 0) return out;
  for (const id of [p.fatherId, p.motherId, p.biologicalFatherId, p.biologicalMotherId]) {
    if (id) ancestors(personOf(id), depth - 1, out);
  }
  return out;
}
function related(a, b) {
  const seen = ancestors(a);
  for (const id of ancestors(b)) if (seen.has(id)) return true;
  return false;
}
/** No current spouse on this date. */
function isFree(p, date) {
  return p.unionIds.every(id => {
    const u = unionById.get(id);
    return u.endDate && u.endDate < date;
  });
}

/* ---------- life plans ---------- */

function planLife(p) {
  const y = yearOf(p.birthDate);
  if (chance(0.88)) queue(seekAt, y + (p.sex === 'M' ? int(23, 36) : int(21, 33)), p.id);
  if (p.sex === 'F' && chance(0.045)) queue(loneBirthAt, y + int(18, 30), p.id);
}

function childCount(y) {
  if (y < 1960) return int(3, 9);
  if (y < 1985) return int(2, 6);
  return int(0, 4);
}

/* ---------- unions (church, civil, live-in) ---------- */

function makeUnion(h, w, date, opts = {}) {
  const y = yearOf(date);
  const kind = opts.kind || (y < 1980 ? (chance(0.97) ? 'church' : 'civil')
    : (() => { const r = rand(); return r < 0.8 ? 'church' : r < 0.91 ? 'civil' : 'live-in'; })());
  const u = {
    id: `U${String(unions.length + 1).padStart(5, '0')}`,
    husbandId: h.id,
    wifeId: w.id,
    kind,
    startDate: date,
    marriageRecordId: null,
    weddingDate: kind === 'live-in' ? null : date,
    weddingPlace: null,
    convalidatedOn: null,
    endDate: null,
    endReason: null,
    residency: 'parish',
    childrenIds: [],
  };
  unions.push(u);
  unionById.set(u.id, u);
  h.unionIds.push(u.id);
  w.unionIds.push(u.id);

  // Where the couple lives from now on.
  const hr = residentOn(h, date);
  const wr = residentOn(w, date);
  if (hr !== wr && !opts.settled && chance(0.2)) {
    (hr ? h : w).residentUntil = date;
    u.residency = chance(0.3) ? 'abroad' : 'moved-away';
  } else if (hr !== wr) {
    const outsider = hr ? w : h;
    outsider.residentFrom = date;
    outsider.residentUntil = null;
  } else if (!hr && !opts.settled) {
    u.residency = 'moved-away';
  }

  // A church wedding is usually here once the parish exists and someone is local.
  if (kind === 'church') {
    const here = y >= REGISTER_START && !opts.elsewhere && chance(hr && wr ? 0.92 : hr || wr ? 0.55 : 0);
    u.weddingPlace = here ? PARISH : `${pick(OTHER_PARISHES)}, ${pick(pick(PH_REGIONS).cities)}`;
  } else if (kind === 'civil') {
    u.weddingPlace = 'Quezon City Hall (civil ceremony)';
  }

  if (kind !== 'live-in') rename(w, date, { middleName: w.birthName.lastName, lastName: h.currentName.lastName }, 'marriage');

  // Civil and live-in couples sometimes marry in church later.
  if (kind !== 'church' && chance(0.25)) {
    const on = onOrAfterWeekday(addYears(date, int(3, 12)), 6);
    if (on <= TODAY && (!h.deathDate || h.deathDate > on) && (!w.deathDate || w.deathDate > on)) {
      u.convalidatedOn = on;
      u.weddingDate = on;
      u.weddingPlace = residentOn(h, on) && chance(0.8) ? PARISH : `${pick(OTHER_PARISHES)}, Quezon City`;
      if (kind === 'live-in') rename(w, on, { middleName: w.birthName.lastName, lastName: h.currentName.lastName }, 'marriage');
    }
  }

  // How it ends.
  const firstDeath = minDate(h.deathDate, w.deathDate);
  if (kind === 'church' && y >= 1985 && chance(0.025)) {
    const on = addYears(date, int(6, 15));
    if (on <= TODAY && (!firstDeath || on < firstDeath)) {
      u.endDate = on;
      u.endReason = 'declaration-of-nullity';
      if (chance(0.6)) rename(w, on, { middleName: w.birthName.middleName, lastName: w.birthName.lastName }, 'nullity');
      for (const p of [h, w]) if (chance(0.5)) queue(seekAt, yearOf(on) + int(1, 3), p.id);
    }
  } else if (kind === 'live-in' && !u.convalidatedOn && chance(0.25)) {
    const on = addYears(date, int(2, 9));
    if (on <= TODAY && (!firstDeath || on < firstDeath)) {
      u.endDate = on;
      u.endReason = 'separated';
      for (const p of [h, w]) if (chance(0.35)) queue(seekAt, yearOf(on) + int(1, 4), p.id);
    }
  }
  if (!u.endDate && firstDeath) {
    u.endDate = firstDeath;
    u.endReason = firstDeath === h.deathDate ? 'death-of-husband' : 'death-of-wife';
    const survivor = firstDeath === h.deathDate ? w : h;
    if (ageOn(survivor.birthDate, firstDeath) < 58 && chance(0.3)) queue(seekAt, yearOf(firstDeath) + int(1, 4), survivor.id);
  }

  // Children to come.
  const count = childCount(y);
  let year = y + (kind === 'live-in' ? 0 : 1);
  u.birthYears = [];
  for (let i = 0; i < count; i += 1) {
    u.birthYears.push(year);
    year += int(1, 3);
  }
  if (!opts.pastBirths) u.birthYears.forEach(by => queue(birthAt, by, u.id));
  if (!count && y >= 1975 && chance(0.15)) queue(adoptAt, y + int(3, 8), u.id);

  // A child born before this marriage takes the father's name once the parents marry.
  if (opts.legitimate) {
    for (const child of persons.filter(p => p.motherId === w.id && p.fatherId === h.id && p.currentName.lastName !== h.currentName.lastName)) {
      rename(child, date, { middleName: w.birthName.lastName, lastName: h.currentName.lastName }, 'legitimation');
      u.childrenIds.push(child.id);
    }
  }
  return u;
}

function addChild(u, date) {
  const father = personOf(u.husbandId);
  const mother = personOf(u.wifeId);
  const married = u.kind !== 'live-in' || (u.convalidatedOn && u.convalidatedOn <= date);
  const usesFatherName = married || chance(0.7);
  const sex = chance(0.51) ? 'M' : 'F';
  const parentsLocal = residentOn(mother, date) || residentOn(father, date);

  const taken = new Set(u.childrenIds.map(id => personOf(id).birthName.firstName)); // brothers and sisters never share a name
  let first = givenName(sex, yearOf(date));
  while (taken.has(first)) first = givenName(sex, yearOf(date));
  let ext = '';
  if (sex === 'M' && married && !u.hasJunior && chance(0.1)) {
    const next = { '': 'Jr.', 'Jr.': 'III', III: 'IV' }[father.currentName.extension];
    if (next) {
      first = father.currentName.firstName;
      ext = next;
      u.hasJunior = true;
    }
  }
  const child = addPerson({
    sex,
    birthDate: date,
    first,
    middle: usesFatherName ? mother.birthName.lastName : '',
    last: usesFatherName ? father.currentName.lastName : mother.birthName.lastName,
    ext,
    fatherId: father.id,
    motherId: mother.id,
    origin: parentsLocal ? 'born-in-parish' : 'born-away',
    residentFrom: parentsLocal ? date : null,
    place: birthPlace(parentsLocal),
  });
  u.childrenIds.push(child.id);
  if (parentsLocal) planLife(child);
  return child;
}

function processBirth(u, y) {
  const father = personOf(u.husbandId);
  const mother = personOf(u.wifeId);
  const lowest = u.kind === 'live-in' ? u.startDate : addDays(u.startDate, 285);
  const date = maxDate(dateInYear(y), lowest);
  if (date > TODAY || (u.endDate && date > addDays(u.endDate, 250))) return;
  if (!aliveOn(mother, date)) return;
  if (father.deathDate && date > addDays(father.deathDate, 250)) return;
  const age = ageOn(mother.birthDate, date);
  if (age < 18 || age > 46) return;
  const first = addChild(u, date);
  if (chance(0.013)) { // twins: same birthday, same parents, different people
    const twin = addChild(u, date);
    twin.twinOf = first.id;
    first.twinOf = twin.id;
  }
}

function processLoneBirth(w, y) {
  const date = dateInYear(y);
  if (date > TODAY || !aliveOn(w, date) || w.unionIds.length) return;
  let fatherId = null;
  const fatherNamed = chance(0.6);
  if (fatherNamed) fatherId = addOutsider({ sex: 'M', birthDate: addYears(date, -int(20, 32)), origin: 'partner-from-outside' }).id;
  const child = addPerson({
    sex: chance(0.51) ? 'M' : 'F',
    birthDate: date,
    first: '',
    last: w.birthName.lastName,
    fatherId,
    motherId: w.id,
    origin: 'born-in-parish',
    residentFrom: residentOn(w, date) ? date : null,
    place: birthPlace(true),
  });
  const given = givenName(child.sex, y);
  child.birthName.firstName = given;
  child.currentName.firstName = given;
  child.nameHistory[0].name.firstName = given;
  if (child.residentFrom) planLife(child);
  if (fatherNamed && chance(0.45)) {
    fixedPartner.set(w.id, fatherId);
    queue(seekAt, y + int(1, 3), w.id);
  }
}

function processAdoption(u, y) {
  const date = dateInYear(y);
  const father = personOf(u.husbandId);
  const mother = personOf(u.wifeId);
  if (date > TODAY || (u.endDate && u.endDate < date) || !residentOn(mother, date)) return;
  const bornOn = addDays(date, -int(30, 900));
  const birthFather = addPerson({ sex: 'M', birthDate: null, first: givenName('M', y - 25), middle: surname(), last: surname(), origin: 'parent-record-only' });
  const birthMother = addPerson({ sex: 'F', birthDate: null, first: givenName('F', y - 22), middle: surname(), last: surname(), origin: 'parent-record-only' });
  const sex = chance(0.5) ? 'M' : 'F';
  const child = addPerson({
    sex,
    birthDate: bornOn,
    first: givenName(sex, yearOf(bornOn)),
    middle: birthMother.birthName.lastName,
    last: birthFather.birthName.lastName,
    fatherId: father.id,
    motherId: mother.id,
    origin: 'adopted',
    residentFrom: date,
    place: birthPlace(false),
  });
  child.biologicalFatherId = birthFather.id;
  child.biologicalMotherId = birthMother.id;
  child.adoptedOn = date;
  rename(child, date, { middleName: mother.birthName.lastName, lastName: father.currentName.lastName }, 'adoption');
  u.childrenIds.push(child.id);
  planLife(child);
}

/* ---------- year-by-year simulation ---------- */

function addFounderCouple(year) {
  const marriedOn = dateInYear(year);
  const h = addOutsider({ sex: 'M', birthDate: dateInYear(year - int(23, 33)), origin: 'founding-family', residentFrom: marriedOn });
  const w = addOutsider({ sex: 'F', birthDate: dateInYear(year - int(20, 29)), origin: 'founding-family', residentFrom: marriedOn });
  makeUnion(h, w, marriedOn, { kind: 'church', settled: true, elsewhere: true });
}

function addArrivingFamily(year) {
  const arrived = dateInYear(year);
  const marriedOn = dateInYear(year - int(1, 9));
  const h = addOutsider({ sex: 'M', birthDate: dateInYear(yearOf(marriedOn) - int(23, 33)), origin: 'moved-in', residentFrom: arrived });
  const w = addOutsider({ sex: 'F', birthDate: dateInYear(yearOf(marriedOn) - int(21, 29)), origin: 'moved-in', residentFrom: arrived });
  const u = makeUnion(h, w, marriedOn, { kind: 'church', settled: true, elsewhere: true, pastBirths: true });
  for (const by of u.birthYears) {
    if (by > year) { queue(birthAt, by, u.id); continue; }
    const before = u.childrenIds.length;
    processBirth(u, by);
    for (const id of u.childrenIds.slice(before)) {
      const child = personOf(id);
      if (child.birthDate >= arrived) continue;
      child.origin = 'moved-in';
      child.residentFrom = arrived;
      planLife(child);
    }
  }
}

function matchSeekers(pool, y, date) {
  const open = pool.filter(p => aliveOn(p, date) && isFree(p, date) && ageOn(p.birthDate, date) >= 18);

  for (const p of open.filter(s => fixedPartner.has(s.id))) {
    const partner = personOf(fixedPartner.get(p.id));
    if (aliveOn(partner, date) && isFree(partner, date)) makeUnion(partner, p, date, { kind: 'church', legitimate: true });
    fixedPartner.delete(p.id);
  }

  const men = shuffled(open.filter(p => p.sex === 'M'));
  const women = shuffled(open.filter(p => p.sex === 'F'));
  for (const m of men) {
    if (!isFree(m, date)) continue;
    const match = women.find(w => {
      if (!isFree(w, date)) return false;
      const gap = ageOn(m.birthDate, date) - ageOn(w.birthDate, date);
      return gap >= -3 && gap <= 12 && !related(m, w);
    });
    if (match && chance(0.6)) { makeUnion(m, match, date); continue; }
    const age = ageOn(m.birthDate, date);
    makeUnion(m, addOutsider({ sex: 'F', birthDate: dateInYear(y - Math.max(19, age - int(0, 7))), origin: 'spouse-from-outside' }), date);
  }
  for (const w of women) {
    if (!isFree(w, date)) continue;
    const age = ageOn(w.birthDate, date);
    makeUnion(addOutsider({ sex: 'M', birthDate: dateInYear(y - Math.max(20, age + int(-1, 8))), origin: 'spouse-from-outside' }), w, date);
  }
}

function simulate() {
  const foundersByYear = new Map();
  const founderCount = Math.round(320 * SCALE);
  for (let i = 0; i < founderCount; i += 1) {
    const y = 1925 + Math.floor(47 * Math.sqrt(rand())); // more families as the area fills up
    foundersByYear.set(y, (foundersByYear.get(y) || 0) + 1);
  }

  for (let y = 1925; y <= 2026; y += 1) {
    for (let i = 0; i < (foundersByYear.get(y) || 0); i += 1) addFounderCouple(y);
    if (y >= 1975 && y <= 2024) {
      const arrivals = Math.round(int(3, 8) * SCALE);
      for (let i = 0; i < arrivals; i += 1) addArrivingFamily(y);
    }
    (loneBirthAt.get(y) || []).forEach(id => processLoneBirth(personOf(id), y));
    (adoptAt.get(y) || []).forEach(id => processAdoption(unionById.get(id), y));
    const seekers = [...new Set(seekAt.get(y) || [])].map(personOf);
    matchSeekers(seekers, y, dateInYear(y));
    (birthAt.get(y) || []).forEach(id => processBirth(unionById.get(id), y));
  }
}

/* ---------- parish registers ---------- */

const registers = { baptisms: [], confirmations: [], firstCommunions: [], marriages: [], deaths: [] };
const ID_PREFIX = { baptisms: 'BAP', confirmations: 'CON', firstCommunions: 'FCM', marriages: 'MAR', deaths: 'DTH' };
const RECORD_TYPE = { baptisms: 'baptism', confirmations: 'confirmation', firstCommunions: 'first-communion', marriages: 'marriage', deaths: 'death' };
const PRIMARY_NAMES = {
  baptisms: ['baptized-name'], confirmations: ['confirmed-name'], firstCommunions: ['fc-name'],
  marriages: ['groom-name', 'bride-name'], deaths: ['deceased-name'],
};
const ADDED_BY = ['Parish Office', 'Lydia Sacristan (Mock Secretary)', 'Noemi Registrar (Mock Secretary)'];

function clergy(list, date) {
  const y = yearOf(date);
  const serving = list.filter(c => c.from <= y && c.to >= y);
  return pick(serving.length ? serving : list).name;
}

const nameCopy = (n) => (n ? { firstName: n.firstName, middleName: n.middleName, lastName: n.lastName, extension: n.extension } : null);
const fatherNameAt = (p, date) => (p.fatherId ? nameCopy(nameAt(personOf(p.fatherId), date)) : null);
const motherMaiden = (p) => (p.motherId ? nameCopy(personOf(p.motherId).birthName) : null);

function isKnownFather(p, date) {
  // A child registered under the mother's surname has no father on the record.
  const father = p.fatherId ? personOf(p.fatherId) : null;
  return father && nameAt(p, date).lastName === nameAt(father, date).lastName;
}

const adultPool = [];
function pickSponsor(date, exclude, sex) {
  for (let tries = 0; tries < 60; tries += 1) {
    const p = pick(adultPool);
    if (exclude.has(p.id) || (sex && p.sex !== sex) || !aliveOn(p, date) || !residentOn(p, date)) continue;
    const age = ageOn(p.birthDate, date);
    if (age >= 21 && age <= 72) return p;
  }
  return addOutsider({ sex: sex || (chance(0.5) ? 'M' : 'F'), birthDate: addYears(date, -int(25, 55)), origin: 'sponsor-from-outside' });
}

const parentsOf = (p) => [p.fatherId, p.motherId].filter(Boolean).map(personOf);

/** Someone who presents the person when the parents can't: a grandparent, older sibling, aunt or uncle. */
function pickGuardian(p, date) {
  const options = [];
  for (const parent of parentsOf(p)) {
    for (const g of parentsOf(parent)) {
      if (aliveOn(g, date)) options.push({ person: g, relationship: g.sex === 'M' ? 'Grandfather' : 'Grandmother' });
    }
    if (parent.fatherId) {
      for (const sib of persons.filter(q => q.fatherId === parent.fatherId && q.id !== parent.id)) {
        if (aliveOn(sib, date) && ageOn(sib.birthDate, date) >= 21) options.push({ person: sib, relationship: sib.sex === 'M' ? 'Uncle' : 'Aunt' });
      }
    }
  }
  for (const sib of persons.filter(q => q.id !== p.id && q.motherId && q.motherId === p.motherId)) {
    if (aliveOn(sib, date) && ageOn(sib.birthDate, date) >= 21) options.push({ person: sib, relationship: sib.sex === 'M' ? 'Older Brother' : 'Older Sister' });
  }
  if (!options.length) return null;
  const chosen = pick(options);
  return { personId: chosen.person.id, detail: { relationship: chosen.relationship, name: nameCopy(nameAt(chosen.person, date)), birthdate: chosen.person.birthDate } };
}

function addRecord(register, personIds, date, details, officiant, extra = {}) {
  const record = {
    id: null,
    isMock: true,
    type: RECORD_TYPE[register],
    personIds,
    date,
    details,
    officiant,
    register: null,
    status: 'digitized',
    addedByName: pick(ADDED_BY),
    fileURL: null,
    annotations: [],
    dataQuality: { variants: [], blanked: [], canonicalNames: {} },
    duplicateOf: null,
    ...extra,
  };
  for (const key of PRIMARY_NAMES[register]) record.dataQuality.canonicalNames[key] = nameCopy(details[key]);
  registers[register].push(record);
  return record;
}

function baptismDateFor(p) {
  const r = rand();
  if (r < 0.04) return onOrAfterWeekday(addDays(p.birthDate, int(3, 12) * 365), 0); // baptized late
  return onOrAfterWeekday(addDays(p.birthDate, int(14, 320)), chance(0.7) ? 0 : 6);
}

function addBaptism(p, date, { adult = false } = {}) {
  const exclude = new Set([p.id, p.fatherId, p.motherId]);
  const parentsAway = !adult && parentsOf(p).length && (chance(0.02) || parentsOf(p).every(q => !aliveOn(q, date)));
  const guardian = parentsAway ? pickGuardian(p, date) : null;
  if (guardian) exclude.add(guardian.personId);
  const sponsorIds = [pickSponsor(date, exclude, 'M')];
  exclude.add(sponsorIds[0].id);
  sponsorIds.push(pickSponsor(date, exclude, 'F'));
  exclude.add(sponsorIds[1].id);
  const extra = [];
  for (let i = 0, n = chance(0.55) ? int(1, 6) : 0; i < n; i += 1) {
    const q = pickSponsor(date, exclude);
    exclude.add(q.id);
    sponsorIds.push(q);
    extra.push({ name: nameCopy(nameAt(q, date)), role: q.sex === 'M' ? 'Godfather' : 'Godmother' });
  }
  const details = {
    'baptized-name': nameCopy(nameAt(p, date)),
    'birth-date': p.birthDate,
    'birth-region': p.birthPlace.region,
    'birth-city': p.birthPlace.city,
    birthplace: `${p.birthPlace.city}, ${p.birthPlace.region}`,
    'baptism-date': date,
    guardian: guardian ? guardian.detail : null,
    'father-name': guardian ? null : isKnownFather(p, date) ? fatherNameAt(p, date) : null,
    'mother-name': guardian ? null : motherMaiden(p),
    'sponsor-1': nameCopy(nameAt(sponsorIds[0], date)),
    'sponsor-2': nameCopy(nameAt(sponsorIds[1], date)),
    extraGodparents: extra,
  };
  return addRecord('baptisms', [p.id], date, details, clergy(PRIESTS, date), {
    sponsorIds: sponsorIds.map(q => q.id),
    guardianId: guardian?.personId || null,
    tags: [adult ? 'adult-baptism' : null, ageOn(p.birthDate, date) >= 3 && !adult ? 'late-baptism' : null, p.twinOf ? 'twin' : null,
      details['father-name'] ? null : 'no-father-on-record'].filter(Boolean),
  });
}

function buildSacraments() {
  const firstCommunionDay = (y) => nthWeekday(y, 12, 6, 1);
  const confirmationDay = (y) => nthWeekday(y, 8, 6, 2);

  for (const p of persons) {
    if (!p.birthDate) continue;
    const local = !!p.residentFrom;

    // Baptism: here if the family was in the parish and the register had begun.
    if (local) {
      const date = baptismDateFor(p);
      const baptizedHere = yearOf(date) >= REGISTER_START && residentOn(p, date) && aliveOn(p, date) && date <= TODAY && chance(0.93);
      if (baptizedHere) addBaptism(p, date);
      else if (aliveOn(p, date) && date <= TODAY) p.baptizedElsewhere = { date, church: `${pick(OTHER_PARISHES)}, ${p.birthPlace.city}` };
    } else if (p.birthDate && !p.baptizedElsewhere) {
      p.baptizedElsewhere = { date: minDate(onOrAfterWeekday(addDays(p.birthDate, int(14, 320)), 0), TODAY), church: `${pick(OTHER_PARISHES)}, ${p.birthPlace.city}` };
    }

    // First Communion and Confirmation come in yearly batches.
    if (!local) continue;
    const baptism = () => registers.baptisms.find(r => r.personIds[0] === p.id);
    const fcDay = firstCommunionDay(yearOf(p.birthDate) + int(8, 10));
    const baptizedBy = (day) => (baptism()?.date || p.baptizedElsewhere?.date || day) < day;
    if (yearOf(fcDay) >= REGISTER_START && residentOn(p, fcDay) && aliveOn(p, fcDay) && fcDay <= TODAY && baptizedBy(fcDay) && chance(0.82)) {
      addRecord('firstCommunions', [p.id], fcDay, {
        'fc-name': nameCopy(nameAt(p, fcDay)),
        'fc-communion-date': fcDay,
      }, clergy(PRIESTS, fcDay), { catechist: pick(CATECHISTS) });
    }

    const confDay = confirmationDay(yearOf(p.birthDate) + int(12, 16));
    if (yearOf(confDay) >= REGISTER_START && residentOn(p, confDay) && aliveOn(p, confDay) && confDay <= TODAY && chance(0.8)) {
      const known = baptism();
      const baptismDate = known?.date || p.baptizedElsewhere?.date || '';
      if (baptismDate && baptismDate < confDay) {
        const exclude = new Set([p.id, p.fatherId, p.motherId]);
        const guardian = parentsOf(p).length && (chance(0.02) || parentsOf(p).every(q => !aliveOn(q, confDay))) ? pickGuardian(p, confDay) : null;
        if (guardian) exclude.add(guardian.personId);
        const sponsor = pickSponsor(confDay, exclude, p.sex);
        addRecord('confirmations', [p.id], confDay, {
          'confirmed-name': nameCopy(nameAt(p, confDay)),
          'baptism-date': baptismDate,
          'baptism-church': known ? PARISH : p.baptizedElsewhere.church,
          'confirmation-name': pick(SAINT_NAMES[p.sex === 'M' ? 'male' : 'female']),
          'confirmation-date': confDay,
          guardian: guardian ? guardian.detail : null,
          'father-name': guardian ? null : isKnownFather(p, confDay) ? fatherNameAt(p, confDay) : null,
          'mother-name': guardian ? null : motherMaiden(p),
          'sponsor-name': nameCopy(nameAt(sponsor, confDay)),
        }, clergy(BISHOPS, confDay), { sponsorIds: [sponsor.id], guardianId: guardian?.personId || null, baptismRecordId: null });
      }
    }
  }

  // Unbaptized spouses from outside sometimes join the Church before the wedding.
  for (const u of unions) {
    const date = u.weddingDate;
    if (u.weddingPlace !== PARISH || !date) continue;
    const convert = personOf(u.wifeId).origin === 'spouse-from-outside' ? personOf(u.wifeId) : personOf(u.husbandId);
    if (convert.origin !== 'spouse-from-outside' || !chance(0.03)) continue;
    const baptismDay = onOrAfterWeekday(addDays(date, -int(30, 200)), 6);
    if (baptismDay > convert.birthDate && yearOf(baptismDay) >= REGISTER_START) {
      convert.baptizedElsewhere = null;
      addBaptism(convert, baptismDay, { adult: true });
    }
  }
}

function buildMarriages() {
  for (const u of unions) {
    if (u.weddingPlace !== PARISH) continue;
    const date = u.weddingDate;
    const h = personOf(u.husbandId);
    const w = personOf(u.wifeId);
    const saturday = onOrAfterWeekday(date, 6);
    const lastDay = minDate(h.deathDate, w.deathDate, TODAY);
    const day = saturday > lastDay ? date : saturday;
    u.weddingDate = day;
    const before = addDays(u.startDate, -1); // the register keeps the names they came to the altar with
    const exclude = new Set([h.id, w.id, h.fatherId, h.motherId, w.fatherId, w.motherId]);
    const ninong = pickSponsor(day, exclude, 'M');
    exclude.add(ninong.id);
    const ninang = pickSponsor(day, exclude, 'F');
    const r = addRecord('marriages', [h.id, w.id], day, {
      'groom-name': nameCopy(nameAt(h, before)),
      'groom-guardian': null,
      'groom-father': fatherNameAt(h, day),
      'groom-mother': motherMaiden(h),
      'bride-name': nameCopy(nameAt(w, before)),
      'bride-guardian': null,
      'bride-father': fatherNameAt(w, day),
      'bride-mother': motherMaiden(w),
      'witness-1': nameCopy(nameAt(ninong, day)),
      'witness-2': nameCopy(nameAt(ninang, day)),
      'marriage-date': day,
      'marriage-place': PARISH,
    }, clergy(PRIESTS, day), {
      unionId: u.id,
      sponsorIds: [ninong.id, ninang.id],
      tags: [u.convalidatedOn ? 'convalidation' : null].filter(Boolean),
    });
    if (u.endReason === 'declaration-of-nullity') {
      r.annotations.push({ kind: 'declaration-of-nullity', date: u.endDate, note: 'Marginal note: marriage declared null by the Metropolitan Tribunal (mock).' });
    }
    u.marriageRecordId = r;
  }
}

function buildDeaths() {
  for (const p of persons) {
    if (!p.deathDate || yearOf(p.deathDate) < REGISTER_START || !residentOn(p, addDays(p.deathDate, -1)) || !chance(0.86)) continue;
    const burial = addDays(p.deathDate, int(3, 8));
    if (burial > TODAY) continue;
    addRecord('deaths', [p.id], p.deathDate, {
      'deceased-name': nameCopy(nameAt(p, p.deathDate)),
      age: String(ageOn(p.birthDate, p.deathDate)),
      'death-date': p.deathDate,
      'place-of-death': chance(0.55) ? pick(HOSPITALS) : 'Residence, Quezon City',
      'burial-date': burial,
      'burial-place': pick(BURIAL_PLACES),
    }, clergy(PRIESTS, p.deathDate));
  }
}

/* The way old paper registers really differ from a clean name. */
const VARIANTS = {
  'ma-abbreviation': { applies: n => /^Maria\b/.test(n.firstName), edit: n => ({ ...n, firstName: n.firstName.replace(/^Maria/, 'Ma.') }) },
  'enye-dropped': { applies: n => /ñ/i.test(n.lastName), edit: n => ({ ...n, lastName: n.lastName.replace(/ñ/g, 'n').replace(/Ñ/g, 'N') }) },
  'particle-spacing': { applies: n => /^(Dela|Delos|De|Del) /.test(n.lastName), edit: n => ({ ...n, lastName: n.lastName.startsWith('Dela ') ? n.lastName.replace('Dela ', 'De la ') : n.lastName.replace(' ', '') }) },
  'all-caps': { applies: () => true, edit: n => Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v.toUpperCase()])) },
  'middle-initial-only': { applies: n => n.middleName.length > 1, edit: n => ({ ...n, middleName: `${n.middleName[0]}.` }) },
  'surname-typo': { applies: n => n.lastName.length >= 6 && !n.lastName.includes(' '), edit: n => ({ ...n, lastName: `${n.lastName.slice(0, 3)}${n.lastName[4]}${n.lastName[3]}${n.lastName.slice(5)}` }) },
  'extension-missing': { applies: n => !!n.extension, edit: n => ({ ...n, extension: '' }) },
  'second-given-name-dropped': { applies: n => n.firstName.includes(' '), edit: n => ({ ...n, firstName: n.firstName.split(' ')[0] }) },
};

const BLANKABLE = {
  baptisms: ['sponsor-2', 'birthplace'],
  confirmations: ['sponsor-name'],
  marriages: ['witness-2', 'groom-mother'],
  deaths: ['burial-place'],
  firstCommunions: [],
};

function addDataQuirks(register, r) {
  const key = pick(PRIMARY_NAMES[register]);
  if (yearOf(r.date) < 2005 && chance(0.11)) {
    const usable = Object.entries(VARIANTS).filter(([, v]) => v.applies(r.details[key]));
    if (usable.length) {
      const [variantName, variant] = pick(usable);
      r.details[key] = variant.edit(r.details[key]);
      r.dataQuality.variants.push({ field: key, kind: variantName });
    }
  }
  if (yearOf(r.date) < 2000 && chance(0.05) && BLANKABLE[register].length) {
    const field = pick(BLANKABLE[register]);
    r.details[field] = typeof r.details[field] === 'string' ? '' : (field === 'groom-mother' ? null : { ...EMPTY_NAME });
    if (field === 'birthplace') { r.details['birth-region'] = ''; r.details['birth-city'] = ''; }
    r.dataQuality.blanked.push(field);
  }
  if (yearOf(r.date) < 1990 && chance(0.03)) {
    r.officiant = null;
    r.dataQuality.blanked.push('officiant');
  }
  const y = yearOf(r.date);
  if (y < 1990) {
    const roll = rand();
    r.status = roll < 0.22 ? 'queued' : roll < 0.32 ? 'processing' : 'digitized';
  }
}

function finishRegister(register) {
  const list = registers[register];
  list.forEach(r => addDataQuirks(register, r));

  // A small share of entries were encoded twice; duplicates must be flagged, never merged silently.
  const copies = [];
  for (const r of list) {
    if (r.status !== 'digitized' || yearOf(r.date) >= 2010 || !chance(0.008)) continue;
    const copy = structuredClone(r);
    copy.duplicateOf = r;
    copy.addedByName = pick(ADDED_BY);
    copies.push(copy);
  }
  list.push(...copies);

  list.sort((a, b) => (a.date === b.date ? (a.personIds[0] < b.personIds[0] ? -1 : 1) : a.date < b.date ? -1 : 1));
  const linesPerPage = register === 'marriages' ? 5 : 10;
  const pagesPerBook = 200;
  list.forEach((r, i) => {
    r.id = `${ID_PREFIX[register]}-${String(i + 1).padStart(5, '0')}`;
    const page = Math.floor(i / linesPerPage);
    r.register = {
      bookNo: String(Math.floor(page / pagesPerBook) + 1),
      page: String((page % pagesPerBook) + 1),
      line: String((i % linesPerPage) + 1),
    };
    if (r.status === 'digitized') r.fileURL = `mock/records/${r.type}/${r.id}.png`;
  });
  list.forEach(r => { if (r.duplicateOf) r.duplicateOf = r.duplicateOf.id; });

  for (const r of list) {
    const names = PRIMARY_NAMES[register].map(k => formatFullName(r.details[k]));
    // `parishRecord` is the exact row for the ParishRecord table. Like the app, First Communion
    // leaves type unset because the deployed enum has no value for it.
    r.parishRecord = {
      type: r.type === 'first-communion' ? null : r.type,
      fullName: names.join(' & '),
      dateOfEvent: r.duplicateOf && chance(0.3) ? null : r.date,
      officiant: r.officiant,
      status: r.status,
      fileURL: r.fileURL,
      addedByName: r.addedByName,
    };
  }
}

function buildRegisters() {
  adultPool.push(...persons.filter(p => p.birthDate && p.residentFrom));
  buildSacraments();
  buildMarriages();
  buildDeaths();
  Object.keys(registers).forEach(finishRegister);
  for (const u of unions) if (u.marriageRecordId) u.marriageRecordId = u.marriageRecordId.id;
  const baptismOf = new Map(registers.baptisms.filter(r => !r.duplicateOf).map(r => [r.personIds[0], r.id]));
  for (const r of registers.confirmations) r.baptismRecordId = baptismOf.get(r.personIds[0]) || null;
}

/* ---------- final state of each person ---------- */

function finalizePersons() {
  for (const p of persons) {
    p.alive = p.birthDate ? !p.deathDate : null;
    if (!p.birthDate) { p.civilStatus = 'unknown'; continue; }
    const list = p.unionIds.map(id => unionById.get(id));
    const open = list.find(u => !u.endDate);
    const last = list.at(-1);
    p.civilStatus = open ? (open.kind === 'live-in' && !open.convalidatedOn ? 'live-in' : 'married')
      : !last ? (ageOn(p.birthDate, p.deathDate || TODAY) < 18 ? 'minor' : 'single')
        : last.endReason === 'declaration-of-nullity' ? 'annulled'
          : last.endReason === 'separated' ? 'separated' : 'widowed';
  }
  for (const u of unions) delete u.birthYears, delete u.hasJunior;
}

function buildHouseholds() {
  const households = [];
  const addHousehold = (headId, memberIds) => {
    const id = `H${String(households.length + 1).padStart(4, '0')}`;
    const barangay = pick(BARANGAYS);
    const h = { id, isMock: true, headId: memberIds.includes(headId) ? headId : memberIds[0], memberIds: [...memberIds], address: { line: `${int(1, 240)} ${pick(STREETS)} St.`, barangay, city: 'Quezon City', region: PH_REGIONS[0].name } };
    households.push(h);
    memberIds.forEach(m => { personOf(m).householdId = id; });
    return h;
  };
  const living = persons.filter(p => p.birthDate && !p.deathDate && residentOn(p, TODAY));
  for (const u of unions) {
    const members = [u.husbandId, u.wifeId].filter(id => living.includes(personOf(id)) && !personOf(id).householdId);
    if (!u.endDate && members.length) addHousehold(u.husbandId, members);
  }
  for (const p of [...living].sort((a, b) => (a.birthDate < b.birthDate ? -1 : 1))) {
    if (p.householdId) continue;
    const parentHousehold = parentsOf(p).map(q => q.householdId).find(Boolean);
    if (parentHousehold && !p.unionIds.length) {
      households.find(h => h.id === parentHousehold).memberIds.push(p.id);
      p.householdId = parentHousehold;
    } else {
      addHousehold(p.id, [p.id]);
    }
  }
  for (const p of living) {
    if (ageOn(p.birthDate, TODAY) < 18) continue;
    const slug = `${p.currentName.firstName}.${p.currentName.lastName}`.normalize('NFD').replace(/[^A-Za-z.]/g, '').toLowerCase();
    p.contact = { email: `${slug}.${p.id.toLowerCase()}@${MOCK_EMAIL_DOMAIN}`, mobile: `0900${p.id.slice(1).padStart(7, '0')}` };
  }
  return households;
}

function buildTrees() {
  const childrenOf = new Map();
  for (const p of persons) {
    for (const parent of [p.fatherId, p.motherId]) {
      if (!parent) continue;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent).push(p.id);
    }
  }
  const label = (p) => `${formatFullName(p.currentName)} (${p.birthDate ? p.birthDate.slice(0, 4) : '?'}${p.deathDate ? `-${p.deathDate.slice(0, 4)}` : ''})`;
  const node = (id, seen) => {
    const p = personOf(id);
    const out = { id, name: label(p) };
    if (seen.has(id)) return out; // someone already drawn elsewhere in this tree
    seen.add(id);
    const placed = new Set();
    const families = p.unionIds.map(uid => {
      const u = unionById.get(uid);
      const spouse = personOf(u.husbandId === id ? u.wifeId : u.husbandId);
      u.childrenIds.forEach(c => placed.add(c));
      return { unionId: u.id, kind: u.kind, spouse: { id: spouse.id, name: label(spouse) }, children: u.childrenIds.map(c => node(c, seen)) };
    });
    const others = (childrenOf.get(id) || []).filter(c => !placed.has(c));
    if (others.length) families.push({ unionId: null, kind: 'single-parent', spouse: null, children: others.map(c => node(c, seen)) });
    if (families.length) out.families = families;
    return out;
  };
  return unions
    .filter(u => ['founding-family', 'moved-in'].includes(personOf(u.husbandId).origin) && personOf(u.husbandId).unionIds[0] === u.id)
    .map(u => ({ familyName: personOf(u.husbandId).birthName.lastName, root: node(u.husbandId, new Set()) }));
}

/* ---------- certificate requests (shaped like the CertificateRequest table) ---------- */

const CERT_TYPES = {
  baptisms: 'Baptismal Certificate', confirmations: 'Confirmation Certificate', firstCommunions: 'First Communion Certificate',
  marriages: 'Marriage Certificate', deaths: 'Death Certificate',
};
const PURPOSES = {
  baptisms: ['Marriage preparation', 'School enrollment', 'Confirmation requirement', 'Passport application', 'Personal copy'],
  confirmations: ['Marriage preparation', 'Sponsorship (ninong/ninang)', 'Personal copy'],
  firstCommunions: ['School requirement', 'Personal copy'],
  marriages: ['Visa application', 'SSS / PhilHealth dependent', 'Personal copy', 'Annulment proceedings', 'Insurance claim'],
  deaths: ['Insurance claim', 'Estate settlement', 'Columbary reservation', 'Personal copy'],
};
const REJECTIONS = ['No matching entry in the register for the date given.', 'Requester is not the person named or an immediate relative.', 'Details do not match the register. Please visit the parish office.'];

function buildRequests() {
  const requests = [];
  const total = Math.round(3000 * SCALE);
  const pool = Object.keys(registers).flatMap(reg => registers[reg].filter(r => !r.duplicateOf && r.status === 'digitized').map(r => [reg, r]));
  for (let i = 0; i < total; i += 1) {
    const [reg, r] = pick(pool);
    const subject = personOf(reg === 'marriages' && chance(0.5) ? r.personIds[1] : r.personIds[0]);
    const relatives = [
      ...parentsOf(subject).map(q => [q, q.sex === 'M' ? 'father' : 'mother']),
      ...persons.filter(q => q.fatherId === subject.id || q.motherId === subject.id).map(q => [q, q.sex === 'M' ? 'son' : 'daughter']),
    ].filter(([q]) => q.birthDate && !q.deathDate && q.contact);
    const self = !subject.deathDate && subject.contact;
    const chosen = self && chance(0.8) ? [subject, 'self'] : relatives.length ? pick(relatives) : null;
    if (!chosen) continue;
    const [requester, relationship] = chosen;
    const createdOn = addDays(TODAY, -int(0, 700));
    const roll = rand();
    const status = roll < 0.28 ? 'pending' : roll < 0.48 ? 'approved' : roll < 0.92 ? 'released' : 'rejected';
    const stamp = `${createdOn}T0${int(1, 8)}:${String(int(10, 59))}:00.000Z`;
    requests.push({
      id: `REQ-${String(requests.length + 1).padStart(5, '0')}`,
      isMock: true,
      requesterName: formatFullName(requester.currentName),
      certificateType: CERT_TYPES[reg],
      purpose: pick(PURPOSES[reg]),
      notes: relationship === 'self' ? null : `Requested by ${relationship}.`,
      details: JSON.stringify(r.details),
      status,
      rejectionReason: status === 'rejected' ? pick(REJECTIONS) : null,
      linkedRecordId: status === 'released' && chance(0.7) ? r.id : null,
      email: requester.contact.email,
      createdAt: stamp,
      updatedAt: stamp,
      mockLinks: { requesterPersonId: requester.id, subjectPersonId: subject.id, recordId: r.id, relationship },
    });
  }
  return requests;
}

/* ---------- auto-fill test scenarios ---------- */

function buildScenarios() {
  const recordsByType = {
    baptism: registers.baptisms, confirmation: registers.confirmations, 'first-communion': registers.firstCommunions,
    marriage: registers.marriages, death: registers.deaths,
  };
  const index = buildIndex(persons, recordsByType);
  const scenarios = [];
  const clean = (r) => r.status === 'digitized' && !r.dataQuality.variants.length && !r.dataQuality.blanked.length && !r.duplicateOf;
  const autofill = (r) => ({ details: r.details, officiant: r.officiant, register: r.register, dateOfEvent: r.date, annotations: r.annotations });
  const typedName = (n) => ({ firstName: n.firstName, lastName: n.lastName });
  const onlyOne = (type, p, r, typed = p.currentName) => { const hits = findRecords(index, type, typed); return hits.length === 1 && hits[0].id === r.id; };
  const noRecord = (type, p) => !findRecords(index, type, p.currentName).length;
  const add = (category, title, description, input, expected) => {
    scenarios.push({ id: `SC-${String(scenarios.length + 1).padStart(3, '0')}`, category, title, description, input, expected });
  };
  const take = (list, n) => shuffled(list).slice(0, n);
  const CERT = { marriage: 'Marriage Certificate', baptism: 'Baptismal Certificate', confirmation: 'Confirmation Certificate', 'first-communion': 'First Communion Certificate', death: 'Death Certificate' };

  // 1. The core flow: a living spouse asks for their marriage certificate.
  for (const r of take(registers.marriages.filter(m => clean(m) && !m.annotations.length && personOf(m.personIds[0]).alive && onlyOne('marriage', personOf(m.personIds[0]), m)), 15)) {
    const groom = personOf(r.personIds[0]);
    add('marriage-groom-request', `Groom ${formatFullName(groom.currentName)} requests his marriage certificate`,
      'Typing the groom\'s name should fill every remaining field of the Marriage Certificate form.',
      { certificateType: CERT.marriage, requesterPersonId: groom.id, typed: { 'groom-name': typedName(groom.currentName) } },
      { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r) });
  }

  // 2. A bride uses her married name; the register holds her maiden name.
  for (const r of take(registers.marriages.filter(m => {
    const bride = personOf(m.personIds[1]);
    return clean(m) && bride.alive && !m.annotations.length && bride.currentName.lastName !== m.details['bride-name'].lastName && onlyOne('marriage', bride, m);
  }), 12)) {
    const bride = personOf(r.personIds[1]);
    add('marriage-bride-married-name', `Bride requests under married name ${formatFullName(bride.currentName)}`,
      'The record lists her maiden name, so a search on the current surname alone finds nothing. Auto-fill must return the maiden name in bride-name.',
      { certificateType: CERT.marriage, requesterPersonId: bride.id, typed: { 'bride-name': typedName(bride.currentName) } },
      { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r), warnings: ['record-uses-maiden-name'] });
  }

  // 3. Someone with more than one wedding here.
  const marriageCount = new Map();
  for (const r of registers.marriages.filter(m => !m.duplicateOf)) r.personIds.forEach(id => marriageCount.set(id, [...(marriageCount.get(id) || []), r]));
  for (const [id, list] of take([...marriageCount].filter(([, l]) => l.length > 1), 12)) {
    const p = personOf(id);
    add('marriage-remarried', `${formatFullName(p.currentName)} has ${list.length} marriages in the register`,
      'Widowed or annulled and remarried. Never pick one silently: ask which marriage.',
      { certificateType: CERT.marriage, requesterPersonId: id, typed: { [p.sex === 'M' ? 'groom-name' : 'bride-name']: typedName(nameAt(p, list[0].date)) } },
      { outcome: 'multiple-matches', recordIds: list.map(r => r.id), resolveBy: ['marriage-date', 'spouse-name'] });
  }

  // 4. A marriage with a nullity note still prints, but the office must see the note.
  for (const r of take(registers.marriages.filter(m => clean(m) && m.annotations.length && onlyOne('marriage', personOf(m.personIds[0]), m, nameAt(personOf(m.personIds[0]), m.date))), 8)) {
    const p = personOf(r.personIds[0]);
    add('marriage-nullity-note', `Marriage of ${formatFullName(p.currentName)} has a nullity note`,
      'The record exists, but staff must see the declaration of nullity before issuing it.',
      { certificateType: CERT.marriage, requesterPersonId: p.id, typed: { 'groom-name': typedName(nameAt(p, r.date)) } },
      { outcome: 'unique-match-with-warning', recordIds: [r.id], autofill: autofill(r), warnings: ['declaration-of-nullity'] });
  }

  // 5. Really married, but not in this parish's register.
  const married = (u) => personOf(u.husbandId).birthDate && personOf(u.husbandId).alive && !u.marriageRecordId && noRecord('marriage', personOf(u.husbandId));
  for (const u of take(unions.filter(u => married(u) && u.kind === 'church' && !u.convalidatedOn), 10)) {
    const p = personOf(u.husbandId);
    add('marriage-elsewhere', `${formatFullName(p.currentName)} married at another parish`,
      'No record here. Say so and point to the other parish; do not guess from a similar name.',
      { certificateType: CERT.marriage, requesterPersonId: p.id, typed: { 'groom-name': typedName(p.currentName) } },
      { outcome: 'no-record', recordIds: [], reason: 'married-elsewhere', marriedAt: u.weddingPlace });
  }
  for (const u of take(unions.filter(u => married(u) && u.kind !== 'church' && !u.convalidatedOn), 8)) {
    const p = personOf(u.husbandId);
    add('marriage-not-church', `${formatFullName(p.currentName)} has only a ${u.kind} union`,
      'A civil or live-in union creates no parish marriage record.',
      { certificateType: CERT.marriage, requesterPersonId: p.id, typed: { 'groom-name': typedName(p.currentName) } },
      { outcome: 'no-record', recordIds: [], reason: `${u.kind}-union-only` });
  }

  // 6. Different people, same first and last name, both married here.
  const groups = new Map();
  for (const r of registers.marriages.filter(m => !m.duplicateOf)) {
    const key = nameKey(personOf(r.personIds[0]).currentName);
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  const shared = [...groups.values()].filter(l => new Set(l.map(r => r.personIds[0])).size > 1);
  for (const list of take(shared, 15)) {
    const people = [...new Set(list.map(r => r.personIds[0]))].map(personOf);
    add('marriage-homonyms', `${people.length} different people named ${people[0].currentName.firstName} ${people[0].currentName.lastName} married here`,
      'Name alone is ambiguous. Middle name, spouse or date must decide. These people must never merge.',
      { certificateType: CERT.marriage, requesterPersonId: people[0].id, typed: { 'groom-name': typedName(people[0].currentName) } },
      { outcome: 'multiple-matches', recordIds: list.map(r => r.id), resolveBy: ['middle-name', 'spouse-name', 'marriage-date'], distinctPersonIds: people.map(p => p.id) });
  }

  // 7. Father and son with the same name.
  const juniors = registers.marriages.filter(m => {
    const son = personOf(m.personIds[0]);
    return !m.duplicateOf && son.currentName.extension && son.fatherId && marriageCount.get(son.fatherId);
  });
  for (const r of take(juniors, 10)) {
    const son = personOf(r.personIds[0]);
    const father = personOf(son.fatherId);
    add('marriage-father-son-same-name', `${formatFullName(son.currentName)} and his father share a name`,
      'Only the extension (Jr., III) separates them, so name matching alone is not enough.',
      { certificateType: CERT.marriage, requesterPersonId: son.id, typed: { 'groom-name': typedName(son.currentName) } },
      { outcome: 'multiple-matches', recordIds: [...new Set([...marriageCount.get(son.fatherId), r].map(x => x.id))], resolveBy: ['extension', 'father-name', 'marriage-date'], distinctPersonIds: [son.id, father.id] });
  }

  // 8. Twins look like duplicates to a careless check.
  const seenTwins = new Set();
  for (const r of take(registers.baptisms.filter(b => clean(b) && personOf(b.personIds[0]).twinOf), 40)) {
    const p = personOf(r.personIds[0]);
    if (seenTwins.has(p.twinOf) || !onlyOne('baptism', p, r)) continue;
    const twinRecord = registers.baptisms.find(b => b.personIds[0] === p.twinOf);
    if (!twinRecord || scenarios.filter(s => s.category === 'baptism-twins').length >= 10) continue;
    seenTwins.add(p.id);
    add('baptism-twins', `Twins ${p.currentName.firstName} and ${personOf(p.twinOf).currentName.firstName} ${p.currentName.lastName}`,
      'Same parents, birthday and possibly baptism day: two people, not a duplicate.',
      { certificateType: CERT.baptism, requesterPersonId: p.id, typed: { 'baptized-name': typedName(p.currentName) } },
      { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r), notDuplicateOf: twinRecord.id });
  }

  // 9. Baptism shapes that leave fields empty on purpose.
  const baptismCase = (category, title, description, filter, count, expected) => {
    for (const r of take(registers.baptisms.filter(b => clean(b) && filter(b) && onlyOne('baptism', personOf(b.personIds[0]), b)), count)) {
      const p = personOf(r.personIds[0]);
      add(category, title(p), description,
        { certificateType: CERT.baptism, requesterPersonId: p.id, typed: { 'baptized-name': typedName(p.currentName) } },
        { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r), ...expected });
    }
  };
  baptismCase('baptism-no-father', p => `${formatFullName(p.currentName)} has no father on record`,
    'father-name stays null, the same as the form\'s Not Applicable box. Do not invent one from a surname.',
    b => b.tags.includes('no-father-on-record') && !b.guardianId, 10, { emptyOnPurpose: ['father-name'] });
  baptismCase('baptism-guardian', p => `${formatFullName(p.currentName)} was presented by a guardian`,
    'Parents are null and guardian is filled, matching the form\'s guardian toggle.',
    b => !!b.guardianId, 10, { emptyOnPurpose: ['father-name', 'mother-name'] });
  baptismCase('baptism-adult', p => `${formatFullName(p.currentName)} was baptized as an adult`,
    'Baptism came years after birth, shortly before a wedding.', b => b.tags.includes('adult-baptism'), 8, {});
  baptismCase('baptism-late', p => `${formatFullName(p.currentName)} was baptized late`,
    'Baptized between ages 3 and 12, not as an infant.', b => b.tags.includes('late-baptism'), 6, {});

  const renamed = (reason, category, title, description) => {
    for (const r of take(registers.baptisms.filter(b => {
      const p = personOf(b.personIds[0]);
      return clean(b) && p.nameHistory.some(h => h.reason === reason) && p.alive && b.details['baptized-name'].lastName !== p.currentName.lastName && onlyOne('baptism', p, b);
    }), 8)) {
      const p = personOf(r.personIds[0]);
      add(category, title(p), description,
        { certificateType: CERT.baptism, requesterPersonId: p.id, typed: { 'baptized-name': typedName(p.currentName) } },
        { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r), warnings: ['name-changed-since-record'] });
    }
  };
  renamed('legitimation', 'baptism-legitimated', p => `${formatFullName(p.currentName)} was baptized under the mother's surname`,
    'The parents married later and the surname changed. The record keeps the old name.');
  renamed('marriage', 'baptism-married-woman', p => `${formatFullName(p.currentName)} was baptized under her maiden name`,
    'Her current surname is not on the baptism record.');

  // Adopted children are baptized after adoption, so the birth name is what fails to appear.
  for (const r of take(registers.baptisms.filter(b => {
    const p = personOf(b.personIds[0]);
    return clean(b) && p.adoptedOn && p.alive && onlyOne('baptism', p, b, p.birthName);
  }), 8)) {
    const p = personOf(r.personIds[0]);
    add('baptism-adopted', `${formatFullName(p.currentName)} searches by birth name ${formatFullName(p.birthName)}`,
      'The record holds the adoptive name and adoptive parents. Treat adoption details as sensitive.',
      { certificateType: CERT.baptism, requesterPersonId: p.id, typed: { 'baptized-name': typedName(p.birthName) } },
      { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r), warnings: ['record-under-adoptive-name'] });
  }

  // 10. People with no baptism here, for different reasons.
  for (const p of take(persons.filter(p => p.alive && p.birthDate && p.baptizedElsewhere && !findRecords(index, 'baptism', p.currentName).length && yearOf(p.baptizedElsewhere.date) < REGISTER_START), 8)) {
    add('baptism-before-parish', `${formatFullName(p.currentName)} was baptized before the parish existed`,
      'The register starts in 1974, so this is an expected miss.',
      { certificateType: CERT.baptism, requesterPersonId: p.id, typed: { 'baptized-name': typedName(p.currentName) } },
      { outcome: 'no-record', recordIds: [], reason: 'predates-register', baptizedAt: p.baptizedElsewhere.church });
  }
  for (const p of take(persons.filter(p => p.alive && p.birthDate && p.baptizedElsewhere && p.residentFrom && !findRecords(index, 'baptism', p.currentName).length && yearOf(p.baptizedElsewhere.date) >= REGISTER_START), 8)) {
    add('baptism-elsewhere', `${formatFullName(p.currentName)} was baptized at another parish`,
      'A parishioner today, but the record lives elsewhere.',
      { certificateType: CERT.baptism, requesterPersonId: p.id, typed: { 'baptized-name': typedName(p.currentName) } },
      { outcome: 'no-record', recordIds: [], reason: 'baptized-elsewhere', baptizedAt: p.baptizedElsewhere.church });
  }

  // 11. Older registers: spelling differences, double entries, blanks, scans not finished.
  for (const kind of Object.keys(VARIANTS)) {
    for (const r of take(registers.baptisms.filter(b => b.status === 'digitized' && !b.dataQuality.blanked.length && !b.duplicateOf && b.dataQuality.variants.some(v => v.kind === kind)), 5)) {
      const canonical = r.dataQuality.canonicalNames['baptized-name'];
      add('legacy-spelling', `Register spells the name differently: ${kind}`,
        `Register has "${formatFullName(r.details['baptized-name'])}" for "${formatFullName(canonical)}".`,
        { certificateType: CERT.baptism, requesterPersonId: r.personIds[0], typed: { 'baptized-name': typedName(canonical) } },
        { outcome: 'variant-match', recordIds: [r.id], variant: kind, autofill: autofill(r), warnings: ['confirm-spelling-with-staff'] });
    }
  }
  for (const reg of ['baptisms', 'marriages', 'deaths']) {
    for (const copy of take(registers[reg].filter(r => r.duplicateOf), 5)) {
      const p = personOf(copy.personIds[0]);
      add('duplicate-entry', `${formatFullName(p.currentName)} has a double-encoded ${copy.type} record`,
        'Same person and event entered twice. record-duplicates.js should flag it.',
        { certificateType: CERT[copy.type], requesterPersonId: p.id, typed: { [PRIMARY_NAMES[reg][0]]: typedName(nameAt(p, copy.date)) } },
        { outcome: 'duplicate-records', recordIds: [copy.duplicateOf, copy.id] });
    }
  }
  for (const r of take(registers.baptisms.filter(b => b.status !== 'digitized' && onlyOne('baptism', personOf(b.personIds[0]), b)), 8)) {
    const p = personOf(r.personIds[0]);
    add('record-not-digitized', `${formatFullName(p.currentName)}'s record is still ${r.status}`,
      'The entry exists but has not been scanned, so staff must check the paper book.',
      { certificateType: CERT.baptism, requesterPersonId: p.id, typed: { 'baptized-name': typedName(p.currentName) } },
      { outcome: 'not-digitized', recordIds: [r.id], status: r.status });
  }
  for (const reg of ['baptisms', 'marriages']) {
    for (const r of take(registers[reg].filter(x => x.status === 'digitized' && !x.duplicateOf && !x.dataQuality.variants.length && x.dataQuality.blanked.length && onlyOne(reg === 'baptisms' ? 'baptism' : 'marriage', personOf(x.personIds[0]), x)), 6)) {
      const p = personOf(r.personIds[0]);
      add('partial-record', `${formatFullName(p.currentName)}'s record has blanks`,
        'Fill what exists and leave the rest for staff. Never fill a blank from a relative\'s record.',
        { certificateType: CERT[r.type], requesterPersonId: p.id, typed: { [PRIMARY_NAMES[reg][0]]: typedName(p.currentName) } },
        { outcome: 'partial-match', recordIds: [r.id], autofill: autofill(r), blankFields: r.dataQuality.blanked });
    }
  }

  // 12. One record feeding another form.
  for (const r of take(registers.confirmations.filter(c => clean(c) && c.baptismRecordId && onlyOne('confirmation', personOf(c.personIds[0]), c)), 10)) {
    const p = personOf(r.personIds[0]);
    add('confirmation-from-baptism', `${formatFullName(p.currentName)}'s confirmation links to their baptism`,
      'baptism-date on this form must equal the date in the baptism register.',
      { certificateType: CERT.confirmation, requesterPersonId: p.id, typed: { 'confirmed-name': typedName(p.currentName) } },
      { outcome: 'unique-match', recordIds: [r.id], linkedBaptismId: r.baptismRecordId, autofill: autofill(r) });
  }
  for (const r of take(registers.firstCommunions.filter(c => clean(c) && onlyOne('first-communion', personOf(c.personIds[0]), c)), 8)) {
    const p = personOf(r.personIds[0]);
    add('first-communion', `${formatFullName(p.currentName)} requests a First Communion certificate`,
      'A record type the ParishRecord table has no value for.',
      { certificateType: CERT['first-communion'], requesterPersonId: p.id, typed: { 'fc-name': typedName(p.currentName) } },
      { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r), catechist: r.catechist });
  }

  // 13. Death records.
  for (const r of take(registers.deaths.filter(d => clean(d) && onlyOne('death', personOf(d.personIds[0]), d)), 40)) {
    const p = personOf(r.personIds[0]);
    const child = persons.find(q => (q.fatherId === p.id || q.motherId === p.id) && q.alive && q.contact);
    if (!child || scenarios.filter(s => s.category === 'death-by-relative').length >= 10) continue;
    add('death-by-relative', `${formatFullName(child.currentName)} requests the death certificate of a parent`,
      'The requester is not the person named on the record.',
      { certificateType: CERT.death, requesterPersonId: child.id, typed: { 'deceased-name': typedName(p.currentName) } },
      { outcome: 'unique-match', recordIds: [r.id], autofill: autofill(r), relationship: child.sex === 'M' ? 'son' : 'daughter' });
  }
  for (const r of take(registers.marriages.filter(m => clean(m) && !personOf(m.personIds[0]).alive && onlyOne('marriage', personOf(m.personIds[0]), m)), 6)) {
    const p = personOf(r.personIds[0]);
    add('deceased-self-request', `Request as "self" for ${formatFullName(p.currentName)}, who has died`,
      'A person with a death date cannot be the requester. Flag it for staff.',
      { certificateType: CERT.marriage, requesterPersonId: p.id, typed: { 'groom-name': typedName(p.currentName) }, relationship: 'self' },
      { outcome: 'conflict', recordIds: [r.id], reason: 'requester-deceased' });
  }

  // 14. Nobody by that name.
  for (const [first, last] of [['Xyrelle', 'Quistorpio'], ['Zebedeo', 'Ytturalde'], ['Quennie', 'Wongsakul'], ['Yvorn', 'Zzyzx']]) {
    add('no-such-person', `No one named ${first} ${last}`, 'Return nothing and offer manual entry.',
      { certificateType: CERT.marriage, requesterPersonId: null, typed: { 'groom-name': { firstName: first, lastName: last } } },
      { outcome: 'no-person', recordIds: [] });
  }

  // 15. Can this couple marry? Checks for the Wedding booking.
  const proposedDate = '2027-02-13';
  const living = persons.filter(p => p.alive && p.birthDate);
  const adults = (sex) => living.filter(p => p.sex === sex && ageOn(p.birthDate, proposedDate) >= 18 && !p.unionIds.length);
  const freeMen = shuffled(adults('M'));
  const freeWomen = shuffled(adults('F'));
  const wedding = (category, title, description, g, b) => {
    const check = weddingCheck(g, b, proposedDate, { persons: byId, unions: unionById });
    add(category, title, description,
      { check: 'wedding-eligibility', groomId: g.id, brideId: b.id, proposedDate },
      { outcome: check.outcome, reasons: check.reasons });
  };
  const unrelatedTo = (p, list) => list.find(q => !related(p, q));
  const inChurchMarriage = living.filter(p => p.unionIds.some(id => { const u = unionById.get(id); return !u.endDate && u.kind === 'church'; }));
  for (const g of take(inChurchMarriage.filter(p => p.sex === 'M'), 8)) {
    wedding('wedding-already-married', `${formatFullName(g.currentName)} is still married`, 'Spouse is alive and the marriage stands.', g, unrelatedTo(g, freeWomen));
  }
  const widowed = living.filter(p => p.civilStatus === 'widowed' && ageOn(p.birthDate, proposedDate) < 75);
  for (const g of take(widowed.filter(p => p.sex === 'M'), 6)) {
    wedding('wedding-widowed', `Widower ${formatFullName(g.currentName)} may remarry`, 'The earlier spouse has died.', g, unrelatedTo(g, freeWomen));
  }
  const annulled = living.filter(p => p.civilStatus === 'annulled');
  for (const g of take(annulled.filter(p => p.sex === 'M'), 6)) {
    wedding('wedding-after-nullity', `${formatFullName(g.currentName)} has a declaration of nullity`, 'Free to marry; the certificate of nullity is required.', g, unrelatedTo(g, freeWomen));
  }
  let cousinCases = 0;
  for (const g of freeMen) {
    if (cousinCases >= 8) break;
    const grandparents = parentsOf(g).flatMap(parentsOf).map(q => q.id);
    if (!grandparents.length) continue;
    const cousin = freeWomen.find(b => parentsOf(b).flatMap(parentsOf).some(q => grandparents.includes(q.id)) && !parentsOf(b).some(q => parentsOf(g).includes(q)));
    if (!cousin) continue;
    wedding('wedding-first-cousins', `${formatFullName(g.currentName)} and ${formatFullName(cousin.currentName)} are first cousins`, 'They share a grandparent: an impediment that needs a dispensation.', g, cousin);
    cousinCases += 1;
  }
  const sameParents = (a, b) => parentsOf(a).some(q => parentsOf(b).includes(q));
  let siblingCases = 0;
  for (const g of freeMen) {
    if (siblingCases >= 4) break;
    const sister = freeWomen.find(b => sameParents(g, b));
    if (!sister) continue;
    wedding('wedding-siblings', `${formatFullName(g.currentName)} and ${formatFullName(sister.currentName)} are siblings`, 'Cannot marry.', g, sister);
    siblingCases += 1;
  }
  for (const g of take(living.filter(p => p.sex === 'M' && ageOn(p.birthDate, proposedDate) === 16), 5)) {
    wedding('wedding-underage', `${formatFullName(g.currentName)} is under 18`, 'Below the legal age to marry in the Philippines.', g, unrelatedTo(g, freeWomen));
  }
  for (const g of take(persons.filter(p => p.sex === 'M' && p.birthDate && p.deathDate), 4)) {
    wedding('wedding-party-deceased', `${formatFullName(g.currentName)} has a death record`, 'A dead person cannot be booked; usually a mistaken identity.', g, unrelatedTo(g, freeWomen));
  }
  for (const g of take(freeMen.filter(p => ageOn(p.birthDate, proposedDate) >= 22), 10)) {
    const b = freeWomen.find(q => ageOn(q.birthDate, proposedDate) >= 21 && !related(g, q));
    wedding('wedding-allowed', `${formatFullName(g.currentName)} and ${formatFullName(b.currentName)} are free to marry`, 'The control case: unrelated, single adults.', g, b);
  }

  return scenarios;
}

/* ---------- write everything ---------- */

simulate();
buildRegisters();
finalizePersons();
const households = buildHouseholds();
const requests = buildRequests();
const trees = buildTrees();
const scenarios = buildScenarios();

/** One object per line: readable, diffable, and much smaller than pretty-printed JSON. */
function writeRows(file, rows) {
  writeFileSync(resolve(OUT, file), `[\n${rows.map(r => JSON.stringify(r)).join(',\n')}\n]\n`);
}

mkdirSync(OUT, { recursive: true });
writeRows('persons.json', persons);
writeRows('families.json', unions);
writeRows('households.json', households);
writeRows('family-trees.json', trees);
writeRows('records-baptism.json', registers.baptisms);
writeRows('records-confirmation.json', registers.confirmations);
writeRows('records-first-communion.json', registers.firstCommunions);
writeRows('records-marriage.json', registers.marriages);
writeRows('records-death.json', registers.deaths);
writeRows('certificate-requests.json', requests);
writeFileSync(resolve(OUT, 'autofill-scenarios.json'), `${JSON.stringify(scenarios, null, 1)}\n`);

const countBy = (list, fn) => Object.fromEntries(Object.entries(list.reduce((acc, x) => { const k = fn(x); acc[k] = (acc[k] || 0) + 1; return acc; }, {})).sort());
const manifest = {
  isMock: true,
  generatedFor: TODAY,
  seed: SEED,
  scale: SCALE,
  counts: {
    persons: persons.length,
    fullProfiles: persons.filter(p => p.birthDate).length,
    parentNameOnly: persons.filter(p => !p.birthDate).length,
    living: persons.filter(p => p.alive).length,
    livingResidents: persons.filter(p => p.alive && p.householdId).length,
    families: unions.length,
    familyTrees: trees.length,
    households: households.length,
    baptisms: registers.baptisms.length,
    confirmations: registers.confirmations.length,
    firstCommunions: registers.firstCommunions.length,
    marriages: registers.marriages.length,
    deaths: registers.deaths.length,
    certificateRequests: requests.length,
    scenarios: scenarios.length,
  },
  personsByOrigin: countBy(persons, p => p.origin),
  civilStatus: countBy(persons, p => p.civilStatus),
  familiesByKind: countBy(unions, u => u.kind),
  familyEndings: countBy(unions, u => u.endReason || 'ongoing'),
  scenariosByCategory: countBy(scenarios, s => s.category),
  scenariosByOutcome: countBy(scenarios, s => s.expected.outcome),
};
writeFileSync(resolve(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest.counts, null, 2));
