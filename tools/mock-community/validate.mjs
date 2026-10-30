#!/usr/bin/env node
/* ============================================
   Mock community validator
   Re-reads the generated files and proves they are
   believable and self-consistent, independently of how
   they were built. Exits with code 1 on any failure.

     node tools/mock-community/validate.mjs
     node tools/mock-community/validate.mjs --dir some/folder

   It also runs the app's real duplicate check
   (Sacradigit/record-duplicates.js) over the data and
   reports what that check gets wrong. Those findings
   are about the app, so they never fail validation.
   ============================================ */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, findRecords, weddingCheck } from './lookup.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const dirArg = process.argv.indexOf('--dir');
const DIR = resolve(ROOT, dirArg > -1 ? process.argv[dirArg + 1] : 'mock-data');
const load = (file) => JSON.parse(readFileSync(resolve(DIR, file), 'utf8'));

const TODAY = '2026-10-30';
const REGISTER_START = 1974;

const persons = load('persons.json');
const families = load('families.json');
const households = load('households.json');
const records = {
  baptism: load('records-baptism.json'),
  confirmation: load('records-confirmation.json'),
  'first-communion': load('records-first-communion.json'),
  marriage: load('records-marriage.json'),
  death: load('records-death.json'),
};
const requests = load('certificate-requests.json');
const scenarios = load('autofill-scenarios.json');
const allRecords = Object.values(records).flat();

const person = new Map(persons.map(p => [p.id, p]));
const family = new Map(families.map(f => [f.id, f]));
const recordById = new Map(allRecords.map(r => [r.id, r]));

const failures = new Map();
const checksRun = [];
function check(name, fn) {
  checksRun.push(name);
  const problems = [];
  fn((message) => problems.push(message));
  if (problems.length) failures.set(name, problems);
}

const ageOn = (birth, on) => {
  const years = Number(on.slice(0, 4)) - Number(birth.slice(0, 4));
  return on.slice(5) >= birth.slice(5) ? years : years - 1;
};
const fullProfiles = persons.filter(p => p.birthDate);
const formatName = (n) => [n.firstName, n.middleName, n.lastName, n.extension].filter(Boolean).join(' ');
const nameAt = (p, date) => p.nameHistory.filter(e => e.from <= date).at(-1)?.name || p.birthName;

/* ---------- people ---------- */

check('ids are unique', (fail) => {
  for (const [label, list] of [['person', persons], ['family', families], ['record', allRecords], ['request', requests], ['scenario', scenarios]]) {
    if (new Set(list.map(x => x.id)).size !== list.length) fail(`duplicate ${label} id`);
  }
});

check('every link points at something real', (fail) => {
  for (const p of persons) {
    for (const k of ['fatherId', 'motherId', 'biologicalFatherId', 'biologicalMotherId']) if (p[k] && !person.has(p[k])) fail(`${p.id}.${k}`);
    for (const id of p.unionIds) if (!family.has(id)) fail(`${p.id} union ${id}`);
    if (p.householdId && !households.some(h => h.id === p.householdId)) fail(`${p.id} household`);
  }
  for (const f of families) {
    if (!person.has(f.husbandId) || !person.has(f.wifeId)) fail(`${f.id} spouse`);
    for (const c of f.childrenIds) if (!person.has(c)) fail(`${f.id} child ${c}`);
    if (f.marriageRecordId && !recordById.has(f.marriageRecordId)) fail(`${f.id} record`);
  }
  for (const r of allRecords) {
    for (const id of [...r.personIds, ...(r.sponsorIds || []), r.guardianId].filter(Boolean)) if (!person.has(id)) fail(`${r.id} person ${id}`);
    if (r.duplicateOf && !recordById.has(r.duplicateOf)) fail(`${r.id} duplicateOf`);
  }
  for (const q of requests) {
    if (!person.has(q.mockLinks.requesterPersonId) || !recordById.has(q.mockLinks.recordId)) fail(q.id);
    if (q.linkedRecordId && q.linkedRecordId !== q.mockLinks.recordId) fail(`${q.id} linked record`);
  }
});

check('all data is marked fake and cannot reach a real inbox or phone', (fail) => {
  for (const x of [...persons, ...allRecords, ...requests, ...households]) if (x.isMock !== true) fail(`${x.id} not marked`);
  for (const p of persons) {
    if (p.contact && !p.contact.email.endsWith('@mock-sacradigit.test')) fail(`${p.id} email`);
    if (p.contact && !/^0900\d{7}$/.test(p.contact.mobile)) fail(`${p.id} mobile`);
  }
  for (const q of requests) if (!q.email.endsWith('.test')) fail(`${q.id} email`);
});

check('dates are real, ordered and never in the future', (fail) => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const p of fullProfiles) {
    if (!iso.test(p.birthDate) || p.birthDate < '1885-01-01' || p.birthDate > TODAY) fail(`${p.id} birth ${p.birthDate}`);
    if (p.deathDate && (p.deathDate < p.birthDate || p.deathDate > TODAY)) fail(`${p.id} death ${p.deathDate}`);
    if (p.deathDate && ageOn(p.birthDate, p.deathDate) > 110) fail(`${p.id} lived too long`);
    if (!p.deathDate && ageOn(p.birthDate, TODAY) > 110) fail(`${p.id} still alive at ${ageOn(p.birthDate, TODAY)}`);
    if (p.alive !== !p.deathDate) fail(`${p.id} alive flag`);
  }
  for (const r of allRecords) if (!iso.test(r.date) || r.date > TODAY || Number(r.date.slice(0, 4)) < REGISTER_START) fail(`${r.id} date ${r.date}`);
});

check('parents are old enough for their children', (fail) => {
  for (const p of fullProfiles) {
    const m = p.motherId && person.get(p.motherId);
    const f = p.fatherId && person.get(p.fatherId);
    const adopted = !!p.adoptedOn;
    if (m?.birthDate) {
      const age = ageOn(m.birthDate, p.birthDate);
      if (!adopted && (age < 16 || age > 50)) fail(`${p.id}: mother aged ${age}`);
      if (!adopted && m.deathDate && m.deathDate < p.birthDate) fail(`${p.id}: born after mother died`);
    }
    if (f?.birthDate) {
      if (!adopted && ageOn(f.birthDate, p.birthDate) < 16) fail(`${p.id}: father too young`);
      if (!adopted && f.deathDate && p.birthDate > f.deathDate.replace(/^\d{4}/, y => Number(y) + 1)) fail(`${p.id}: born over a year after father died`);
    }
    if (m && f && m.sex !== 'F') fail(`${p.id}: mother is not female`);
    if (f && f.sex !== 'M') fail(`${p.id}: father is not male`);
  }
});

check('Filipino naming: surname and middle name follow the parents', (fail) => {
  for (const p of fullProfiles) {
    const m = p.motherId && person.get(p.motherId);
    if (p.origin === 'born-in-parish' && m) {
      const name = p.birthName;
      if (name.middleName && name.middleName !== m.birthName.lastName) fail(`${p.id}: middle ${name.middleName} is not mother's maiden name`);
      if (!name.middleName && name.lastName !== m.birthName.lastName) fail(`${p.id}: no middle name, not on mother's surname`);
    }
    for (const n of [p.birthName, p.currentName]) if (!n.firstName || !n.lastName) fail(`${p.id}: empty name`);
  }
  for (const f of families.filter(x => x.kind === 'church' && x.endDate === null)) {
    const w = person.get(f.wifeId);
    if (w.currentName.lastName !== person.get(f.husbandId).currentName.lastName) fail(`${f.id}: wife kept a different surname`);
  }
});

check('brothers and sisters never share a first name', (fail) => {
  for (const f of families) {
    const names = f.childrenIds.map(id => person.get(id).birthName.firstName);
    if (new Set(names).size !== names.length) fail(`${f.id}: ${names.join(', ')}`);
  }
});

check('extensions (Jr., III) continue the father\'s name', (fail) => {
  for (const p of fullProfiles.filter(x => x.birthName.extension)) {
    const f = person.get(p.fatherId);
    if (!f || f.currentName.firstName !== p.birthName.firstName) fail(`${p.id}: ${p.birthName.extension} but father is ${f?.currentName.firstName}`);
  }
});

/* ---------- families ---------- */

check('no bigamy: nobody has two standing marriages at once', (fail) => {
  for (const p of persons) {
    const unions = p.unionIds.map(id => family.get(id)).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    for (let i = 1; i < unions.length; i += 1) {
      if (!unions[i - 1].endDate || unions[i - 1].endDate >= unions[i].startDate) fail(`${p.id}: ${unions[i - 1].id} overlaps ${unions[i].id}`);
    }
  }
});

check('spouses are adults, alive, and not closely related', (fail) => {
  const ancestors = (p, depth, out = new Set()) => {
    out.add(p.id);
    if (depth) for (const id of [p.fatherId, p.motherId]) if (id) ancestors(person.get(id), depth - 1, out);
    return out;
  };
  for (const f of families) {
    const h = person.get(f.husbandId);
    const w = person.get(f.wifeId);
    for (const p of [h, w]) {
      if (p.birthDate && ageOn(p.birthDate, f.startDate) < 18) fail(`${f.id}: ${p.id} aged ${ageOn(p.birthDate, f.startDate)}`);
      if (p.deathDate && p.deathDate < f.startDate) fail(`${f.id}: ${p.id} already dead`);
    }
    const seen = ancestors(h, 3);
    for (const id of ancestors(w, 3)) if (seen.has(id)) { fail(`${f.id}: spouses related via ${id}`); break; }
  }
});

check('family end dates match the deaths and nullities behind them', (fail) => {
  for (const f of families) {
    const h = person.get(f.husbandId);
    const w = person.get(f.wifeId);
    if (f.endReason === 'death-of-husband' && h.deathDate !== f.endDate) fail(f.id);
    if (f.endReason === 'death-of-wife' && w.deathDate !== f.endDate) fail(f.id);
    if (!f.endDate && (h.deathDate || w.deathDate)) fail(`${f.id}: open but a spouse died`);
  }
});

check('every living resident is in exactly one household', (fail) => {
  const seen = new Map();
  for (const h of households) {
    if (!h.memberIds.includes(h.headId) && person.get(h.headId).alive) fail(`${h.id}: living head missing from members`);
    for (const id of h.memberIds) {
      if (seen.has(id)) fail(`${id} in two households`);
      seen.set(id, h.id);
      if (!person.get(id).alive) fail(`${h.id}: deceased member ${id}`);
    }
  }
  for (const p of fullProfiles) if (p.householdId && seen.get(p.id) !== p.householdId) fail(`${p.id} household mismatch`);
});

/* ---------- registers ---------- */

check('register entries are unique (book / page / line)', (fail) => {
  for (const [type, list] of Object.entries(records)) {
    const seen = new Set();
    for (const r of list) {
      const key = `${r.register.bookNo}/${r.register.page}/${r.register.line}`;
      if (seen.has(key)) fail(`${type} ${key}`);
      seen.add(key);
    }
  }
});

check('registers run in date order', (fail) => {
  for (const [type, list] of Object.entries(records)) {
    for (let i = 1; i < list.length; i += 1) if (list[i - 1].date > list[i].date) fail(`${type} ${list[i].id}`);
  }
});

check('details use exactly the keys the certificate forms read', (fail) => {
  const KEYS = {
    baptism: ['baptized-name', 'birth-date', 'birth-region', 'birth-city', 'birthplace', 'baptism-date', 'guardian', 'father-name', 'mother-name', 'sponsor-1', 'sponsor-2', 'extraGodparents'],
    confirmation: ['confirmed-name', 'baptism-date', 'baptism-church', 'confirmation-name', 'confirmation-date', 'guardian', 'father-name', 'mother-name', 'sponsor-name'],
    'first-communion': ['fc-name', 'fc-communion-date'],
    marriage: ['groom-name', 'groom-guardian', 'groom-father', 'groom-mother', 'bride-name', 'bride-guardian', 'bride-father', 'bride-mother', 'witness-1', 'witness-2', 'marriage-date', 'marriage-place'],
    death: ['deceased-name', 'age', 'death-date', 'place-of-death', 'burial-date', 'burial-place'],
  };
  const nameShape = (n) => n && ['firstName', 'middleName', 'lastName', 'extension'].every(k => typeof n[k] === 'string');
  for (const [type, list] of Object.entries(records)) {
    for (const r of list) {
      const keys = Object.keys(r.details).sort().join();
      if (keys !== [...KEYS[type]].sort().join()) fail(`${r.id}: ${keys}`);
      for (const [k, v] of Object.entries(r.details)) {
        if (/-name$|^sponsor-|^witness-|-father$|-mother$/.test(k) && k !== 'confirmation-name' && v !== null && !nameShape(v)) fail(`${r.id}.${k} is not a name object`);
      }
    }
  }
});

check('ParishRecord rows fit the deployed table', (fail) => {
  const types = new Set(['baptism', 'confirmation', 'marriage', 'death', null]);
  const statuses = new Set(['digitized', 'processing', 'queued']);
  for (const r of allRecords) {
    const row = r.parishRecord;
    if (!row?.fullName) fail(`${r.id}: no fullName`);
    if (!types.has(row.type) || !statuses.has(row.status)) fail(`${r.id}: enum`);
    if (Object.keys(row).sort().join() !== 'addedByName,dateOfEvent,fileURL,fullName,officiant,status,type') fail(`${r.id}: columns`);
  }
});

check('CertificateRequest rows fit the deployed table', (fail) => {
  const statuses = new Set(['pending', 'approved', 'released', 'rejected']);
  const types = new Set(['Baptismal Certificate', 'Confirmation Certificate', 'First Communion Certificate', 'Marriage Certificate', 'Death Certificate']);
  for (const q of requests) {
    if (!statuses.has(q.status) || !types.has(q.certificateType)) fail(q.id);
    if (q.status === 'rejected' && !q.rejectionReason) fail(`${q.id}: rejected without reason`);
    if (q.linkedRecordId && q.status !== 'released') fail(`${q.id}: linked before release`);
    JSON.parse(q.details);
    if (person.get(q.mockLinks.requesterPersonId).deathDate) fail(`${q.id}: requester is dead`);
  }
});

check('the order of sacraments makes sense for each person', (fail) => {
  const baptismOf = new Map();
  for (const r of records.baptism) baptismOf.set(r.personIds[0], r);
  for (const r of allRecords) {
    if (r.type === 'marriage') continue;
    const p = person.get(r.personIds[0]);
    if (r.type !== 'death' && p.deathDate && r.date > p.deathDate) fail(`${r.id}: after death`);
    if (r.date < p.birthDate) fail(`${r.id}: before birth`);
    const b = baptismOf.get(p.id);
    if (['confirmation', 'first-communion'].includes(r.type) && b && r.date <= b.date) fail(`${r.id}: before baptism`);
    if (r.type === 'confirmation' && ageOn(p.birthDate, r.date) < 10) fail(`${r.id}: confirmed too young`);
    if (r.type === 'first-communion' && ageOn(p.birthDate, r.date) < 6) fail(`${r.id}: communion too young`);
  }
  for (const r of records.confirmation) {
    if (r.baptismRecordId && recordById.get(r.baptismRecordId).date !== r.details['baptism-date']) fail(`${r.id}: baptism-date disagrees with ${r.baptismRecordId}`);
  }
});

check('marriage records agree with the people and families behind them', (fail) => {
  for (const r of records.marriage) {
    const [h, w] = r.personIds.map(id => person.get(id));
    const f = family.get(r.unionId);
    if (!f || f.husbandId !== h.id || f.wifeId !== w.id) fail(`${r.id}: family mismatch`);
    if (f.weddingDate !== r.date) fail(`${r.id}: date ${r.date} vs family ${f.weddingDate}`);
    for (const p of [h, w]) {
      if (ageOn(p.birthDate, r.date) < 18) fail(`${r.id}: underage`);
      if (p.deathDate && p.deathDate < r.date) fail(`${r.id}: spouse already dead`);
    }
    const canonical = r.dataQuality.canonicalNames;
    if (canonical['groom-name'].lastName !== nameAt(h, f.startDate).lastName && !h.nameHistory.some(e => e.name.lastName === canonical['groom-name'].lastName)) fail(`${r.id}: groom name`);
    if (!w.nameHistory.some(e => e.name.lastName === canonical['bride-name'].lastName)) fail(`${r.id}: bride name`);
    if (!r.dataQuality.blanked.includes('groom-mother') && r.details['groom-mother'] && h.motherId && r.details['groom-mother'].lastName !== person.get(h.motherId).birthName.lastName) fail(`${r.id}: groom's mother is not the maiden name`);
    if (r.details['bride-mother'] && w.motherId && r.details['bride-mother'].lastName !== person.get(w.motherId).birthName.lastName) fail(`${r.id}: bride's mother is not the maiden name`);
  }
});

check('sponsors are grown, alive, and not the person\'s own parents', (fail) => {
  for (const r of [...records.baptism, ...records.confirmation, ...records.marriage]) {
    const parents = new Set(r.personIds.flatMap(id => [person.get(id).fatherId, person.get(id).motherId]));
    for (const id of r.sponsorIds) {
      const s = person.get(id);
      if (r.personIds.includes(id)) fail(`${r.id}: sponsors themselves`);
      if (parents.has(id)) fail(`${r.id}: parent is sponsor`);
      if (s.birthDate > r.date || ageOn(s.birthDate, r.date) < 16) fail(`${r.id}: sponsor ${id} too young`);
      if (s.deathDate && s.deathDate < r.date) fail(`${r.id}: sponsor ${id} already dead`);
    }
    if (new Set(r.sponsorIds).size !== r.sponsorIds.length) fail(`${r.id}: repeated sponsor`);
  }
});

check('guardians are older than the person and alive', (fail) => {
  for (const r of [...records.baptism, ...records.confirmation].filter(x => x.guardianId)) {
    const g = person.get(r.guardianId);
    if (g.birthDate >= person.get(r.personIds[0]).birthDate) fail(`${r.id}: guardian is younger`);
    if (g.deathDate && g.deathDate < r.date) fail(`${r.id}: guardian already dead`);
    if (r.details['father-name'] !== null || r.details['mother-name'] !== null) fail(`${r.id}: parents filled alongside guardian`);
  }
});

check('death records agree with the person', (fail) => {
  for (const r of records.death) {
    const p = person.get(r.personIds[0]);
    if (p.deathDate !== r.date) fail(`${r.id}: date`);
    if (r.details.age !== String(ageOn(p.birthDate, p.deathDate))) fail(`${r.id}: age`);
    if (r.details['burial-date'] <= r.details['death-date']) fail(`${r.id}: buried before dying`);
  }
});

check('registers contain nothing from before the parish existed', (fail) => {
  for (const f of families) {
    if (f.marriageRecordId && Number(f.weddingDate.slice(0, 4)) < REGISTER_START) fail(f.id);
  }
});

/* ---------- auto-fill scenarios ---------- */

check('scenario expectations hold when looked up again from scratch', (fail) => {
  const index = buildIndex(persons, records);
  const typeOf = {
    'Marriage Certificate': 'marriage', 'Baptismal Certificate': 'baptism', 'Confirmation Certificate': 'confirmation',
    'First Communion Certificate': 'first-communion', 'Death Certificate': 'death',
  };
  for (const s of scenarios) {
    const { input, expected } = s;
    if (input.check === 'wedding-eligibility') {
      const got = weddingCheck(person.get(input.groomId), person.get(input.brideId), input.proposedDate, { persons: person, unions: family });
      if (got.outcome !== expected.outcome) fail(`${s.id}: wedding ${got.outcome}`);
      continue;
    }
    const type = typeOf[input.certificateType];
    const typed = Object.values(input.typed)[0];
    const hits = findRecords(index, type, typed).map(r => r.id).sort();
    const want = [...expected.recordIds].sort();
    switch (expected.outcome) {
      case 'unique-match':
      case 'unique-match-with-warning':
      case 'partial-match':
        if (hits.join() !== want.join()) fail(`${s.id} (${s.category}): got ${hits}, want ${want}`);
        if (JSON.stringify(expected.autofill.details) !== JSON.stringify(recordById.get(want[0]).details)) fail(`${s.id}: autofill differs from record`);
        break;
      case 'multiple-matches':
      case 'duplicate-records':
        if (want.length < 2 || want.some(id => !hits.includes(id))) fail(`${s.id} (${s.category}): got ${hits}, want ${want}`);
        break;
      case 'no-record':
        if (hits.length) fail(`${s.id} (${s.category}): found ${hits}`);
        break;
      case 'no-person':
        if (hits.length) fail(`${s.id}: found ${hits}`);
        break;
      case 'variant-match':
        if (!want.every(id => hits.includes(id))) fail(`${s.id}: variant not linked`);
        if (!recordById.get(want[0]).dataQuality.variants.length) fail(`${s.id}: record has no variant`);
        break;
      case 'not-digitized':
        if (recordById.get(want[0]).status === 'digitized') fail(`${s.id}: already digitized`);
        break;
      case 'conflict':
        if (!person.get(input.requesterPersonId).deathDate) fail(`${s.id}: requester alive`);
        break;
      default:
        fail(`${s.id}: unknown outcome ${expected.outcome}`);
    }
  }
});

check('every scenario category has cases', (fail) => {
  const WANTED = ['marriage-groom-request', 'marriage-bride-married-name', 'marriage-remarried', 'marriage-nullity-note', 'marriage-elsewhere',
    'marriage-not-church', 'marriage-homonyms', 'marriage-father-son-same-name', 'baptism-twins', 'baptism-no-father', 'baptism-guardian', 'baptism-adult',
    'baptism-late', 'baptism-legitimated', 'baptism-married-woman', 'baptism-adopted', 'baptism-before-parish', 'baptism-elsewhere', 'legacy-spelling',
    'duplicate-entry', 'record-not-digitized', 'partial-record', 'confirmation-from-baptism', 'first-communion', 'death-by-relative', 'deceased-self-request',
    'no-such-person', 'wedding-already-married', 'wedding-widowed', 'wedding-after-nullity', 'wedding-first-cousins', 'wedding-siblings', 'wedding-underage',
    'wedding-party-deceased', 'wedding-allowed'];
  const have = new Set(scenarios.map(s => s.category));
  for (const c of WANTED) if (!have.has(c)) fail(`no cases for ${c}`);
});

/* ---------- what the app's own duplicate check does with this data ---------- */

async function appFindings() {
  const source = readFileSync(resolve(ROOT, 'Sacradigit/js/record-duplicates.js'), 'utf8')
    .replace(/^import \{ confirmDialog.*$/m, 'const confirmDialog = async () => true;')
    .replace(/^import \{ formatFullName.*$/m, "const formatFullName = (n) => (n ? [n.firstName, n.middleName, n.lastName, n.extension].filter(Boolean).join(' ') : '');");
  const { personKey, samePerson, duplicateIds, parentsByRecord, parentsFromDetails } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

  // Two runs: parents from released certificates only (what the app has today), and from every record.
  const linked = parentsByRecord(requests);
  const scored = (type, parentsOf) => {
    const rows = records[type].map(r => ({ id: r.id, type, fullName: r.parishRecord.fullName, dateOfEvent: r.parishRecord.dateOfEvent, duplicateOf: r.duplicateOf, parents: parentsOf(r) }));
    const flagged = duplicateIds(rows);
    const real = new Set(rows.filter(r => r.duplicateOf).flatMap(r => [r.id, r.duplicateOf]));
    return { falseAlarms: rows.filter(r => flagged.has(r.id) && !real.has(r.id)).length, realMissed: [...real].filter(id => !flagged.has(id)).length };
  };
  const parentRuns = {};
  for (const type of ['baptism', 'confirmation', 'marriage']) {
    parentRuns[type] = {
      noParents: scored(type, () => undefined),
      fromReleasedCertificates: scored(type, r => linked.get(r.id)),
      fromEveryRecord: scored(type, r => parentsFromDetails(r.details)),
    };
  }

  const byType = {};
  for (const type of ['baptism', 'confirmation', 'marriage', 'death']) {
    const rows = records[type].map(r => ({ id: r.id, type, fullName: r.parishRecord.fullName, dateOfEvent: r.parishRecord.dateOfEvent, duplicateOf: r.duplicateOf }));
    const flagged = duplicateIds(rows);
    const real = new Set(rows.filter(r => r.duplicateOf).flatMap(r => [r.id, r.duplicateOf]));
    const falseAlarms = rows.filter(r => flagged.has(r.id) && !real.has(r.id));
    byType[type] = {
      rows: rows.length,
      realDuplicateRows: real.size,
      realDuplicateRowsMissed: [...real].filter(id => !flagged.has(id)).length,
      falseAlarmRows: falseAlarms.length,
      examples: falseAlarms.slice(0, 3).map(r => `${r.fullName} (${r.dateOfEvent})`),
    };
  }

  // Different people the check would still treat as one: a clash in the name itself, not a missing part.
  const groups = new Map();
  for (const p of fullProfiles) {
    const key = personKey(formatName(p.currentName));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p.currentName);
  }
  const clash = (a, b) => samePerson(formatName(a), formatName(b)) && (
    a.lastName !== b.lastName
    || (a.middleName && b.middleName && a.middleName !== b.middleName)
    || (!a.firstName.startsWith(b.firstName) && !b.firstName.startsWith(a.firstName)));
  let clashes = 0;
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) if (clash(list[i], list[j])) clashes += 1;
    }
  }
  return { byType, parentRuns, linkedRecordsWithParents: linked.size, namePairsClashingButTreatedAsSame: clashes };
}

/* ---------- report ---------- */

console.log(`Checked ${persons.length} persons, ${families.length} families, ${allRecords.length} records, ${requests.length} requests, ${scenarios.length} scenarios.\n`);
for (const name of checksRun) {
  const problems = failures.get(name);
  console.log(`${problems ? 'FAIL' : ' ok '}  ${name}${problems ? `  (${problems.length})` : ''}`);
  if (problems) problems.slice(0, 6).forEach(p => console.log(`        ${p}`));
}

console.log('\nWhat the app\'s record-duplicates.js does with this data:');
console.log(JSON.stringify(await appFindings(), null, 2));

if (failures.size) {
  console.log(`\n${failures.size} of ${checksRun.length} checks failed.`);
  process.exit(1);
}
console.log(`\nAll ${checksRun.length} checks passed.`);
