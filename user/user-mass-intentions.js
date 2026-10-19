/* ============================================
   SacraDigit — User Mass Intentions Scripts (AWS Amplify)
   Runs after user-shell.js.
   Reuses the same MassIntention model as the admin
   side. "My Intentions" filters client-side by
   donor === hardcoded demo name (no real login yet).
   ============================================ */

import { client } from '../amplify-init.js';
import { printReadersSheet } from '../print-report.js';
import { loadCommunityIntentions } from '../public-data.js';
import { currentUserName } from '../auth.js';
import { readNameFields, setNameFields, nameFieldsFilled, formatFullName } from '../name-utils.js';
import { createWeekendCalendar, formatWeekend } from '../weekend-calendar.js';

document.addEventListener('DOMContentLoaded', () => {

  // Names are stored as { firstName, middleName, lastName, extension }
  // objects (see name-utils.js). normalizeName tolerates any older
  // plain-string entries so display code never has to branch on shape.
  function normalizeName(n) {
    return typeof n === 'string' ? { firstName: n, middleName: '', lastName: '', extension: '' } : (n || {});
  }
  function nameDisplay(n) { return formatFullName(normalizeName(n)); }

  const DONOR_NAME = currentUserName(); // the signed-in parishioner (auth.js)

  const intentionTypes = [
    { id: 'soul', label: 'For the Soul of...', iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>` },
    { id: 'thanksgiving', label: 'Thanksgiving', iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>` },
    { id: 'healing', label: 'Healing', iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>` },
    { id: 'birthday', label: 'Birthday Blessing', iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A1.994 1.994 0 003 15.546M8.5 6.5V6a3.5 3.5 0 117 0v.5M4 15h16v5H4z"/></svg>` },
    { id: 'special', label: 'Special Intention', iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>` },
  ];

  let myIntentions = [];

  const badgeClass = { scheduled: 'badge-green', completed: 'badge-blue', cancelled: 'badge-red' };
  const statusLabel = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };

  const list          = document.getElementById('intentions-list');
  const emptyState      = document.getElementById('intentions-empty');
  const intentionsCount  = document.getElementById('intentions-count');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function formatShort(input) {
    if (!input) return '';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatPeso(n) { return '₱' + (n || 0).toLocaleString('en-US'); }
  function typeConfig(id) { return intentionTypes.find(t => t.id === id) || intentionTypes[4]; }
  function getNames(it) {
    if (!it.names) return [];
    try { return JSON.parse(it.names); } catch { return []; }
  }
  function typeIdFromLabel(label) {
    return (intentionTypes.find(t => t.label === label) || intentionTypes[4]).id;
  }

  client.models.MassIntention.observeQuery({ filter: { donor: { eq: DONOR_NAME } } }).subscribe({
    next: ({ items }) => {
      myIntentions = items;
      renderStats();
      renderList();
    },
    error: (err) => {
      console.error('Failed to load intentions:', err);
      list.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load intentions.</p>`;
    },
  });

  function renderStats() {
    document.getElementById('stat-total').textContent = myIntentions.length;
    document.getElementById('stat-scheduled').textContent = myIntentions.filter(i => i.status === 'scheduled').length;
    document.getElementById('stat-total-offered').textContent = formatPeso(myIntentions.reduce((s, i) => s + (i.offering || 0), 0));
  }

  function renderList() {
    intentionsCount.textContent = `${myIntentions.length} intention${myIntentions.length === 1 ? '' : 's'}`;

    if (myIntentions.length === 0) {
      list.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const sorted = myIntentions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    list.innerHTML = sorted.map(it => {
      const cfg = typeConfig(typeIdFromLabel(it.type));
      const names = getNames(it);
      const namesDisplay = names.length > 1
        ? `${escapeHtml(nameDisplay(names[0]))} <span class="text-gray-400 font-medium">+${names.length - 1} more</span>`
        : escapeHtml(nameDisplay(names[0]) || '');

      return `<li><div class="intention-row">
        <div class="intention-icon" style="background-color:${cfg.iconBg};color:${cfg.iconColor};">${cfg.icon}</div>
        <div class="intention-info">
          <p class="intention-type">${escapeHtml(it.type)}</p>
          <p class="intention-note">${namesDisplay}</p>
          <div class="intention-meta">
            <span class="intention-date">Submitted ${formatShort(it.createdAt)}</span>
            ${it.massDate ? `<span class="intention-mass-date">📅 Mass: ${formatShort(it.massDate)}</span>` : `<span class="badge badge-amber" style="font-size:0.625rem;">Awaiting assignment</span>`}
            <span class="badge ${badgeClass[it.status] || 'badge-gray'}" style="font-size:0.625rem;">${statusLabel[it.status] || it.status}</span>
          </div>
          <button type="button" class="intention-details-btn" data-id="${it.id}">See Details ›</button>
        </div>
        <div class="intention-offering">${formatPeso(it.offering)}</div>
      </div></li>`;
    }).join('');
  }

  list.addEventListener('click', e => {
    const btn = e.target.closest('.intention-details-btn');
    if (btn) openDetailsModal(btn.dataset.id);
  });

  /* ------------------------------------------
     SUBMIT A MASS INTENTION — its own page, 3 numbered steps
     (same progress bar as Request a Certificate):
       1 Prayer List — categories (one or more) + name → "Add to
         prayer list"; repeat for each person ("Add another person")
       2 Weekend & Offering — optional weekend, offering (₱300 minimum,
         however many people or categories)
       3 Confirm — review, then Submit Intention
     Saved like before: one MassIntention record per person per
     category, with the offering split evenly across the records.
  ------------------------------------------ */
  const modal         = document.getElementById('intention-modal');
  const dateInput     = document.getElementById('mi-date');
  const offeringInput = document.getElementById('mi-offering');
  const catGrid       = document.getElementById('mi-cat-grid');
  const listEl        = document.getElementById('mi-list');
  const addBtn        = document.getElementById('mi-add-person');
  const addBtnLabel   = document.getElementById('mi-add-person-label');
  const presetsEl     = document.getElementById('mi-offer-presets');
  const offeringHint  = document.getElementById('mi-offering-hint');
  const reviewEl      = document.getElementById('mi-review');
  const backBtn       = document.getElementById('mi-back');
  const nextBtn       = document.getElementById('mi-next');
  const submitBtn     = document.getElementById('mi-submit');
  const steps         = [...modal.querySelectorAll('.mi-step')];
  const dots          = [...modal.querySelectorAll('.mi-step-bar .mstep-dot')];

  const MIN_OFFERING = 300; // one flat minimum per submission
  const NAME_IDS = ['mi-name-first', 'mi-name-middle', 'mi-name-last', 'mi-name-ext'];

  // Friendlier wording for the category cards (the stored `type` stays t.label).
  const CAT_TEXT = {
    soul: ['For a departed soul', 'For the repose of someone who has died'],
    thanksgiving: ['Thanksgiving', 'Gratitude for blessings received'],
    healing: ['Healing', 'For someone who is sick or recovering'],
    birthday: ['Birthday blessing', 'For someone celebrating a birthday'],
    special: ['Special intention', 'Any other prayer intention'],
  };
  const catTitle = (id) => CAT_TEXT[id]?.[0] || typeConfig(id).label;

  let step = 1;
  let furthest = 1;
  let chosen = new Set();   // categories for the person being entered
  let people = [];          // [{ name, typeIds: [] }]
  let editingIndex = null;  // person being edited, or null when adding
  let offeringTouched = false;
  let weekend = null;       // weekend calendar (created on first open)

  const intentionCount = () => people.reduce((n, p) => n + p.typeIds.length, 0);
  // Each intention chip wears its category's colour (same as the category cards)
  const chipsHtml = (ids) => ids.map(id => { const t = typeConfig(id); return `<span class="mi-chip mi-chip-cat" style="background-color:${t.iconBg};color:${t.iconColor};">${escapeHtml(catTitle(id))}</span>`; }).join('');
  const nameStarted = () => NAME_IDS.some(id => document.getElementById(id).value.trim());

  function flag(el) {
    el.classList.add('border-red-400');
    el.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
  }

  /* --- Step 1 · categories --- */
  const CHECK = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';
  catGrid.innerHTML = intentionTypes.map(t => `
    <button type="button" class="mi-cat" data-type-id="${t.id}" aria-pressed="false">
      <span class="mi-cat-icon" style="background-color:${t.iconBg};color:${t.iconColor};">${t.icon}</span>
      <span class="mi-cat-text"><span class="mi-cat-title">${escapeHtml(catTitle(t.id))}</span><span class="mi-cat-hint">${escapeHtml(CAT_TEXT[t.id]?.[1] || '')}</span></span>
      <span class="mi-cat-check">${CHECK}</span>
    </button>`).join('');

  function paintCats() {
    catGrid.querySelectorAll('.mi-cat').forEach(b => {
      const on = chosen.has(b.dataset.typeId);
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  catGrid.addEventListener('click', (e) => {
    const b = e.target.closest('.mi-cat');
    if (!b) return;
    const id = b.dataset.typeId;
    chosen.has(id) ? chosen.delete(id) : chosen.add(id);
    catGrid.classList.remove('mi-invalid');
    paintCats();
  });

  /* --- Step 1 · prayer list --- */
  function renderPeople() {
    // Prayer list table: # · Name · Intentions · Edit / Remove (empty message when no one yet)
    document.getElementById('mi-list-count').textContent = people.length ? `(${people.length})` : '';
    document.getElementById('mi-list-empty').classList.toggle('hidden', people.length > 0);
    listEl.closest('table').classList.toggle('hidden', !people.length);
    listEl.innerHTML = people.map((p, i) => `
      <tr class="mi-person-row${i === editingIndex ? ' is-editing' : ''}">
        <td class="mi-td-name">${escapeHtml(nameDisplay(p.name))}</td>
        <td class="mi-td-cats"><span class="mi-chips">${chipsHtml(p.typeIds)}</span></td>
        <td class="mi-td-act">
          <button type="button" class="mi-person-btn" data-edit="${i}">Edit</button>
          <button type="button" class="mi-person-btn mi-person-btn-remove" data-remove="${i}" aria-label="Remove ${escapeHtml(nameDisplay(p.name))}">Remove</button>
        </td>
      </tr>`).join('');
    addBtnLabel.textContent = editingIndex !== null ? 'Save changes' : 'Add to prayer list';
    const note = document.getElementById('mi-added-note');
    if (note) {
      note.classList.toggle('hidden', !people.length);
      note.innerHTML = people.length ? `<strong>${people.length}</strong> ${people.length === 1 ? 'person' : 'people'} on your prayer list — add more, or tap <strong>Next</strong> to review the list.` : '';
    }
  }

  /** Clears the category + name fields (or loads person `index` to edit). */
  function startPerson(index = null) {
    editingIndex = index;
    const p = index === null ? null : people[index];
    chosen = new Set(p ? p.typeIds : []);
    paintCats();
    setNameFields('mi-name', p ? p.name : {});
    extToggle.checked = !!(p && (p.name.extension || '').trim());
    syncExt();
    NAME_IDS.forEach(id => document.getElementById(id).classList.remove('border-red-400'));
    catGrid.classList.remove('mi-invalid');
    renderPeople();
  }

  /** Adds (or saves) the person in the fields. Returns false if something's missing. */
  function addPerson() {
    let ok = true;
    if (!chosen.size) { catGrid.classList.add('mi-invalid'); ok = false; }
    if (!nameFieldsFilled('mi-name')) {
      ['mi-name-first', 'mi-name-last'].forEach(id => { const el = document.getElementById(id); if (!el.value.trim()) flag(el); });
      ok = false;
    }
    if (!ok) {
      window.showToast(!chosen.size ? 'Please choose at least one intention for this person.' : 'Please enter a first and last name.', true);
      return false;
    }
    const person = { name: readNameFields('mi-name'), typeIds: intentionTypes.map(t => t.id).filter(id => chosen.has(id)) };
    if (editingIndex === null) people.push(person); else people[editingIndex] = person;
    startPerson();
    return true;
  }

  const extToggle = document.getElementById('mi-ext-toggle');
  const extInput = document.getElementById('mi-name-ext');
  function syncExt(focus = false) {
    extInput.classList.toggle('hidden', !extToggle.checked);
    if (!extToggle.checked) extInput.value = '';
    else if (focus) extInput.focus();
  }
  extToggle.addEventListener('change', () => syncExt(true));

  // Adding a person stays on step 1 so more can be added; Next moves on when they're ready.
  // Saving an edit (opened from the list) returns to the list.
  addBtn.addEventListener('click', () => {
    const wasEditing = editingIndex !== null;
    if (!addPerson()) return;
    if (wasEditing) { go(2); return; }
    const p = people[people.length - 1];
    window.showToast(`${nameDisplay(p.name)} added to your prayer list.`);
    document.getElementById('mi-name-first').focus({ preventScroll: true });
  });
  document.getElementById('mi-add-another').addEventListener('click', () => { startPerson(); go(1); });
  NAME_IDS.forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
  });

  listEl.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) { startPerson(Number(edit.dataset.edit)); go(1); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const i = Number(rm.dataset.remove);
      people.splice(i, 1);
      if (editingIndex === i) startPerson();
      else { if (editingIndex !== null && i < editingIndex) editingIndex -= 1; renderPeople(); }
    }
  });

  /* --- Step 2 · offering (₱300 minimum, flat) --- */
  function renderOffering() {
    offeringHint.textContent = `An offering of ₱${MIN_OFFERING} covers your whole intention, no matter how many names or intentions are on your list.`;
    if (!offeringTouched) offeringInput.value = MIN_OFFERING;
    const current = Number(offeringInput.value);
    presetsEl.innerHTML = [MIN_OFFERING, 500, 1000].map((a) => `
      <button type="button" class="mi-offer${current === a ? ' selected' : ''}" data-amount="${a}" aria-pressed="${current === a}">
        ${formatPeso(a)}
      </button>`).join('');
  }
  presetsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.mi-offer');
    if (!b) return;
    offeringInput.value = b.dataset.amount;
    offeringTouched = true;
    offeringInput.classList.remove('border-red-400');
    renderOffering();
  });
  offeringInput.addEventListener('input', () => {
    offeringTouched = true;
    offeringInput.classList.remove('border-red-400');
    presetsEl.querySelectorAll('.mi-offer').forEach(b => {
      const on = Number(b.dataset.amount) === Number(offeringInput.value);
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  });

  /* --- Step 3 · review --- */
  function renderReview() {
    reviewEl.innerHTML = `
      <div class="mi-review-card">
        <div class="mi-review-head"><span>Praying for (${people.length})</span><button type="button" class="mi-link" data-goto="1">Change</button></div>
        <div class="mi-review-table">
          <table class="mi-table">
            <thead><tr><th>Name</th><th>Intentions</th></tr></thead>
            <tbody>
              ${people.map((p) => `<tr><td class="mi-td-name">${escapeHtml(nameDisplay(p.name))}</td><td class="mi-td-cats"><span class="mi-chips">${chipsHtml(p.typeIds)}</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="mi-review-card">
        <div class="mi-review-head"><span>Mass &amp; offering</span><button type="button" class="mi-link" data-goto="2">Change</button></div>
        <dl class="mi-review-rows">
          <div><dt>Weekend</dt><dd>${dateInput.value ? escapeHtml(formatWeekend(dateInput.value)) : 'The parish office will choose'}</dd></div>
          <div><dt>Intentions</dt><dd>${intentionCount()}</dd></div>
          <div><dt>Offering</dt><dd class="mi-review-total">${formatPeso(Number(offeringInput.value) || 0)}</dd></div>
        </dl>
      </div>`;
  }

  /* --- moving between steps --- */
  function go(n) {
    step = Math.max(1, Math.min(3, n));
    furthest = Math.max(furthest, step);
    steps.forEach(s => s.classList.toggle('hidden', Number(s.dataset.step) !== step));
    dots.forEach(d => {
      const k = Number(d.dataset.step);
      d.classList.toggle('is-current', k === step);
      d.classList.toggle('is-done', k < furthest && k !== step);
      d.disabled = k > furthest;
      d.setAttribute('aria-current', k === step ? 'step' : 'false');
    });
    if (step === 1) renderPeople();
    if (step === 2) renderOffering();
    if (step === 3) renderReview();

    // Step 1 after 'Add another person' / 'Edit': the left button returns to the list
    backBtn.textContent = step === 1 ? (people.length ? '← Back to prayer list' : 'Cancel') : '← Back';
    nextBtn.classList.toggle('hidden', step === 3);
    submitBtn.classList.toggle('hidden', step !== 3);
    nextBtn.textContent = step === 1 ? 'Next: Prayer List →' : 'Next: Confirm →';
    modal.querySelector('.mi-page-body').scrollTop = 0;
  }

  /** Can we leave step 1? Adds what's typed in the fields first. */
  function finishStep1() {
    // Something typed but not added yet → add it (or say what's missing).
    if (nameStarted() || (chosen.size && !people.length) || editingIndex !== null) {
      if (!addPerson()) return false;
    }
    if (!people.length) {
      catGrid.classList.add('mi-invalid');
      flag(document.getElementById('mi-name-first'));
      window.showToast('Please add at least one person to the prayer list.', true);
      return false;
    }
    return true;
  }

  function finishStep2() {
    if (!people.length) {
      window.showToast('Please add at least one person to the prayer list.', true);
      startPerson(); go(1);
      return false;
    }
    const amount = parseInt(offeringInput.value, 10);
    if (!amount || amount < MIN_OFFERING) {
      flag(offeringInput);
      window.showToast(`The offering must be at least ₱${MIN_OFFERING}.`, true);
      return false;
    }
    return true;
  }

  nextBtn.addEventListener('click', () => {
    if (step === 1 && finishStep1()) go(2);
    else if (step === 2 && finishStep2()) go(3);
  });

  backBtn.addEventListener('click', () => {
    if (step === 1) {
      if (!people.length) { closeModal(); return; }
      startPerson(); // drop the unsaved edit/new person
      go(2);
    } else go(step - 1);
  });

  // Progress bar + "Change" links
  modal.addEventListener('click', (e) => {
    const target = Number(e.target.closest('[data-goto]')?.dataset.goto || e.target.closest('.mi-step-bar .mstep-dot:not(:disabled)')?.dataset.step || 0);
    if (!target || target === step) return;
    if (target < step) { go(target); return; }
    // forward through the bar: only after the steps in between check out
    if (step === 1 && !finishStep1()) return;
    if (target === 3 && step <= 2 && !finishStep2()) { go(2); return; }
    go(target);
  });

  function openModal() {
    people = [];
    furthest = 1;
    offeringTouched = false;
    offeringInput.value = '';
    offeringInput.classList.remove('border-red-400');
    dateInput.value = '';
    if (!weekend) weekend = createWeekendCalendar(document.getElementById('mi-date-cal'), { weekendsOnly: true, onChange: (sat) => { dateInput.value = sat; } });
    else weekend.reset();
    startPerson();
    showModal(modal);
    go(1);
  }

  function closeModal() { hideModal(modal); }

  document.getElementById('btn-submit-intention').addEventListener('click', openModal);
  document.getElementById('btn-empty-submit')?.addEventListener('click', openModal);

  function showModal(el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function hideModal(el) { el.classList.add('hidden'); document.body.style.overflow = ''; }

  document.querySelectorAll('.modal-overlay').forEach(overlayEl => {
    overlayEl.addEventListener('click', e => { if (e.target === overlayEl) hideModal(overlayEl); });
    overlayEl.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => hideModal(overlayEl)));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(hideModal); });

  submitBtn.addEventListener('click', async () => {
    if (!people.length) { go(1); return; }
    if (!finishStep2()) { go(2); return; }
    const offering = parseInt(offeringInput.value, 10);

    // The schema stores one type per record, so each person × category
    // becomes its own record. The offering is split evenly (any remainder
    // goes to the last record) so the records add up to what was entered.
    const records = people.flatMap(p => p.typeIds.map(typeId => ({ name: p.name, typeId })));
    const count = records.length;
    const base = Math.floor(offering / count);
    const remainder = offering - base * count;

    submitBtn.disabled = true;
    try {
      const results = await Promise.all(records.map((r, i) => client.models.MassIntention.create({
        donor: DONOR_NAME,
        type: typeConfig(r.typeId).label,
        names: JSON.stringify([r.name]),
        massDate: dateInput.value || undefined,
        offering: base + (i === count - 1 ? remainder : 0),
        status: 'scheduled',
      })));
      const failed = results.find(r => r.errors);
      if (failed) throw new Error(failed.errors.map(e => e.message).join('; '));

      closeModal();
      window.showToast(`Mass intention submitted — ${people.length} ${people.length === 1 ? 'person' : 'people'}, ${formatPeso(offering)}.`);
    } catch (err) {
      console.error('Failed to submit intention:', err);
      window.showToast(err.message || "Couldn't submit the intention.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ------------------------------------------
     VIEW TABS (My Intentions / Community Intentions)
  ------------------------------------------ */
  const miTabs   = document.querySelectorAll('.mi-tab');
  const miPanels = document.querySelectorAll('.mi-panel');

  miTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      miTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      miPanels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });


  /* ------------------------------------------
     COMMUNITY INTENTIONS (Reader's Sheet)
     A read-aloud, parish-wide view of every mass's
     intentions — mirrors the admin Reader's Sheet.
     Unlike "My Intentions" above, this pulls every
     donor's records (not just DONOR_NAME), since a
     mass intentions sheet is public church-bulletin
     content by nature.
  ------------------------------------------ */
  let allIntentions = [];

  // These DOM lookups and constants are read by renderSheetOptions(),
  // which the observeQuery subscription below can invoke synchronously
  // on first subscribe — so they must be declared (and thus initialized)
  // before that subscription is registered, not after. (Same TDZ pitfall
  // documented for user-donations.js's goal-rendering wiring.)
  const sheetMassSelect = document.getElementById('sheet-mass-select');
  const sheetEmpty        = document.getElementById('sheet-empty');
  const sheetBody           = document.getElementById('sheet-body');
  const sheetMassRange        = document.getElementById('sheet-mass-range');

  const GROUP_TYPE_MAP = {
    'Thanksgiving': 'thanksgiving',
    'Birthday Blessing': 'thanksgiving',
    'Special Intention': 'special',
    'Healing': 'special',
    'For the Soul of...': 'souls',
  };

  const sheetListEls = {
    thanksgiving: document.getElementById('sheet-list-thanksgiving'),
    special: document.getElementById('sheet-list-special'),
    souls: document.getElementById('sheet-list-souls'),
  };

  let currentSheetKey = '';

  function formatShortDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function timeToMinutes(time12) {
    if (!time12) return 0;
    const [time, meridiem] = time12.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + (m || 0);
  }

  /* e.g. "FOR JULY 25, 2026, 6:00 PM MASS" */
  function formatSheetRangeLabel(massDate, massTime) {
    const d = new Date(massDate + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    return massTime ? `FOR ${dateLabel}, ${massTime.toUpperCase()} MASS` : `FOR ${dateLabel} MASS`;
  }

  /* ------------------------------------------
     Category filter (All / one category at a time)
     NOTE: declared before the observeQuery subscription further down,
     since its callback (via renderSheetOptions -> renderSheet ->
     applyCategoryFilter/refreshFindMatches) can run synchronously on
     first subscribe and references these consts/lets.
  ------------------------------------------ */
  const sheetCatBtns   = document.querySelectorAll('.sheet-cat-btn');
  const sheetGroupEls    = document.querySelectorAll('.sheet-group');
  const sheetBoilerplateEl = document.querySelector('.sheet-boilerplate');
  const sheetClosingEl       = document.querySelector('.sheet-closing');

  let activeCategory = 'all';

  function applyCategoryFilter() {
    sheetGroupEls.forEach(g => {
      const show = activeCategory === 'all' || g.dataset.cat === activeCategory;
      g.classList.toggle('sheet-group-filtered-out', !show);
    });
    // The standing intentions aren't part of any one category, so
    // they only make sense in the full "All" view.
    const showStanding = activeCategory === 'all';
    sheetBoilerplateEl?.classList.toggle('sheet-group-filtered-out', !showStanding);
    sheetClosingEl?.classList.toggle('sheet-group-filtered-out', !showStanding);

    refreshFindMatches();
  }

  sheetCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      sheetCatBtns.forEach(b => b.classList.toggle('active', b === btn));
      applyCategoryFilter();
    });
  });

  /* ------------------------------------------
     Find a name (Ctrl+F-style, scoped to the sheet)
  ------------------------------------------ */
  const findInput   = document.getElementById('sheet-find-input');
  const findCount     = document.getElementById('sheet-find-count');
  const findPrevBtn     = document.getElementById('sheet-find-prev');
  const findNextBtn       = document.getElementById('sheet-find-next');
  const findClearBtn        = document.getElementById('sheet-find-clear');

  let findQuery = '';
  let findMatches = [];
  let findActiveIndex = -1;

  function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* Wraps matches of findQuery inside already-escaped HTML text.
     The query is escaped the same way the source text was, so the
     regex only ever matches against literal (already-safe) markup. */
  function highlightText(escapedText, query) {
    const escapedQuery = escapeHtml(query.trim());
    if (!escapedQuery) return escapedText;
    const re = new RegExp(escapeRegExp(escapedQuery), 'gi');
    return escapedText.replace(re, (m) => `<mark class="sheet-highlight">${m}</mark>`);
  }

  function refreshFindMatches() {
    // Only search within whatever category is currently visible —
    // matches hidden by the category filter shouldn't count or be
    // jumped to.
    const scopeEls = activeCategory === 'all'
      ? [sheetListEls.thanksgiving, sheetListEls.special, sheetListEls.souls]
      : [sheetListEls[activeCategory]];
    findMatches = scopeEls.flatMap(el => [...el.querySelectorAll('mark.sheet-highlight')]);
    findActiveIndex = findMatches.length ? 0 : -1;
    updateFindUI();
    if (findActiveIndex >= 0) focusMatch(findActiveIndex);
  }

  function updateFindUI() {
    const hasQuery = findQuery.trim().length > 0;
    findClearBtn.classList.toggle('hidden', !hasQuery);

    if (!hasQuery) {
      findCount.classList.add('hidden');
      findPrevBtn.disabled = true;
      findNextBtn.disabled = true;
      return;
    }

    findCount.classList.remove('hidden');
    findCount.textContent = findMatches.length ? `${findActiveIndex + 1} of ${findMatches.length}` : 'No matches';
    findPrevBtn.disabled = findMatches.length === 0;
    findNextBtn.disabled = findMatches.length === 0;
  }

  function focusMatch(index) {
    findMatches.forEach(m => m.classList.remove('sheet-highlight-active'));
    const el = findMatches[index];
    if (!el) return;
    el.classList.add('sheet-highlight-active');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  findInput.addEventListener('input', () => {
    findQuery = findInput.value;
    renderSheet();
  });

  findInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.shiftKey) findPrevBtn.click(); else findNextBtn.click();
  });

  findNextBtn.addEventListener('click', () => {
    if (!findMatches.length) return;
    findActiveIndex = (findActiveIndex + 1) % findMatches.length;
    updateFindUI();
    focusMatch(findActiveIndex);
  });

  findPrevBtn.addEventListener('click', () => {
    if (!findMatches.length) return;
    findActiveIndex = (findActiveIndex - 1 + findMatches.length) % findMatches.length;
    updateFindUI();
    focusMatch(findActiveIndex);
  });

  findClearBtn.addEventListener('click', () => {
    findInput.value = '';
    findQuery = '';
    renderSheet();
    findInput.focus();
  });

  // Names prayed for at each Mass — no donor or offering (see public-data.js)
  const refreshCommunity = () => loadCommunityIntentions()
    .then(rows => { allIntentions = rows; renderSheetOptions(); })
    .catch(err => console.error('Failed to load community intentions:', err));
  refreshCommunity();
  setInterval(refreshCommunity, 60000);

  function sheetKey(it) { return `${it.massDate}||${it.massTime || ''}`; }

  function getSheetOptions() {
    const map = new Map();
    allIntentions.forEach(it => {
      if (!it.massDate) return;
      const key = sheetKey(it);
      if (!map.has(key)) map.set(key, { massDate: it.massDate, massTime: it.massTime || '', count: 0 });
      map.get(key).count += 1;
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => {
        if (a.massDate !== b.massDate) return a.massDate < b.massDate ? -1 : 1;
        return timeToMinutes(a.massTime) - timeToMinutes(b.massTime);
      });
  }

  function renderSheetOptions() {
    const options = getSheetOptions();
    const hasCurrent = options.some(o => o.key === currentSheetKey);

    sheetMassSelect.innerHTML = `<option value="">Choose a mass date &amp; time…</option>` +
      options.map(o => `
        <option value="${o.key}" ${o.key === currentSheetKey ? 'selected' : ''}>
          ${formatShortDate(o.massDate)}${o.massTime ? ' · ' + escapeHtml(o.massTime) : ''}, ${new Date(o.massDate + 'T00:00:00').getFullYear()} (${o.count} intention${o.count === 1 ? '' : 's'})
        </option>
      `).join('');

    if (!hasCurrent) currentSheetKey = '';
    renderSheet();
  }

  function renderSheet() {
    if (!currentSheetKey) {
      sheetBody.classList.add('hidden');
      sheetEmpty.classList.remove('hidden');
      findMatches = [];
      findActiveIndex = -1;
      updateFindUI();
      return;
    }

    const matching = allIntentions.filter(it => it.massDate && sheetKey(it) === currentSheetKey);

    if (matching.length === 0) {
      sheetBody.classList.add('hidden');
      sheetEmpty.classList.remove('hidden');
      findMatches = [];
      findActiveIndex = -1;
      updateFindUI();
      return;
    }

    sheetEmpty.classList.add('hidden');
    sheetBody.classList.remove('hidden');

    const first = matching[0];
    sheetMassRange.textContent = formatSheetRangeLabel(first.massDate, first.massTime);

    const grouped = { thanksgiving: [], special: [], souls: [] };
    matching.forEach(it => {
      const bucket = GROUP_TYPE_MAP[it.type] || 'special';
      grouped[bucket].push(it);
    });

    Object.entries(grouped).forEach(([bucket, items]) => {
      const listEl = sheetListEls[bucket];
      const emptyNote = listEl.parentElement.querySelector('.sheet-group-empty');

      if (items.length === 0) {
        listEl.innerHTML = '';
        emptyNote.classList.remove('hidden');
        return;
      }
      emptyNote.classList.add('hidden');

      listEl.innerHTML = items.map(it => {
        const names = getNames(it);
        const namesText = names.length ? names.map(nameDisplay).join(' / ') : it.donor;
        const tag = (it.startTime && it.endTime)
          ? ` <span class="sheet-entry-tag">🕐 ${escapeHtml(it.startTime)} – ${escapeHtml(it.endTime)}</span>`
          : '';
        return `${highlightText(escapeHtml(namesText), findQuery)}${tag}`;
      }).join(' / ');
    });

    applyCategoryFilter();
  }

  sheetMassSelect.addEventListener('change', () => {
    currentSheetKey = sheetMassSelect.value;
    findInput.value = '';
    findQuery = '';
    renderSheet();
  });

  document.getElementById('btn-print-sheet').addEventListener('click', () => {
    if (!currentSheetKey) {
      window.showToast("Select a mass to print its intentions.", true);
      return;
    }
    printReadersSheet(); // on the parish letterhead (../print-report.js)
  });


  /* --- Details Modal --- */
  const detailsModal = document.getElementById('details-modal');
  const detailsBody   = document.getElementById('details-body');

  function openDetailsModal(id) {
    const it = myIntentions.find(x => x.id === id);
    if (!it) return;
    const cfg = typeConfig(typeIdFromLabel(it.type));
    const names = getNames(it);

    detailsBody.innerHTML = `
      <div class="details-header-row">
        <div class="intention-icon" style="background-color:${cfg.iconBg};color:${cfg.iconColor};">${cfg.icon}</div>
        <div><p class="intention-type">${escapeHtml(it.type)}</p><span class="badge ${badgeClass[it.status] || 'badge-gray'}" style="font-size:0.625rem;">${statusLabel[it.status] || it.status}</span></div>
      </div>
      <div>
        <p class="details-label">Name${names.length === 1 ? '' : 's'} (${names.length})</p>
        <div class="name-chip-list">${names.map(n => `<span class="name-chip">${escapeHtml(nameDisplay(n))}</span>`).join('')}</div>
      </div>
      <div class="modal-detail-grid">
        <div><p class="modal-detail-item-label">Submitted</p><p class="modal-detail-item-value">${formatShort(it.createdAt)}</p></div>
        <div><p class="modal-detail-item-label">Mass Date</p><p class="modal-detail-item-value">${it.massDate ? formatShort(it.massDate) : 'Awaiting assignment'}</p></div>
        <div><p class="modal-detail-item-label">Offering</p><p class="modal-detail-item-value text-green-700">${formatPeso(it.offering)}</p></div>
        ${it.status === 'cancelled' ? `
        <div><p class="modal-detail-item-label">Reason for Cancellation</p><p class="modal-detail-item-value">${escapeHtml(it.cancelReason) || 'No reason given'}</p></div>` : ''}
      </div>`;

    showModal(detailsModal);
  }

});