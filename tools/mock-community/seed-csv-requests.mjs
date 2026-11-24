/* Builds Sacradigit/js/seed-data/csv-certificate-requests.json
 *
 * Takes the fake-account CSV (who the mock parishioners are) and the mock
 * community in mock-data/ (run generate.mjs first), and keeps only the
 * certificate requests made by people in the CSV, each with the register
 * entry (ParishRecord) it points to. The admin page seed-mock-certificate-requests.html
 * writes these into the database.
 *
 *   node tools/mock-community/seed-csv-requests.mjs "C:/Users/<you>/Downloads/fake-account-candidates.csv"
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const csvPath = process.argv[2];
if (!csvPath) { console.error('Usage: node seed-csv-requests.mjs <fake-account-candidates.csv>'); process.exit(1); }

const readJson = (f) => JSON.parse(readFileSync(resolve(root, 'mock-data', f), 'utf8'));

// The CSV is quoted on every cell and has no embedded quotes or commas.
const lines = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const header = lines[0].split(',').map(h => h.replace(/"/g, ''));
const accounts = new Map();
for (const line of lines.slice(1)) {
  const cells = line.slice(1, -1).split('","');
  const row = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  accounts.set(row.person_id, row);
}

const requests = readJson('certificate-requests.json').filter(r => accounts.has(r.mockLinks?.requesterPersonId));
const persons = new Map(readJson('persons.json').map(p => [p.id, p]));
const registers = new Map();
for (const f of ['baptism', 'confirmation', 'first-communion', 'marriage', 'death']) {
  for (const rec of readJson(`records-${f}.json`)) registers.set(rec.id, rec);
}

const records = new Map(); // register id -> row for the ParishRecord table
const out = [];
for (const r of requests) {
  const acct = accounts.get(r.mockLinks.requesterPersonId);
  const reg = registers.get(r.mockLinks.recordId);
  if (reg && !records.has(reg.id)) {
    const subject = persons.get(r.mockLinks.subjectPersonId);
    const pr = reg.parishRecord;
    records.set(reg.id, {
      key: reg.id,
      type: pr.type,
      fullName: pr.fullName,
      dateOfEvent: pr.dateOfEvent,
      officiant: pr.officiant,
      status: pr.status,
      addedByName: pr.addedByName,
      // verifyRecord compares this; marriage entries have no single birthdate.
      birthdate: pr.type === 'marriage' ? null : (subject?.birthDate || null),
    });
  }
  const details = JSON.parse(r.details);
  details['Verified Against Record'] = 'Yes';
  out.push({
    requesterName: acct.full_name,
    email: acct.email,
    certificateType: r.certificateType,
    purpose: r.purpose,
    notes: r.notes || null,
    details,
    status: r.status,
    rejectionReason: r.rejectionReason || null,
    recordKey: reg ? reg.id : null,
    mock: { person: acct.person_id, request: r.id },
  });
}

const dir = resolve(root, 'Sacradigit/js/seed-data');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'csv-certificate-requests.json'), JSON.stringify({ records: [...records.values()], requests: out }));
console.log(`${accounts.size} accounts in the CSV -> ${out.length} requests by ${new Set(out.map(o => o.mock.person)).size} people, ${records.size} register entries`);
