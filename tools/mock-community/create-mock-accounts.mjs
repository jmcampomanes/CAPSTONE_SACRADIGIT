#!/usr/bin/env node
/* ============================================
   Creates real sign-in accounts (Cognito users) for people in
   fake-account-candidates.csv, so a demo can sign in as them.

   The mock community itself has no accounts (mock-data/README.md);
   this is the one script that adds some. Every account gets the same
   demo password, its email marked verified (no code is sent), and no
   group, so it signs in as a normal parishioner.

   Safe by default: with no --send it only prints what it would create.

     node tools/mock-community/create-mock-accounts.mjs --demo
     node tools/mock-community/create-mock-accounts.mjs --limit 20
     node tools/mock-community/create-mock-accounts.mjs --emails a@mock-sacradigit.test,b@mock-sacradigit.test

   To really create them (needs AWS admin credentials in the usual
   places: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or an AWS_PROFILE,
   allowed to do cognito-idp:AdminCreateUser / AdminSetUserPassword):

     node tools/mock-community/create-mock-accounts.mjs --demo --send --outputs path/to/sandbox/amplify_outputs.json

   Remove them again with --delete (same flags, plus --send).

   Use a SANDBOX backend. The repo's own amplify_outputs.json is the
   production pool and is refused unless you add --production.

   Other flags:  --csv <file>   --password <text>   (or env MOCK_PASSWORD)
   ============================================ */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const SEND = flag('send');
const DELETE = flag('delete');
const PASSWORD = opt('password') || process.env.MOCK_PASSWORD || 'Sacra-Demo-2026!';

// The accounts the demo cheat sheet uses, plus the people those requests belong to.
const DEMO_EMAILS = [
  'ian.rodriguez.p07977', 'raul.gerona.p03230', 'victor.quimbo.p04081', 'belen.ocampo.p06831',
  'candida.duque.p04399', 'marialuisa.mendoza.p00804', 'bernadette.rubio.p04843', 'alvin.gonzales.p01408',
].map(e => `${e}@mock-sacradigit.test`);

/* ---------- read the CSV ---------- */
const csvPath = opt('csv') || [
  resolve(homedir(), 'Downloads', 'fake-account-candidates-enriched.csv'),
  resolve(homedir(), 'Downloads', 'fake-account-candidates.csv'),
  resolve(ROOT, 'mock-data', 'fake-account-candidates.csv'),
].find(existsSync);
if (!csvPath || !existsSync(csvPath)) { console.error('Could not find the CSV. Pass --csv <file>.'); process.exit(1); }

const lines = readFileSync(csvPath, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
const header = lines[0].slice(1, -1).split('","');
const seen = new Set();
let people = lines.slice(1).map(l => Object.fromEntries(l.slice(1, -1).split('","').map((v, i) => [header[i], v])))
  .filter(p => p.email && !seen.has(p.email) && seen.add(p.email)); // the CSV repeats a few people

if (opt('emails')) { const want = new Set(opt('emails').split(',').map(s => s.trim().toLowerCase())); people = people.filter(p => want.has(p.email)); }
else if (flag('demo')) people = people.filter(p => DEMO_EMAILS.includes(p.email));
else people = people.slice(0, Number(opt('limit') || 10));

/* First/last name for the account. The CSV's `family` column is the surname. */
function splitName(p) {
  const full = p.full_name.trim();
  const fam = (p.family || '').trim();
  const stripped = full.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '');
  for (const candidate of [full, stripped]) {
    if (fam && candidate.toLowerCase().endsWith(` ${fam.toLowerCase()}`)) {
      return { given: candidate.slice(0, candidate.length - fam.length).trim(), family: fam };
    }
  }
  const parts = stripped.split(/\s+/);
  return { given: parts.slice(0, -1).join(' ') || parts[0], family: parts.length > 1 ? parts[parts.length - 1] : fam };
}

console.log(`${DELETE ? 'Delete' : 'Create'} ${people.length} account(s) from ${csvPath}`);
people.slice(0, 12).forEach(p => console.log(`  ${p.email}   ${p.full_name}`));
if (people.length > 12) console.log(`  … and ${people.length - 12} more`);
if (!people.length) process.exit(0);

if (!SEND) {
  console.log(`\nDry run. Nothing was sent. Password for every account: ${PASSWORD}`);
  console.log('Add --send --outputs <sandbox amplify_outputs.json> to do it for real.');
  process.exit(0);
}

/* ---------- send ---------- */
const outputsPath = opt('outputs') && resolve(opt('outputs'));
if (!outputsPath || !existsSync(outputsPath)) { console.error('--send needs --outputs <amplify_outputs.json of a SANDBOX backend>.'); process.exit(1); }
if (outputsPath === resolve(ROOT, 'amplify_outputs.json') && !flag('production')) {
  console.error('That is this repo\'s own amplify_outputs.json, the PRODUCTION pool. Use a sandbox outputs file.\nTo do it anyway: add --production.');
  process.exit(1);
}
const { user_pool_id: poolId, aws_region: region } = JSON.parse(readFileSync(outputsPath, 'utf8')).auth;
console.log(`\nUser pool ${poolId} (${region})`);

const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminDeleteUserCommand } =
  await import('@aws-sdk/client-cognito-identity-provider');
const cognito = new CognitoIdentityProviderClient({ region });

let ok = 0, skipped = 0, failed = 0;
for (const p of people) {
  try {
    if (DELETE) {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: p.email }));
    } else {
      const { given, family } = splitName(p);
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: poolId, Username: p.email, MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: p.email }, { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: given }, { Name: 'family_name', Value: family },
        ],
      }));
      await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: p.email, Password: PASSWORD, Permanent: true }));
    }
    ok++; console.log(`  ✓ ${p.email}`);
  } catch (err) {
    if (err.name === 'UsernameExistsException') { skipped++; console.log(`  - ${p.email} already exists`); }
    else if (err.name === 'UserNotFoundException') { skipped++; console.log(`  - ${p.email} not found`); }
    else { failed++; console.log(`  ✗ ${p.email}: ${err.message}`); }
  }
}
console.log(`\n${ok} ${DELETE ? 'deleted' : 'created'}, ${skipped} skipped, ${failed} failed.`);
if (!DELETE && ok) console.log(`Sign in with the email and the password: ${PASSWORD}`);
process.exit(failed ? 1 : 0);
