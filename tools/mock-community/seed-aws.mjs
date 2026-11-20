#!/usr/bin/env node
/* ============================================
   Loads the mock community into the MockParishioner
   table (mock_data) in AWS.

   Safe by default: with no flags it only BUILDS the rows
   and prints a summary. Nothing is sent anywhere until you
   pass --send. It never touches Cognito accounts, roles,
   ParishRecord or any other table.

     node tools/mock-community/generate.mjs                 (once, makes mock-data/*.json)
     node tools/mock-community/seed-aws.mjs                 dry run: counts + one sample row
     node tools/mock-community/seed-aws.mjs --limit 50 --send --outputs path/to/amplify_outputs.json

   --send needs a SANDBOX or test backend's outputs file and
   an admin or staff test account:
     SEED_USERNAME=... SEED_PASSWORD=... node tools/mock-community/seed-aws.mjs --send --outputs ...

   Re-running is safe: a row that already exists is updated.
   Rows keep the generator's ids (P00033, ...), so family
   links stay valid and a second run never makes duplicates.
   ============================================ */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMockParishionerRows } from './mock-parishioner-rows.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const DATA = resolve(ROOT, flag('data', 'mock-data'));
const LIMIT = Number(flag('limit', 0)) || Infinity;
const CONCURRENCY = Number(flag('concurrency', 8));
const SEND = has('send');

const load = (file) => JSON.parse(readFileSync(resolve(DATA, file), 'utf8'));
const asList = (v, ...keys) => (Array.isArray(v) ? v : keys.map(k => v[k]).find(Array.isArray) || Object.values(v));

let persons, unions, households, records;
try {
  persons = asList(load('persons.json'), 'persons');
  unions = asList(load('families.json'), 'families');
  households = asList(load('households.json'), 'households');
  records = ['baptism', 'confirmation', 'first-communion', 'marriage', 'death']
    .flatMap(t => asList(load(`records-${t}.json`), 'records'));
} catch (err) {
  console.error(`Couldn't read the mock data in ${DATA}: ${err.message}`);
  console.error('Run:  node tools/mock-community/generate.mjs');
  process.exit(1);
}

const rows = buildMockParishionerRows({ persons, unions, households, records }).slice(0, LIMIT);
const size = (o) => Buffer.byteLength(JSON.stringify(o));
const biggest = rows.reduce((m, r) => Math.max(m, size(r)), 0);

console.log(`Built ${rows.length} MockParishioner rows from ${persons.length} people.`);
console.log(`Largest row: ${(biggest / 1024).toFixed(1)} KB (DynamoDB's limit is 400 KB).`);
console.log(`With a mother and father: ${rows.filter(r => r.family.father && r.family.mother).length}`);
console.log(`With a spouse:            ${rows.filter(r => r.family.spouses.length).length}`);
console.log(`With children:            ${rows.filter(r => r.family.children.length).length}`);
if (biggest > 380 * 1024) { console.error('A row is too close to the 400 KB limit.'); process.exit(1); }

if (!SEND) {
  const sample = rows.find(r => r.family.spouses.length && r.family.children.length && r.family.father) || rows[0];
  console.log('\nSample row:\n' + JSON.stringify(sample, null, 2).slice(0, 2500));
  console.log('\nDry run only. Add --send --outputs <amplify_outputs.json> to upload.');
  process.exit(0);
}

/* ---------- upload ---------- */

const outputsPath = flag('outputs');
if (!outputsPath) { console.error('--send needs --outputs <path to the TEST backend\'s amplify_outputs.json>'); process.exit(1); }
const { SEED_USERNAME, SEED_PASSWORD } = process.env;
if (!SEED_USERNAME || !SEED_PASSWORD) { console.error('Set SEED_USERNAME and SEED_PASSWORD (an admin or staff test account).'); process.exit(1); }

const outputs = JSON.parse(readFileSync(resolve(outputsPath), 'utf8'));
console.log(`\nSending to ${outputs.data?.url || '(unknown API)'}  [region ${outputs.data?.aws_region || '?'}]`);
if (!has('yes') && !/sandbox|test|dev/i.test(JSON.stringify(outputs.data?.url || ''))) {
  console.log('This URL does not say sandbox/test/dev. The rows are fake, but add --yes if you are sure this is the right backend.');
  process.exit(1);
}

const { Amplify } = await import('aws-amplify');
const { generateClient } = await import('aws-amplify/data');
const { signIn } = await import('aws-amplify/auth');
Amplify.configure(outputs);
await signIn({ username: SEED_USERNAME, password: SEED_PASSWORD });
const client = generateClient();

// a.json() fields travel as JSON text
const toWire = (r) => ({ ...r, family: JSON.stringify(r.family), sacraments: r.sacraments ? JSON.stringify(r.sacraments) : null });

async function save(row) {
  const wire = toWire(row);
  for (let attempt = 1; attempt <= 5; attempt++) {
    // a thrown error (not just a returned one) counts too, so it can be retried
    const res = await client.models.MockParishioner.create(wire).catch(e => ({ errors: [{ message: e?.message || String(e) }] }));
    if (!res.errors?.length) return 'created';
    const msg = res.errors.map(e => e.message).join('; ');
    if (/already exists|conditional/i.test(msg)) {
      const up = await client.models.MockParishioner.update(wire);
      if (!up.errors?.length) return 'updated';
      throw new Error(up.errors.map(e => e.message).join('; '));
    }
    // throttling, or a sign-in token being refreshed by another request at the same moment
    if (/throttl|rate|capacity|limit|no current user|token/i.test(msg) && attempt < 5) { await new Promise(r => setTimeout(r, 400 * attempt)); continue; }
    throw new Error(msg);
  }
}

let done = 0, created = 0, updated = 0, failed = 0;
const queue = [...rows];
const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const row = queue.shift();
    try { (await save(row)) === 'created' ? created++ : updated++; }
    catch (err) { failed++; if (failed <= 5) console.error(`  ${row.id} ${row.firstName} ${row.lastName}: ${err.message}`); }
    if (++done % 500 === 0) console.log(`  ${done}/${rows.length}  (${Math.round((Date.now() - started) / 1000)}s)`);
  }
}));

console.log(`\nDone. created ${created}, updated ${updated}, failed ${failed}.`);
process.exit(failed ? 1 : 0);
