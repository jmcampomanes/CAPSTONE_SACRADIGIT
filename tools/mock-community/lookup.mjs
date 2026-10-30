/* ============================================
   Mock community — reference record lookup
   A small, plain matcher for the auto-fill tests. The
   generator uses it to choose scenarios and validate.mjs
   uses it to check them, so "exactly one record matches"
   is verified rather than assumed.

   It finds people by any name they have ever held
   (birth, married, legitimated, adopted), then returns
   that person's records of the requested type.
   ============================================ */

export const stripAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

const SUFFIX = /\b(jr|sr|ii|iii|iv|v)\b\.?/g;

/** Lower-case, unaccented, letters only: "De la Cruz" and "Dela Cruz" both give "delacruz". */
export const squash = (s) => stripAccents(s).toLowerCase().replace(SUFFIX, '').replace(/[^a-z]/g, '');

/** "Ma." and "Ma" are the usual register shorthand for Maria. */
const firstKey = (s) => {
  const words = stripAccents(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words[0] === 'ma' ? 'maria' : words[0];
};

/** First given name + whole surname. Middle names and suffixes never count. */
export const nameKey = (n) => `${firstKey(n?.firstName)}|${squash(n?.lastName)}`;

function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swapped letters
  }
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  return longer.slice(i + 1) === shorter.slice(i);
}

/** Builds name → person lookups once, because this runs thousands of times. */
export function buildIndex(persons, recordsByType) {
  const byKey = new Map();
  for (const p of persons) {
    const seen = new Set();
    for (const entry of p.nameHistory) {
      const key = nameKey(entry.name);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(p);
    }
  }
  const recordsOf = new Map();
  for (const [type, records] of Object.entries(recordsByType)) {
    for (const r of records) {
      for (const id of r.personIds) {
        const key = `${type}|${id}`;
        if (!recordsOf.has(key)) recordsOf.set(key, []);
        recordsOf.get(key).push(r);
      }
    }
  }
  return { byKey, recordsOf, keys: [...byKey.keys()] };
}

/** People whose past or present name matches what was typed. `fuzzy` allows one wrong letter in the surname. */
export function findPersons(index, typedName, { fuzzy = false } = {}) {
  const key = nameKey(typedName);
  const exact = index.byKey.get(key) || [];
  if (exact.length || !fuzzy) return exact;
  const [first, last] = key.split('|');
  const near = [];
  for (const k of index.keys) {
    const [f, l] = k.split('|');
    if (f === first && editDistanceAtMostOne(l, last)) near.push(...index.byKey.get(k));
  }
  return near;
}

/**
 * Reference answer to "can this couple marry on this date?".
 * `ctx` holds { persons, unions } as Maps keyed by id.
 */
export function weddingCheck(groom, bride, date, { persons, unions }) {
  const reasons = [];
  const parents = (p) => [p.fatherId, p.motherId].filter(Boolean);
  const ageOn = (p) => {
    const years = Number(date.slice(0, 4)) - Number(p.birthDate.slice(0, 4));
    return date.slice(5) >= p.birthDate.slice(5) ? years : years - 1;
  };
  for (const p of [groom, bride]) {
    if (p.deathDate) reasons.push({ code: 'party-deceased', personId: p.id });
    else if (ageOn(p) < 18) reasons.push({ code: 'under-18', personId: p.id });
    const standing = p.unionIds.map(id => unions.get(id)).find(u => !u.endDate);
    if (standing && standing.kind !== 'live-in') reasons.push({ code: 'already-married', personId: p.id, unionId: standing.id });
  }
  const sharedParent = parents(groom).some(id => parents(bride).includes(id));
  const grandparents = (p) => parents(p).flatMap(id => parents(persons.get(id)));
  const sharedGrandparent = grandparents(groom).some(id => grandparents(bride).includes(id));
  if (sharedParent) reasons.push({ code: 'siblings' });
  else if (sharedGrandparent) reasons.push({ code: 'first-cousins' });

  const notes = [groom, bride].flatMap(p => p.unionIds.map(id => unions.get(id))
    .filter(u => u.endReason === 'declaration-of-nullity').map(u => ({ code: 'requires-nullity-papers', personId: p.id, unionId: u.id })));
  return { outcome: reasons.length ? 'blocked' : 'allowed', reasons: [...reasons, ...notes] };
}

/** Records of `type` belonging to anyone matching the typed name. */
export function findRecords(index, type, typedName, opts) {
  const out = new Map();
  for (const p of findPersons(index, typedName, opts)) {
    for (const r of index.recordsOf.get(`${type}|${p.id}`) || []) out.set(r.id, r);
  }
  return [...out.values()];
}
