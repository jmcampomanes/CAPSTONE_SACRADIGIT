/* ============================================
   SacraDigit Admin — build families from the records.

   The database has no "family" table. A family is worked
   out from what the parish has already written down:
     - a marriage record ("A & B")  → A and B are a couple
     - a request naming a person's father and mother
       (baptism, confirmation, first communion)   → the child
       belongs to that couple
     - a marriage request                         → the groom and
       bride are a couple, and each is a child of the parents
       named for them
   People joined by any of these form one family. Anyone with no
   such link is listed separately, grouped by surname.
   Pure functions: no page, no network.
   ============================================ */

import { splitName } from './scanner/scan-engine.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const nameOk = (n) => !!(n && n.firstName && n.lastName);
const display = (n) => [n.firstName, n.middleName, n.lastName, n.extension].map((s) => (s || '').trim()).filter(Boolean).join(' ');
const keyOf = (n) => `${norm(n.firstName)}|${norm(n.lastName).replace(/ /g, '')}`;

const CHILD_KEYS = ['baptized-name', 'confirmed-name', 'fc-name'];
const TYPE_LABEL = { baptism: 'Baptism', confirmation: 'Confirmation', 'first-communion': 'First Communion', marriage: 'Marriage', death: 'Death' };

export function detailsOf(request) {
  try { return (typeof request.details === 'string' ? JSON.parse(request.details) : request.details) || {}; } catch { return {}; }
}

/** details values that are a { firstName, lastName… } object. */
const asName = (v) => (v && typeof v === 'object' && nameOk(v) ? { firstName: v.firstName, middleName: v.middleName || '', lastName: v.lastName, extension: v.extension || '' } : null);

/**
 * records: ParishRecord rows; requests: CertificateRequest rows.
 * Returns { families, singles, people } where
 *   families: [{ id, name, members: [{ name, roles, records }], couples, recordCount }]
 *   singles:  [{ surname, members: [{ name, roles, records }] }]
 */
export function buildFamilies(records = [], requests = []) {
  const people = new Map(); // key → { key, name, roles:Set, records:[] }
  const parent = new Map(); // union-find over keys
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const linked = new Set();

  const person = (n, role) => {
    const k = keyOf(n);
    let p = people.get(k);
    if (!p) { p = { key: k, name: display(n), parts: n, roles: new Set(), records: [] }; people.set(k, p); parent.set(k, k); }
    if (role) p.roles.add(role);
    return p;
  };
  const link = (a, b) => { union(a.key, b.key); linked.add(a.key); linked.add(b.key); };
  const couple = (a, b) => { if (a && b) { link(a, b); } };
  const child = (c, father, mother) => { for (const par of [father, mother]) if (c && par) link(c, par); };
  const addRecord = (p, rec) => { if (!p.records.some((r) => r.id === rec.id)) p.records.push(rec); };

  // 1. Archive records: marriages join two people; every record belongs to its person.
  for (const r of records) {
    const pieces = String(r.fullName || '').split(/\s*&\s*/).map(splitName).filter(nameOk);
    const label = TYPE_LABEL[r.type] || (r.type ? r.type[0].toUpperCase() + r.type.slice(1) : 'Record');
    const rec = { id: `r:${r.id || r.fullName}:${r.type}`, label, date: r.dateOfEvent || '', hasFile: !!r.fileURL };
    const ps = pieces.map((n) => person(n, r.type === 'marriage' ? 'Spouse' : ''));
    ps.forEach((p) => addRecord(p, rec));
    if (r.type === 'marriage' && ps.length === 2) couple(ps[0], ps[1]);
  }

  // 2. Requests: who the parents are.
  for (const q of requests) {
    const d = detailsOf(q);
    if (d['groom-name'] && d['bride-name']) {
      const groom = asName(d['groom-name']), bride = asName(d['bride-name']);
      if (!groom || !bride) continue;
      const g = person(groom, 'Groom'), b = person(bride, 'Bride');
      couple(g, b);
      const gf = asName(d['groom-father']), gm = asName(d['groom-mother']);
      const bf = asName(d['bride-father']), bm = asName(d['bride-mother']);
      const gfp = gf && person(gf, 'Father'), gmp = gm && person(gm, 'Mother');
      const bfp = bf && person(bf, 'Father'), bmp = bm && person(bm, 'Mother');
      couple(gfp, gmp); child(g, gfp, gmp);
      couple(bfp, bmp); child(b, bfp, bmp);
      continue;
    }
    const childName = CHILD_KEYS.map((k) => asName(d[k])).find(Boolean);
    const father = asName(d['father-name']), mother = asName(d['mother-name']);
    if (!childName || (!father && !mother)) continue;
    const c = person(childName, 'Child');
    const f = father && person(father, 'Father'), m = mother && person(mother, 'Mother');
    couple(f, m); child(c, f, m);
  }

  // 3. Group.
  const groups = new Map();
  for (const p of people.values()) {
    const root = find(p.key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(p);
  }

  const memberOf = (p) => ({ name: p.name, roles: [...p.roles].filter(Boolean), records: p.records.sort((a, b) => String(a.date).localeCompare(String(b.date))) });
  const families = [], singles = new Map();
  let id = 0;
  for (const list of groups.values()) {
    if (list.length === 1 && !linked.has(list[0].key)) {
      const s = norm(list[0].parts.lastName) ? list[0].parts.lastName : '(no surname)';
      if (!singles.has(s)) singles.set(s, []);
      singles.get(s).push(memberOf(list[0]));
      continue;
    }
    // Family name: the most common surname among fathers, children and grooms; else among everyone.
    const tally = (pool) => {
      const c = new Map();
      for (const p of pool) { const s = p.parts.lastName.trim(); c.set(s, (c.get(s) || 0) + 1); }
      return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    };
    const core = list.filter((p) => ['Father', 'Child', 'Groom'].some((r) => p.roles.has(r)));
    const name = tally(core.length ? core : list) || '(no surname)';
    const order = { Father: 0, Groom: 0, Mother: 1, Bride: 1, Spouse: 1, Child: 2 };
    const rank = (p) => Math.min(...[...p.roles].map((r) => order[r] ?? 3), 3);
    list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    families.push({
      id: `f${++id}`,
      name,
      members: list.map(memberOf),
      recordCount: list.reduce((n, p) => n + p.records.length, 0),
    });
  }
  families.sort((a, b) => a.name.localeCompare(b.name) || b.members.length - a.members.length);

  return {
    families,
    singles: [...singles.entries()].map(([surname, members]) => ({ surname, members })).sort((a, b) => a.surname.localeCompare(b.surname)),
    people: people.size,
  };
}
