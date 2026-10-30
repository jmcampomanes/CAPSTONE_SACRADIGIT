/* ============================================
   SacraDigit Admin — duplicate parish records
   Warns the Secretary before saving a record that
   looks like one already in Digital Archives, and
   flags existing look-alikes in the table.

   Two records "look alike" when they are the same
   record type and the same person: same first name
   and whole surname (so Dela Cruz is not Cruz),
   ignoring capitals, accents and punctuation. Middle
   names must not contradict: "Juan M. Cruz" and
   "Juan Cruz" can be one person, but "Juan Santos Cruz"
   and "Juan Reyes Cruz" cannot. Neither can Jr. and Sr.
   When both have a date of event, the dates must match
   too — two people can share a name, but not also the
   same baptism day.

   Marriage records hold "Groom & Bride"; each spouse
   is compared separately.

   Parents settle the rest: same name and date but a
   different father or mother means two people. A
   ParishRecord has no parent columns, so rows carry an
   optional `parents` list (one { father, mother } per
   person named) filled by parentsByRecord() from
   released certificates. An unknown parent proves
   nothing, so the warning stays until both sides are
   known.

   Used by digital-archives.js (New Record, Upload,
   Edit) and scanner/scan-screen.js (Scan Document).
   ============================================ */

import { confirmDialog } from './admin-ui.js';
import { formatFullName } from '../../shared/js/name-utils.js';

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const PARTICLES = new Set(['de', 'del', 'dela', 'delos', 'delas', 'la', 'las', 'los', 'san', 'santa', 'santo', 'sta', 'sto']);

/** "Juan M. Dela Cruz Jr." → { first: 'juan', rest: ['m'], surname: 'delacruz', suffix: 'jr' }. */
function parseName(fullName) {
  const all = (fullName || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/).filter(Boolean);
  const words = all.filter(w => !SUFFIXES.has(w));
  if (!words.length) return null;
  let start = words.length - 1;
  while (start > 1 && PARTICLES.has(words[start - 1])) start -= 1;
  return {
    first: words[0] === 'ma' ? 'maria' : words[0], // "Ma." is the register's shorthand for Maria
    rest: words.slice(1, start).reduce((out, w, i, list) => {
      if (i && PARTICLES.has(list[i - 1])) out[out.length - 1] += w; // "de castro" is one middle name
      else out.push(w);
      return out;
    }, []),
    surname: words.slice(start).join(''),
    suffix: all.find(w => SUFFIXES.has(w)) || '',
  };
}

const sameWord = (a, b) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/** True when one list of middle words fits inside the other, in order (an initial fits its full word). */
function restFits(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let at = 0;
  return short.every(word => {
    while (at < long.length && !sameWord(word, long[at])) at += 1;
    at += 1;
    return at <= long.length;
  });
}

function sameName(a, b) {
  const x = parseName(a);
  const y = parseName(b);
  if (!x || !y || x.first !== y.first || x.surname !== y.surname) return false;
  if (x.suffix && y.suffix && x.suffix !== y.suffix) return false;
  return restFits(x.rest, y.rest);
}

const spouses = (fullName) => (fullName || '').split('&').map(s => s.trim()).filter(Boolean);

/** Could these two names be the same person (or, for "Groom & Bride", the same couple)? */
export function samePerson(a, b) {
  const x = spouses(a);
  const y = spouses(b);
  if (x.length !== y.length || !x.length) return false;
  if (x.length === 1) return sameName(x[0], y[0]);
  return (sameName(x[0], y[0]) && sameName(x[1], y[1])) || (sameName(x[0], y[1]) && sameName(x[1], y[0]));
}

const clashes = (a, b) => !!a && !!b && !sameName(a, b);

/** True when two same-named records name a different father or mother for the same person. */
function parentsDiffer(a, b) {
  const others = spouses(b.fullName);
  return spouses(a.fullName).some((name, i) => {
    const mine = a.parents?.[i];
    const theirs = b.parents?.[others.findIndex(n => sameName(name, n))];
    return !!mine && !!theirs && (clashes(mine.father, theirs.father) || clashes(mine.mother, theirs.mother));
  });
}

/** Parents named in a certificate request's details, one entry per person on the record. */
export function parentsFromDetails(details) {
  const pair = (father, mother) => ({ father: formatFullName(father), mother: formatFullName(mother) });
  if (details?.['groom-name']) {
    return [pair(details['groom-father'], details['groom-mother']), pair(details['bride-father'], details['bride-mother'])];
  }
  return details?.['father-name'] || details?.['mother-name'] ? [pair(details['father-name'], details['mother-name'])] : null;
}

/** Record id → parents, from certificate requests linked to a record. */
export function parentsByRecord(requests) {
  const out = new Map();
  for (const q of requests) {
    if (!q.linkedRecordId || !q.details) continue;
    let details;
    try { details = JSON.parse(q.details); } catch { continue; }
    const parents = parentsFromDetails(details);
    if (parents) out.set(q.linkedRecordId, parents);
  }
  return out;
}

/** "Juan M. Dela Cruz Jr." → "juan|delacruz". Records with different keys are never the same person. */
export function personKey(fullName) {
  return spouses(fullName).map(parseName).filter(Boolean)
    .map(n => `${n.first}|${n.surname}`).sort().join('+');
}

/** Existing records that look like `candidate` ({ fullName, type, dateOfEvent }). */
export function findDuplicates(records, candidate, { excludeId } = {}) {
  if (!personKey(candidate.fullName)) return [];
  const type = (candidate.type || '').toLowerCase();
  return records.filter(r =>
    r.id !== excludeId &&
    (r.type || '').toLowerCase() === type &&
    samePerson(r.fullName, candidate.fullName) &&
    !parentsDiffer(r, candidate) &&
    (!r.dateOfEvent || !candidate.dateOfEvent || r.dateOfEvent === candidate.dateOfEvent));
}

/** Ids of records that have at least one look-alike, for flagging rows. */
export function duplicateIds(records) {
  const groups = new Map();
  for (const r of records) {
    const key = `${(r.type || '').toLowerCase()}#${personKey(r.fullName)}`;
    if (!personKey(r.fullName)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const ids = new Set();
  for (const list of groups.values()) {
    for (const r of list) {
      if (list.some(o => o !== r && samePerson(o.fullName, r.fullName) && !parentsDiffer(o, r) && (!o.dateOfEvent || !r.dateOfEvent || o.dateOfEvent === r.dateOfEvent))) ids.add(r.id);
    }
  }
  return ids;
}

const fmt = (iso) => (iso ? new Date(iso.length > 10 ? iso : iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/**
 * True when it's fine to save: no look-alikes, or the Secretary confirms
 * it's a different person / a deliberate second copy.
 */
export async function confirmNotDuplicate(records, candidate, options) {
  const matches = findDuplicates(records, candidate, options);
  if (!matches.length) return true;
  const lines = matches.slice(0, 3).map(r => {
    const bits = [r.fullName];
    if (r.dateOfEvent) bits.push(`event ${fmt(r.dateOfEvent)}`);
    const parents = r.parents?.[0];
    if (parents) bits.push(`parents ${[parents.father, parents.mother].filter(Boolean).join(' and ')}`);
    bits.push(`added ${fmt(r.createdAt)}${r.addedByName ? ` by ${r.addedByName}` : ''}`);
    return `• ${bits.join(' — ')}`;
  });
  const more = matches.length > 3 ? `\n…and ${matches.length - 3} more` : '';
  return confirmDialog({
    title: 'This might already be in the archive',
    message: `This ${candidate.type} record looks like ${matches.length === 1 ? 'one' : `${matches.length}`} already saved:`,
    detail: `${lines.join('\n')}${more}`,
    confirmLabel: 'Save anyway',
    cancelLabel: 'Go back',
  });
}
