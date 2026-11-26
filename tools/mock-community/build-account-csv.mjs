/* Rebuilds mock-data/fake-account-candidates.csv with the full sacramental
 * picture of each account: baptism, confirmation, first communion, parents,
 * and the spouse / marriage, all on the same row.
 *
 * The first 10 columns are unchanged (seed-csv-requests.mjs reads them by
 * name), so the new columns are appended at the end.
 *
 *   node tools/mock-community/generate.mjs                 # once: builds the JSON
 *   node tools/mock-community/build-account-csv.mjs        # reads + rewrites the CSV
 *   node tools/mock-community/build-account-csv.mjs --data some/folder --csv in.csv --out out.csv
 *
 * Which people are in the CSV is decided by the existing file (person_id
 * column); this script only fills in the rest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dataDir = resolve(root, flag('data', 'mock-data'));
const csvIn = resolve(root, flag('csv', 'mock-data/fake-account-candidates.csv'));
const csvOut = resolve(root, flag('out', csvIn));

const readJson = (f) => JSON.parse(readFileSync(resolve(dataDir, f), 'utf8'));

// --- read the existing CSV (every cell quoted, no embedded quotes) ---------
const lines = readFileSync(csvIn, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
const parseLine = (l) => l.slice(1, -1).split('","');
const BASE = parseLine(lines[0]).slice(0, 10); // family … mobile
const accounts = lines.slice(1).map((l) => {
  const c = parseLine(l);
  return Object.fromEntries(BASE.map((h, i) => [h, c[i]]));
});

// --- lookups ---------------------------------------------------------------
const persons = new Map(readJson('persons.json').map((p) => [p.id, p]));
const unions = new Map(readJson('families.json').map((u) => [u.id, u]));

const PARISH = 'Our Lady of Fatima Parish'; // the parish whose registers these are
// Sacrament registers: person id -> first non-duplicate record.
const byPerson = (file) => {
  const m = new Map();
  for (const r of readJson(file)) {
    if (r.duplicateOf) continue; // a double entry points at the original
    for (const pid of r.personIds || []) if (!m.has(pid)) m.set(pid, r);
  }
  return m;
};
const baptisms = byPerson('records-baptism.json');
const confirmations = byPerson('records-confirmation.json');
const communions = byPerson('records-first-communion.json');
const marriageByUnion = new Map();
for (const r of readJson('records-marriage.json')) {
  if (r.duplicateOf || !r.unionId) continue;
  if (!marriageByUnion.has(r.unionId)) marriageByUnion.set(r.unionId, r);
}

const nameOf = (n) => (n ? [n.firstName, n.middleName, n.lastName, n.extension].filter(Boolean).join(' ') : '');
const personName = (id) => {
  const p = id && persons.get(id);
  return p ? nameOf(p.currentName) : '';
};

// --- per-person pieces -----------------------------------------------------
function sacrament(rec, elsewhere) {
  if (rec) return { date: rec.date || '', place: PARISH, id: rec.id };
  if (elsewhere) return { date: elsewhere.date || '', place: elsewhere.church || '', id: '' };
  return { date: '', place: '', id: '' };
}

// A person can have several unions (widowed, annulled, remarried). Show the
// one that is current; otherwise the most recent one.
function pickUnion(p) {
  const list = (p.unionIds || []).map((id) => unions.get(id)).filter(Boolean);
  if (!list.length) return null;
  const open = list.filter((u) => !u.endDate);
  const pool = open.length ? open : list;
  return pool.sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0];
}

const kindLabel = { church: 'church', civil: 'civil', 'live-in': 'live-in' };
function unionStatus(u) {
  if (!u) return '';
  if (!u.endDate) return 'active';
  return u.endReason || 'ended';
}

const NEW = [
  'father_name', 'mother_name',
  'baptism_date', 'baptism_church', 'baptism_record_id',
  'confirmation_date', 'confirmation_church',
  'first_communion_date', 'first_communion_church',
  'spouse_person_id', 'spouse_name',
  'union_type', 'union_status',
  'marriage_date', 'marriage_place', 'marriage_record_id',
  'total_unions',
];

const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const out = [[...BASE, ...NEW].map(quote).join(',')];
const stats = { baptism: 0, confirmation: 0, communion: 0, spouse: 0, marriageDate: 0, missing: 0 };

for (const a of accounts) {
  const p = persons.get(a.person_id);
  if (!p) { stats.missing += 1; out.push([...BASE.map((h) => a[h]), ...NEW.map(() => '')].map(quote).join(',')); continue; }

  const bap = sacrament(baptisms.get(p.id), p.baptizedElsewhere);
  const con = sacrament(confirmations.get(p.id), p.confirmedElsewhere);
  const fhc = sacrament(communions.get(p.id), p.firstCommunionElsewhere);
  const u = pickUnion(p);
  const spouseId = u ? (u.husbandId === p.id ? u.wifeId : u.husbandId) : '';
  const mar = u ? marriageByUnion.get(u.id) : null;
  // Live-in couples never had a wedding, so the date stays blank for them.
  const weddingDate = u && u.kind !== 'live-in' ? (mar?.date || u.weddingDate || '') : '';
  const weddingPlace = u && u.kind !== 'live-in' ? (mar?.details?.['marriage-place'] || u.weddingPlace || '') : '';

  if (bap.date) stats.baptism += 1;
  if (con.date) stats.confirmation += 1;
  if (fhc.date) stats.communion += 1;
  if (spouseId) stats.spouse += 1;
  if (weddingDate) stats.marriageDate += 1;

  const extra = [
    personName(p.fatherId), personName(p.motherId),
    bap.date, bap.place, bap.id,
    con.date, con.place,
    fhc.date, fhc.place,
    spouseId || '', personName(spouseId),
    u ? kindLabel[u.kind] || u.kind : '', unionStatus(u),
    weddingDate, weddingPlace, mar?.id || '',
    (p.unionIds || []).length || '',
  ];
  out.push([...BASE.map((h) => a[h]), ...extra].map(quote).join(','));
}

writeFileSync(csvOut, `﻿${out.join('\r\n')}\r\n`); // BOM so Excel opens Filipino letters (ñ) correctly
const n = accounts.length;
console.log(`${n} accounts -> ${csvOut}`);
console.log(`  baptism date        ${stats.baptism}/${n}`);
console.log(`  confirmation date   ${stats.confirmation}/${n}`);
console.log(`  first communion     ${stats.communion}/${n}`);
console.log(`  spouse              ${stats.spouse}/${n}`);
console.log(`  marriage date       ${stats.marriageDate}/${n}`);
if (stats.missing) console.log(`  person_id not found ${stats.missing}  (row left with blank new columns)`);
