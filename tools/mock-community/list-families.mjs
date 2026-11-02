#!/usr/bin/env node
/* ============================================
   Mock community: readable family list
   Reads the generated JSON and writes
   mock-data/FAMILIES.md, grouped by how each family
   came to the parish.

     node tools/mock-community/generate.mjs
     node tools/mock-community/list-families.mjs
   ============================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (name) => {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'mock-data', name), 'utf8'));
  return Array.isArray(raw) ? raw : raw.persons || raw.families || raw.trees || raw.households || Object.values(raw);
};

const persons = new Map(load('persons.json').map(p => [p.id, p]));
const unions = new Map(load('families.json').map(u => [u.id, u]));
const trees = load('family-trees.json');

const CATEGORIES = [
  ['founding-family', 'Founding families', 'Already in the parish when its records begin in 1974.'],
  ['moved-in', 'Families who moved in', 'Arrived later, so some of their sacraments are recorded elsewhere.'],
];

function walk(node, depth, stats) {
  stats.people.add(node.id);
  stats.generations = Math.max(stats.generations, depth);
  for (const fam of node.families || []) {
    const u = unions.get(fam.unionId);
    if (!stats.couples.has(fam.unionId)) {
      stats.couples.add(fam.unionId);
      stats[fam.kind] = (stats[fam.kind] || 0) + 1;
      if (u?.endReason === 'declaration-of-nullity') stats.nullity += 1;
      if (u?.endReason === 'separated') stats.separated += 1;
    }
    if (fam.spouse?.id) stats.people.add(fam.spouse.id);
    for (const child of fam.children || []) walk(child, depth + 1, stats);
  }
}

const rows = trees.map(tree => {
  const stats = { people: new Set(), couples: new Set(), generations: 1, nullity: 0, separated: 0 };
  walk(tree.root, 1, stats);
  const members = [...stats.people].map(id => persons.get(id)).filter(Boolean);
  const founder = persons.get(tree.root.id);
  const origin = founder?.origin;
  const notes = [
    stats.nullity && `${stats.nullity} annulled`,
    stats.separated && `${stats.separated} separated`,
    members.filter(p => p.origin === 'adopted').length && `${members.filter(p => p.origin === 'adopted').length} adopted`,
  ].filter(Boolean).join(', ');
  return {
    family: tree.familyName,
    founder: tree.root.name,
    category: origin === 'founding-family' ? origin : 'moved-in',
    generations: stats.generations,
    people: stats.people.size,
    living: members.filter(p => !p.deathDate).length,
    couples: stats.couples.size,
    kinds: `${stats.church || 0} / ${stats.civil || 0} / ${stats['live-in'] || 0}`,
    notes,
  };
});

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'mock-data', 'manifest.json'), 'utf8'));
const c = manifest.counts;
const out = [
  '# Mock community: families',
  '',
  `Generated from seed ${manifest.seed}. **Everyone here is invented.** Rebuild with \`node tools/mock-community/list-families.mjs\`.`,
  '',
  `${c.familyTrees} family trees, ${c.families} couples, ${c.households} households and ${c.persons} people, of whom ${c.livingResidents} are living residents.`,
  '',
  '"Couples" splits as church / civil / live-in. "People" counts blood relatives and their spouses.',
  '',
  'A marriage joins two families, so a couple and their children can appear in both trees. That is why the rows below add up to more than the totals above.',
  '',
];
for (const [key, title, desc] of CATEGORIES) {
  const list = rows.filter(r => r.category === key).sort((a, b) => a.family.localeCompare(b.family) || b.people - a.people);
  out.push(`## ${title} (${list.length})`, '', desc, '',
    '| Family | Founder | Generations | People | Living | Couples | Church / civil / live-in | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...list.map(r => `| ${r.family} | ${r.founder} | ${r.generations} | ${r.people} | ${r.living} | ${r.couples} | ${r.kinds} | ${r.notes} |`),
    '');
}
writeFileSync(resolve(ROOT, 'mock-data', 'FAMILIES.md'), out.join('\n'));

console.log(CATEGORIES.map(([key, title]) => {
  const list = rows.filter(r => r.category === key);
  return `${title}: ${list.length} trees, ${list.reduce((n, r) => n + r.people, 0)} people, ${list.reduce((n, r) => n + r.couples, 0)} couples`;
}).join('\n'));
const top = [...rows].sort((a, b) => b.people - a.people).slice(0, 10);
console.log(top.map(r => `${r.family} | ${r.founder} | gens ${r.generations} | people ${r.people} | living ${r.living} | couples ${r.couples} | ${r.category}`).join('\n'));
console.log('sum people', rows.reduce((n, r) => n + r.people, 0), 'sum couples', rows.reduce((n, r) => n + r.couples, 0));
const names = new Map(); rows.forEach(r => names.set(r.family, (names.get(r.family) || 0) + 1));
console.log('distinct surnames', names.size);
