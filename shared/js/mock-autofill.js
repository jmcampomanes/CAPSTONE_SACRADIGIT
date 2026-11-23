/* ============================================
   SacraDigit — mock_data name autofill (staff encoding forms)

   An encoder types a person's first and last name; this
   looks the name up in the MockParishioner table (the
   "mock_data" storage: parishioners who have no account yet)
   and fills the personal details and the family tree fields
   of the form: parents, birth, spouse, and so on.

     attachMockAutofill({
       name: 'cert-child-name',            // id prefix of the 4-field name group to watch
       fill: { father: 'cert-father-name', mother: 'cert-mother-name', birthDate: 'cert-birth-date' },
     });

   What happens, following mock-data/README.md:
     one match       fills the form straight away
     several         shows a short list under the name; pick one
     none / no table nothing happens, the encoder types as before

   It never overwrites what the encoder typed: a field is
   filled only while it is empty, or still holds what this
   file wrote there. Picking another person from the list
   replaces the earlier autofill.

   Staff only. The table's rules let admin, staff and itech
   read it; a parishioner's session gets nothing back.
   ============================================ */

import { client } from './amplify-init.js';
import { readNameFields, formatFullName } from './name-utils.js';

const PARISH = 'Our Lady of Fatima Parish';
const MAX_SUGGESTIONS = 8;
const DEBOUNCE_MS = 450;

const stripAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const key = (s) => stripAccents(s).toLowerCase().replace(/[^a-z]/g, '');
const json = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = (n) => formatFullName(n || {});
const year = (d) => (d ? String(d).slice(0, 4) : '');

/** Table not deployed yet (older amplify_outputs.json) or the signed-in role can't read it. */
const model = () => client?.models?.MockParishioner || null;

/* ---------- search ---------- */

const rowCache = new Map(); // id -> row

function normalize(row) {
  return { ...row, family: json(row.family) || {}, sacraments: json(row.sacraments) || {} };
}

/** Every person whose surname (current or maiden) is exactly `last` and whose first name starts with `first`. */
async function search(first, last, middle, birthDate) {
  const m = model();
  if (!m) return [];
  const args = { firstKey: { beginsWith: key(first) } };
  const [now, maiden] = await Promise.all([
    m.mockParishionersByLastName({ lastKey: key(last), ...args, limit: 25 }),
    m.mockParishionersByMaidenName({ maidenKey: key(last), ...args, limit: 25 }),
  ]);
  const err = now.errors?.[0] || maiden.errors?.[0];
  if (err) { console.warn('mock_data search failed:', err.message); return []; }

  const found = new Map();
  for (const r of [...(now.data || []), ...(maiden.data || [])]) found.set(r.id, normalize(r));
  let rows = [...found.values()];

  // A middle name or birth date the encoder already typed narrows the list.
  const mk = key(middle);
  if (mk) {
    const narrowed = rows.filter(r => key(r.middleName).startsWith(mk));
    if (narrowed.length) rows = narrowed;
  }
  if (birthDate) {
    const narrowed = rows.filter(r => r.birthDate === birthDate);
    if (narrowed.length) rows = narrowed;
  }
  rows.forEach(r => rowCache.set(r.id, r));
  return rows.sort((a, b) => (a.birthDate || '9999').localeCompare(b.birthDate || '9999'));
}

async function getRow(id) {
  if (rowCache.has(id)) return rowCache.get(id);
  const m = model();
  if (!m || !id) return null;
  const res = await m.get({ id });
  if (res.errors?.length || !res.data) return null;
  const row = normalize(res.data);
  rowCache.set(id, row);
  return row;
}

/* ---------- reading a row ---------- */

/** Name as the registers hold it: a married woman is under her maiden surname. */
const registerName = (row) => ({
  firstName: row.firstName, middleName: row.middleName || '',
  lastName: row.maidenLastName || row.lastName, extension: row.extension || '',
});
const currentName = (row) => ({
  firstName: row.firstName, middleName: row.middleName || '',
  lastName: row.lastName, extension: row.extension || '',
});

/** The marriage to use: the latest church marriage, else the latest of any kind. */
function mainSpouse(row) {
  const list = row.family?.spouses || [];
  const church = list.filter(s => s.kind === 'church');
  return (church.length ? church : list).slice(-1)[0] || null;
}

const parishRecord = (row, type) => (row.sacraments?.parishRecords || []).find(r => r.type === type);

function ageAt(birth, on) {
  if (!birth || !on) return '';
  const b = new Date(`${birth}T00:00:00`), d = new Date(`${on}T00:00:00`);
  if (isNaN(b) || isNaN(d)) return '';
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
  return age >= 0 ? String(age) : '';
}

/** Values a row can give a form, keyed by the names used in `fill`. */
function valuesOf(row) {
  const sp = mainSpouse(row);
  const baptism = parishRecord(row, 'baptism');
  const elsewhere = row.sacraments?.baptism;
  const communion = parishRecord(row, 'first-communion');
  return {
    father: row.family?.father ? { ...row.family.father.birthName } : null,
    mother: row.family?.mother ? { ...row.family.mother.birthName } : null, // registers use her maiden name
    birthDate: row.birthDate,
    birthPlace: row.birthPlace,
    deathDate: row.deathDate,
    age: ageAt(row.birthDate, row.deathDate),
    baptismDate: baptism?.date || elsewhere?.date || '',
    baptismChurch: baptism ? PARISH : elsewhere?.church || '',
    communionDate: communion?.date || '',
    marriageDate: sp?.weddingDate || '',
    marriagePlace: sp?.weddingPlace || '',
  };
}

/* ---------- writing to the form ---------- */

const written = new Map(); // element id -> the value this file put there
let filling = false;       // true while we write, so our own events don't start another search

function fire(el) {
  filling = true;
  try {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } finally { filling = false; }
}

let replacing = false;     // true when the encoder asked to overwrite what is already in the form
const canWrite = (el) => !!el && !el.disabled && (replacing || !el.value.trim() || written.get(el.id) === el.value);

function writeField(id, value) {
  const el = document.getElementById(id);
  if (!value || !canWrite(el) || el.value === value) return false;
  el.value = value;
  written.set(id, value);
  fire(el);
  return true;
}

function writeName(prefix, name) {
  if (!name) return false;
  let any = false;
  for (const [suffix, part] of [['first', 'firstName'], ['middle', 'middleName'], ['last', 'lastName'], ['ext', 'extension']]) {
    any = writeField(`${prefix}-${suffix}`, name[part]) || any;
  }
  return any;
}

/** The name the encoder is typing: complete it (proper case, middle name) without overwriting a different name. */
function completeAnchor(prefix, name) {
  const typed = readNameFields(prefix);
  for (const [suffix, part] of [['first', 'firstName'], ['last', 'lastName']]) {
    const el = document.getElementById(`${prefix}-${suffix}`);
    if (el && key(name[part]).startsWith(key(typed[part])) && el.value !== name[part]) {
      el.value = name[part];
      written.set(el.id, name[part]);
      fire(el);
    }
  }
  for (const [suffix, part] of [['middle', 'middleName'], ['ext', 'extension']]) writeField(`${prefix}-${suffix}`, name[part]);
}

/** Fills one person's fields. Returns how many form fields changed. */
function applyRow(row, cfg) {
  const values = valuesOf(row);
  let count = 0;
  const before = (cfg.birth ? registerName(row) : currentName(row));
  completeAnchor(cfg.name, before);
  for (const [what, target] of Object.entries(cfg.fill || {})) {
    if (!target) continue;
    const v = values[what];
    if (v && typeof v === 'object') count += writeName(target, v) ? 1 : 0;
    else count += writeField(target, v) ? 1 : 0;
  }
  return count;
}

async function applyAll(row, cfg, { replace = false } = {}) {
  replacing = replace;
  try { return await applyAllNow(row, cfg); } finally { replacing = false; }
}

async function applyAllNow(row, cfg) {
  const total = applyRow(row, cfg);
  let spouseName = '';
  if (cfg.spouse) {
    const sp = mainSpouse(row);
    const spRow = sp ? await getRow(sp.id) : null;
    if (spRow) {
      spouseName = nameOf(cfg.spouse.birth ? registerName(spRow) : currentName(spRow));
      writeName(cfg.spouse.name, cfg.spouse.birth ? registerName(spRow) : currentName(spRow));
      const values = valuesOf(spRow);
      for (const [what, target] of Object.entries(cfg.spouse.fill || {})) {
        const v = values[what];
        if (v && typeof v === 'object') writeName(target, v);
        else writeField(target, v);
      }
    }
    // marriage date and place belong to the couple, not to one of them
    if (sp) {
      writeField(cfg.fill?.marriageDate, sp.weddingDate);
      writeField(cfg.fill?.marriagePlace, sp.weddingPlace);
    }
  }
  return { count: total, spouseName };
}

/* ---------- the little panel under the name ---------- */

const STYLE = `
  .mock-af { margin-top: .35rem; font-size: .8125rem; color: #374151; }
  .mock-af-note { display: flex; gap: .5rem; align-items: baseline; flex-wrap: wrap; padding: .4rem .6rem; border-radius: .5rem; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .mock-af-note button { border: 0; background: none; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; padding: 0; }
  .mock-af-list { margin: 0; padding: 0; list-style: none; border: 1px solid #e5e7eb; border-radius: .5rem; background: #fff; overflow: hidden; }
  .mock-af-list-title { padding: .35rem .6rem; background: #f9fafb; color: #6b7280; font-size: .75rem; border-bottom: 1px solid #e5e7eb; }
  .mock-af-list button { display: block; width: 100%; text-align: left; border: 0; background: none; padding: .5rem .6rem; cursor: pointer; font: inherit; color: inherit; min-height: 2.5rem; }
  .mock-af-list li + li button { border-top: 1px solid #f3f4f6; }
  .mock-af-list button:hover, .mock-af-list button:focus-visible { background: #f3f4f6; outline: none; }
  .mock-af-list small { display: block; color: #6b7280; }
  :root[data-theme="dark"] .mock-af, .dark .mock-af { color: #e5e7eb; }
  :root[data-theme="dark"] .mock-af-list, .dark .mock-af-list { background: #1f2937; border-color: #374151; }
  :root[data-theme="dark"] .mock-af-list-title, .dark .mock-af-list-title { background: #111827; border-color: #374151; color: #9ca3af; }
  :root[data-theme="dark"] .mock-af-list li + li button, .dark .mock-af-list li + li button { border-color: #374151; }
  :root[data-theme="dark"] .mock-af-list button:hover, .dark .mock-af-list button:hover { background: #374151; }
`;
function addStyle() {
  if (document.getElementById('mock-af-style')) return;
  const s = document.createElement('style');
  s.id = 'mock-af-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function describe(row) {
  const bits = [];
  if (row.birthDate) bits.push(`born ${year(row.birthDate)}`);
  const f = row.family || {};
  const parents = [f.father?.birthName, f.mother?.birthName].filter(Boolean).map(n => n.firstName).join(' & ');
  if (parents) bits.push(`child of ${parents}`);
  const sp = mainSpouse(row);
  if (sp) bits.push(`married to ${nameOf(sp.name)}`);
  if (row.deathDate) bits.push(`died ${year(row.deathDate)}`);
  return bits.join(' · ');
}

function summary(row, spouseName) {
  const f = row.family || {};
  const bits = [];
  if (f.father || f.mother) bits.push(`parents ${[f.father && nameOf(f.father.name), f.mother && nameOf(f.mother.birthName)].filter(Boolean).join(' & ')}`);
  if (spouseName) bits.push(`spouse ${spouseName}`);
  else if ((f.spouses || []).length) bits.push(`spouse ${nameOf(f.spouses.slice(-1)[0].name)}`);
  if ((f.children || []).length) bits.push(`${f.children.length} child${f.children.length > 1 ? 'ren' : ''}`);
  return bits.join(', ');
}

/* ---------- public ---------- */

/**
 * Watches one name group and autofills the form from mock_data.
 * Returns { run } so a page can ask for a lookup after it filled the name itself.
 */
export function attachMockAutofill(cfg) {
  const firstEl = document.getElementById(`${cfg.name}-first`);
  const lastEl = document.getElementById(`${cfg.name}-last`);
  const middleEl = document.getElementById(`${cfg.name}-middle`);
  if (!firstEl || !lastEl) return { run() {} };
  addStyle();

  const group = lastEl.closest('.name-field-group') || lastEl.parentElement;
  const panel = document.createElement('div');
  panel.className = 'mock-af';
  panel.setAttribute('aria-live', 'polite');
  group.appendChild(panel);

  let timer = null;
  let ticket = 0;       // a newer lookup makes an older, slower one drop its answer
  let lastQuery = '';

  const clearPanel = () => { panel.innerHTML = ''; };

  async function choose(row, replace = false) {
    clearPanel();
    const { count, spouseName } = await applyAll(row, cfg, { replace });
    panel.innerHTML = `<div class="mock-af-note"><span>Filled from parish mock data${count ? '' : ' (nothing new to fill)'}: ${esc(summary(row, spouseName))}.</span><button type="button" data-replace title="Overwrite what is already typed in these fields">Replace all fields with parish data</button><button type="button" data-clear>Dismiss</button></div>`;
    panel.querySelector('[data-replace]').addEventListener('click', () => choose(row, true));
    panel.querySelector('[data-clear]').addEventListener('click', clearPanel);
  }

  function showChoices(rows) {
    panel.innerHTML = `<ul class="mock-af-list"><li class="mock-af-list-title">${rows.length} people match. Pick the right one to fill the form:</li>${
      rows.slice(0, MAX_SUGGESTIONS).map((r, i) => `<li><button type="button" data-i="${i}">${esc(nameOf(registerName(r)))}${r.maidenLastName ? ` <em>(${esc(nameOf(currentName(r)))})</em>` : ''}<small>${esc(describe(r)) || 'No other details'}</small></button></li>`).join('')
    }</ul>`;
    panel.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => choose(rows[Number(b.dataset.i)])));
  }

  async function run() {
    const first = firstEl.value.trim();
    const last = lastEl.value.trim();
    if (key(first).length < 2 || key(last).length < 2) { clearPanel(); lastQuery = ''; return; }
    const birth = cfg.fill?.birthDate ? document.getElementById(cfg.fill.birthDate)?.value : '';
    const q = [key(first), key(last), key(middleEl?.value), birth].join('|');
    if (q === lastQuery) return;
    lastQuery = q;
    const mine = ++ticket;
    let rows;
    try { rows = await search(first, last, middleEl?.value, birth); }
    catch (err) { console.warn('mock_data search failed:', err); return; }
    if (mine !== ticket) return;
    if (!rows.length) { clearPanel(); return; }
    if (rows.length === 1) await choose(rows[0]);
    else showChoices(rows);
  }

  const later = () => { if (filling) return; clearTimeout(timer); timer = setTimeout(run, DEBOUNCE_MS); };
  [firstEl, middleEl, lastEl].filter(Boolean).forEach(el => el.addEventListener('input', later));

  // The page fills the name itself when it opens a request: look it up when the form appears.
  const overlay = group.closest('.modal-overlay');
  if (overlay) {
    new MutationObserver(() => {
      if (overlay.classList.contains('hidden')) { clearPanel(); lastQuery = ''; written.clear(); }
      else setTimeout(run, 150);
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  return { run };
}
