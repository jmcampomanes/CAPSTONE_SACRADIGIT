/* ============================================
   SacraDigit Admin — Families
   Runs after dashboard.js. Two views:

   Family trees   The prepared mock community (fictional families,
                  data/mock-family-trees.json, made by
                  tools/mock-community/generate.mjs). Each family is a
                  branching tree: couples, their children, and theirs.
                  Needs no account and no certificate data.
   From records   Families worked out from the real archive records
                  and certificate requests (families-build.js).
                  Loaded only when this tab is opened.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { buildFamilies } from './families-build.js';

const TREES_URL = new URL('../data/mock-family-trees.json', import.meta.url).href;
const PAGE = 40;

async function listAll(model) {
  const items = [];
  let nextToken;
  do {
    const res = await client.models[model].list({ limit: 1000, nextToken });
    if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
    items.push(...res.data);
    nextToken = res.nextToken;
  } while (nextToken);
  return items;
}

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const shortDate = (iso) => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? new Date(`${iso}T00:00:00`) : null;
    return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  };
  const status = $('fm-status'), list = $('fm-list'), more = $('fm-more');

  let mode = 'trees';
  let shown = PAGE;
  let trees = null;     // prepared from the mock file
  let fromRecords = null; // buildFamilies() result

  /* ---------- family trees (mock community) ---------- */

  const KIND = { church: 'Church marriage', civil: 'Civil marriage', 'live-in': 'Live-in partner', 'single-parent': 'Single parent' };

  function prepareTree(t) {
    let people = 0, couples = 0, depth = 0;
    const names = [];
    (function walk(p, d) {
      people++; names.push(p.name); depth = Math.max(depth, d);
      for (const f of p.families || []) {
        couples++;
        if (f.spouse) { people++; names.push(f.spouse.name); }
        for (const c of f.children || []) walk(c, d + 1);
      }
    })(t.root, 1);
    return { ...t, people, couples, depth, haystack: norm(`${t.familyName} ${names.join(' ')}`) };
  }

  function personHtml(p) {
    const unions = (p.families || []).map((f) => `
      <div class="fm-union"><span class="fm-kind">${esc(KIND[f.kind] || f.kind)}</span>${f.spouse ? esc(f.spouse.name) : ''}</div>
      ${f.children?.length ? `<ul>${f.children.map(personHtml).join('')}</ul>` : ''}`).join('');
    return `<li><span class="fm-person">${esc(p.name)}</span>${unions}</li>`;
  }

  const treeCard = (t, i) => `
    <details class="panel" data-tree="${i}">
      <summary class="panel-header" style="cursor:pointer">
        <h2 class="panel-title">${esc(t.familyName)} family <span class="text-sm font-normal text-gray-500">· ${esc(t.root.name)}</span></h2>
        <p class="text-sm text-gray-600">${t.people} people · ${t.depth} generation${t.depth === 1 ? '' : 's'} · ${t.couples} couple${t.couples === 1 ? '' : 's'}</p>
      </summary>
      <div class="px-5 pb-4"></div>
    </details>`;

  /* ---------- families from records ---------- */

  const memberHtml = (m) => `
    <li class="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="font-medium text-gray-900">${esc(m.name)}</span>
      ${m.roles.length ? `<span class="text-xs text-gray-500">${esc(m.roles.join(' · '))}</span>` : ''}
      <span class="text-xs text-gray-600">${m.records.length
        ? m.records.map((r) => `${esc(r.label)}${r.date ? ` (${esc(shortDate(r.date))})` : ''}${r.hasFile ? '' : ' – no file'}`).join(', ')
        : 'No archive record yet'}</span>
    </li>`;

  const recordFamilyHtml = (f) => `
    <details class="panel">
      <summary class="panel-header" style="cursor:pointer">
        <h2 class="panel-title">${esc(f.name)} family</h2>
        <p class="text-sm text-gray-600">${f.members.length} people · ${f.recordCount} record${f.recordCount === 1 ? '' : 's'}</p>
      </summary>
      <ul class="px-5 pb-3 divide-y divide-gray-100">${f.members.map(memberHtml).join('')}</ul>
    </details>`;

  const singlesHtml = (g) => `
    <details>
      <summary class="text-sm font-semibold text-gray-800" style="cursor:pointer">${esc(g.surname)} <span class="font-normal text-gray-500">· ${g.members.length}</span></summary>
      <ul class="pt-1 divide-y divide-gray-100">${g.members.map(memberHtml).join('')}</ul>
    </details>`;

  /* ---------- render ---------- */

  function render() {
    const q = norm($('fm-search').value);
    $('fm-singles-panel').classList.add('hidden');
    more.classList.add('hidden');

    if (mode === 'trees') {
      $('fm-note').innerHTML = '<span class="fm-sample">Sample data</span> Fictional families prepared for demonstration. Open a family to see its branches: each couple, their children, and the children’s own families.';
      if (!trees) return;
      const matches = trees.filter((t) => !q || t.haystack.includes(q));
      const people = matches.reduce((n, t) => n + t.people, 0);
      $('fm-summary').textContent = `${matches.length} famil${matches.length === 1 ? 'y' : 'ies'} · ${people.toLocaleString()} people`;
      list.innerHTML = matches.length ? matches.slice(0, shown).map((t) => treeCard(t, trees.indexOf(t))).join('') : '<p class="text-sm text-gray-600 px-1">No family matches that search.</p>';
      more.classList.toggle('hidden', matches.length <= shown);
      if (q && matches.length === 1) list.querySelector('details')?.setAttribute('open', '');
      return;
    }

    $('fm-note').textContent = 'Worked out from marriage records and from the parents named on certificate requests. A person appears under a family once a record names their spouse or parents.';
    if (!fromRecords) return;
    const matchFam = (f) => !q || norm(f.name).includes(q) || f.members.some((m) => norm(m.name).includes(q));
    const fams = fromRecords.families.filter(matchFam);
    const singlesCount = fromRecords.singles.reduce((n, g) => n + g.members.length, 0);
    $('fm-summary').textContent = `${fams.length} of ${fromRecords.families.length} families · ${fromRecords.people} people · ${singlesCount} with no family link`;
    list.innerHTML = fams.length
      ? fams.slice(0, shown).map(recordFamilyHtml).join('')
      : `<p class="text-sm text-gray-600 px-1">${fromRecords.families.length ? 'No family matches that search.' : 'No families in the records yet. They appear once a marriage record or a certificate request names a couple or a child’s parents.'}</p>`;
    more.classList.toggle('hidden', fams.length <= shown);
    const groups = fromRecords.singles
      .map((g) => ({ ...g, members: g.members.filter((m) => !q || norm(g.surname).includes(q) || norm(m.name).includes(q)) }))
      .filter((g) => g.members.length);
    $('fm-singles-panel').classList.toggle('hidden', !groups.length);
    $('fm-singles-list').innerHTML = groups.slice(0, 200).map(singlesHtml).join('');
  }

  // Build a tree's branches only when its card is first opened.
  list.addEventListener('toggle', (e) => {
    const d = e.target;
    if (mode !== 'trees' || !d.open || d.dataset.built || !d.dataset.tree) return;
    d.dataset.built = '1';
    d.lastElementChild.innerHTML = `<ul class="fm-tree">${personHtml(trees[+d.dataset.tree].root)}</ul>`;
  }, true);

  async function setMode(next) {
    mode = next;
    shown = PAGE;
    $('fm-tab-trees').setAttribute('aria-selected', String(next === 'trees'));
    $('fm-tab-records').setAttribute('aria-selected', String(next === 'records'));
    status.textContent = '';
    if (next === 'records' && !fromRecords) {
      status.textContent = 'Loading the records…';
      list.innerHTML = '';
      try {
        const [records, requests] = await Promise.all([listAll('ParishRecord'), listAll('CertificateRequest')]);
        fromRecords = buildFamilies(records, requests);
      } catch (err) {
        console.error('Could not load families from records:', err);
        status.textContent = 'Could not load the records. Check your connection and try again.';
        return;
      }
      status.textContent = '';
    }
    render();
  }

  $('fm-search').addEventListener('input', () => { shown = PAGE; render(); });
  more.addEventListener('click', () => { shown += PAGE; render(); });
  $('fm-tab-trees').addEventListener('click', () => setMode('trees'));
  $('fm-tab-records').addEventListener('click', () => setMode('records'));

  (async () => {
    status.textContent = 'Loading the families…';
    try {
      const res = await fetch(TREES_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      trees = (await res.json()).map(prepareTree).sort((a, b) => a.familyName.localeCompare(b.familyName) || b.people - a.people);
      status.textContent = '';
    } catch (err) {
      console.error('Could not load the family trees:', err);
      status.textContent = 'Could not load the family trees.';
      return;
    }
    render();
  })();
});
