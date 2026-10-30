/* ============================================
   SacraDigit — Badges the admin makes
   The Head Admin designs new Faith Journey badges
   on Sacradigit/badges.html. Each one is earned
   either
     'auto'   — by a rule over the records the parish
                already keeps (RULE_KINDS in badges.js:
                Masses attended, Sundays in a row, gifts
                to a fund, times served, …), or
     'manual' — given by hand to named parishioners
                (e.g. "Parish Volunteer of the Year").
   An 'auto' badge can also be given by hand.
   computeBadges() in badges.js works them out next to
   the built-in badges, so My Badges and the Dashboard
   strip show both.

   Models (add to the backend, amplify/data/resource.ts):

     CustomBadge: a.model({
       name: a.string().required(),
       description: a.string(),
       group: a.string(),        // 'mass' | 'giving' | 'community' | 'honors'
       tier: a.string(),         // 'bronze' | 'silver' | 'gold'
       icon: a.string(),         // a key of ICON_NAMES in badges.js
       mode: a.string(),         // 'auto' | 'manual'
       rule: a.json(),           // { kind, target, from?, to?, match?, ministry? }
       active: a.boolean(),      // false = hidden from parishioners
       createdByName: a.string(),
     }).authorization((allow) => [
       allow.authenticated().to(['read']),
       allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
       allow.groups(['staff', 'itech']).to(['read']),
     ]),

     BadgeAward: a.model({
       badgeId: a.id().required(),
       parishionerKey: a.string().required(), // parishionerKey(name) in badges.js
       parishionerName: a.string(),
       note: a.string(),
       awardedOn: a.date(),
       awardedByName: a.string(),
     }).authorization((allow) => [
       allow.authenticated().to(['read']),
       allow.groups(['admin', 'staff']).to(['create', 'read', 'update', 'delete']),
       allow.groups(['itech']).to(['read']),
     ]),

   Awards are readable by every signed-in parishioner,
   like the Faithful Givers list — they're honors, and
   they hold a name and a note only.
   ============================================ */

import { client } from './amplify-init.js';
import { parishionerKey, describeRule } from './badges.js';

export const customBadgesReady = () => !!(client.models.CustomBadge && client.models.BadgeAward);

const errorsOf = (res) => (res.errors?.length ? new Error(res.errors.map(e => e.message).join('; ')) : null);

// AWSJSON comes back as a string (sometimes double-encoded).
function parseJson(v) {
  let x = v;
  for (let i = 0; i < 2 && typeof x === 'string'; i++) { try { x = JSON.parse(x); } catch { return null; } }
  return x && typeof x === 'object' ? x : null;
}

/** A CustomBadge record in the shape computeBadges() and the badge cards use. */
export function fromRecord(r) {
  const rule = parseJson(r.rule) || {};
  const mode = r.mode === 'auto' ? 'auto' : 'manual';
  return {
    id: `custom-${r.id}`,
    recordId: r.id,
    custom: true,
    name: r.name || 'Untitled badge',
    desc: r.description || (mode === 'auto' ? describeRule(rule) : 'Given by the parish.'),
    group: r.group || 'honors',
    tier: ['bronze', 'silver', 'gold'].includes(r.tier) ? r.tier : 'silver',
    icon: r.icon || 'star',
    mode,
    rule,
    active: r.active !== false,
    needsCheckIn: mode === 'auto' && ['masses', 'masses-between', 'sunday-streak'].includes(rule.kind),
    createdByName: r.createdByName || '',
    updatedAt: r.updatedAt,
  };
}

async function listAll(model, options = {}) {
  const items = [];
  let nextToken = null;
  do {
    const res = await client.models[model].list({ limit: 1000, ...options, nextToken });
    const err = errorsOf(res); if (err) throw err;
    items.push(...(res.data || []));
    nextToken = res.nextToken;
  } while (nextToken);
  return items;
}

/* ---------- parishioner side ---------- */

/** { custom, awards } for computeBadges(): active admin-made badges + this person's awards. */
export async function loadMyCustomBadges(name) {
  if (!customBadgesReady()) return { custom: [], awards: [] };
  const [badges, awards] = await Promise.all([
    listAll('CustomBadge'),
    listAll('BadgeAward', { filter: { parishionerKey: { eq: parishionerKey(name) } } }),
  ]);
  return { custom: badges.map(fromRecord).filter(b => b.active), awards };
}

/* ---------- admin side ---------- */

export function watchCustomBadges(onChange) {
  if (!customBadgesReady()) return () => {};
  const sub = client.models.CustomBadge.observeQuery().subscribe({
    next: ({ items }) => onChange(items.map(fromRecord).sort((a, b) => a.name.localeCompare(b.name))),
    error: (err) => console.error('Failed to load badges:', err),
  });
  return () => sub.unsubscribe();
}

export function watchAwards(onChange) {
  if (!customBadgesReady()) return () => {};
  const sub = client.models.BadgeAward.observeQuery().subscribe({
    next: ({ items }) => onChange(items),
    error: (err) => console.error('Failed to load badge awards:', err),
  });
  return () => sub.unsubscribe();
}

/** Creates (no id) or updates a badge. fields: name, description, group, tier, icon, mode, rule, active. */
export async function saveBadge(fields, id = null, byName = '') {
  const payload = { ...fields, rule: JSON.stringify(fields.rule || {}) };
  const res = id
    ? await client.models.CustomBadge.update({ id, ...payload })
    : await client.models.CustomBadge.create({ ...payload, createdByName: byName });
  const err = errorsOf(res); if (err) throw err;
  return res.data;
}

/** Deletes a badge and every award of it. */
export async function deleteBadge(recordId, awards = []) {
  for (const a of awards.filter(x => x.badgeId === recordId)) {
    const r = await client.models.BadgeAward.delete({ id: a.id });
    const err = errorsOf(r); if (err) throw err;
  }
  const res = await client.models.CustomBadge.delete({ id: recordId });
  const err = errorsOf(res); if (err) throw err;
}

export async function awardBadge({ badgeId, name, note = '', awardedOn, byName = '' }) {
  const res = await client.models.BadgeAward.create({
    badgeId,
    parishionerKey: parishionerKey(name),
    parishionerName: String(name).trim().replace(/\s+/g, ' '),
    note,
    awardedOn,
    awardedByName: byName,
  });
  const err = errorsOf(res); if (err) throw err;
  return res.data;
}

export async function revokeAward(id) {
  const res = await client.models.BadgeAward.delete({ id });
  const err = errorsOf(res); if (err) throw err;
}

/**
 * Everything the parish keeps that badges are worked out from, grouped by
 * parishioner — for "Who has it?" on the admin page and for name suggestions.
 * Returns Map(key → { name, data: { checkIns, donations, intentions, blessings, ministry } }).
 */
export async function loadEveryonesRecords() {
  const people = new Map();
  const add = (name, field, rec) => {
    const key = parishionerKey(name);
    if (!key) return;
    if (!people.has(key)) people.set(key, { name: String(name).trim(), data: { checkIns: [], donations: [], intentions: [], blessings: [], ministry: [] } });
    if (field) people.get(key).data[field].push(rec);
  };
  const safe = (model, opts) => (client.models[model] ? listAll(model, opts).catch(err => { console.warn(`${model} unavailable:`, err); return []; }) : Promise.resolve([]));
  const [checkIns, donations, intentions, blessings, ministry, prefs] = await Promise.all([
    safe('MassCheckIn'), safe('Donation'), safe('MassIntention'), safe('Blessing'), safe('MinistrySignup'), safe('ParishionerPreference'),
  ]);
  checkIns.forEach(c => add(c.parishionerName || c.parishionerKey, 'checkIns', c));
  donations.forEach(d => add(d.donor, 'donations', d)); // same as the parishioner's own My Badges
  intentions.forEach(i => add(i.donor, 'intentions', i));
  blessings.forEach(b => add(b.requesterName, 'blessings', b));
  ministry.forEach(s => add(s.volunteerName, 'ministry', s));
  prefs.forEach(p => add(p.displayName || p.parishionerKey, null));
  return people;
}
