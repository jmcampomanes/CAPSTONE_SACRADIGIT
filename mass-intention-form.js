/* ============================================
   SacraDigit — Mass Intention form (3 numbered steps)
     1 Intention — categories (one or more) | who it's for
                   (First / Middle / Last, extension checkbox)
                   → "Add to prayer list", as many as needed
     2 Prayer List & Weekend — the list (Name · Intentions ·
                   Edit / Remove) | weekend calendar, offering
     3 Confirm — review, then save

   Shared by the parishioner's Submit a Mass Intention page
   (user/user-mass-intentions.js) and the admin's Add / Edit
   Mass Intention (Sacradigit/mass-intentions.js). The admin
   version (role: 'admin') also asks for the donor, the exact
   Mass day and time, and the status, and can edit an
   existing record — or, once its Mass day has come, only
   its status ("locked").

   The page saves through onSubmit(data); this file only
   draws the form and checks it. Styles:
   mass-intention-form.css (+ marriage-request-form.css for
   the numbered bar).
   ============================================ */

import { readNameFields, setNameFields, nameFieldsFilled, formatFullName } from './name-utils.js';
import { createWeekendCalendar, formatWeekend, formatDay } from './weekend-calendar.js';

/** Lowest offering a parishioner can give for one intention (any number of names).
    The Parish Assistant quotes the same amount (assistant-knowledge.js). */
export const MIN_INTENTION_OFFERING = 50;

const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const peso = (n) => '₱' + (n || 0).toLocaleString('en-US');
const nameOf = (n) => formatFullName(typeof n === 'string' ? { firstName: n } : (n || {}));

// Friendlier wording for the category cards (the stored `type` stays the type's label).
const CAT_TEXT = {
  soul: ['For a departed soul', 'For the repose of someone who has died'],
  thanksgiving: ['Thanksgiving', 'Gratitude for blessings received'],
  healing: ['Healing', 'For someone who is sick or recovering'],
  birthday: ['Birthday blessing', 'For someone celebrating a birthday'],
  special: ['Special intention', 'Any other prayer intention'],
};

const ICON_BACK = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
const ICON_PLUS = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>';
const ICON_CHECK = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7"/></svg>';
const CHECK = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';

function markup({ admin, title, sub }) {
  const nameField = (key, label, req) => `
    <div class="mi-field mi-field-${key === 'middle' ? 'mi' : key}">
      <label class="mi-label" for="mi-name-${key}">${label}${req ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input type="text" id="mi-name-${key}" class="form-input mi-input" autocomplete="off" />
    </div>`;
  return `
    <div class="modal-card">
      <div class="modal-header mi-page-header">
        <button type="button" class="mi-page-back" data-mi-close>${ICON_BACK}<span>Back</span></button>
        <div class="min-w-0">
          <h3 class="modal-title" id="mi-page-title">${esc(title)}</h3>
          <p class="mi-page-sub" id="mi-page-sub">${esc(sub)}</p>
        </div>
      </div>
      <div class="modal-body mi-page-body">
        <div class="mi-wiz">
          <p id="mi-locked-note" class="mi-locked-note hidden">This Mass is today or already past, so only its status can still be changed.</p>
          <ol class="mstep-bar mi-step-bar" aria-label="Steps" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
            <li><button type="button" class="mstep-dot" data-step="1"><span class="mstep-num">1</span><span class="mstep-label">Intention</span></button></li>
            <li><button type="button" class="mstep-dot" data-step="2"><span class="mstep-num">2</span><span class="mstep-label">Prayer List &amp; ${admin ? 'Mass' : 'Weekend'}</span></button></li>
            <li><button type="button" class="mstep-dot" data-step="3"><span class="mstep-num">3</span><span class="mstep-label">Confirm</span></button></li>
          </ol>

          <section class="mi-step" data-step="1">
            <div class="mi-cols">
              <div class="mi-col">
                <h4 class="mi-step-title">What would you like to pray for?</h4>
                <p class="mi-step-hint">Tap one or more. Tap again to unselect.</p>
                <div class="mi-cat-grid" id="mi-cat-grid" role="group" aria-label="Intention categories"></div>
              </div>
              <div class="mi-col">
                ${admin ? `
                <div class="mi-donor">
                  <label class="mi-label" for="mi-donor">Donor name <span class="text-red-500">*</span></label>
                  <input type="text" id="mi-donor" class="form-input mi-input" placeholder="e.g. Santos Family" autocomplete="off" />
                </div>` : ''}
                <h4 class="mi-step-title${admin ? ' mi-step-title-2' : ''}">Who is this Mass for?</h4>
                <div class="mi-name-grid">
                  ${nameField('first', 'First name', true)}${nameField('middle', 'Middle name', false)}${nameField('last', 'Last name', true)}
                  <div class="mi-field mi-field-ext">
                    <label class="mi-ext-toggle"><input type="checkbox" id="mi-ext-toggle" class="checkbox-input" /> Add extension (Jr., Sr., III)</label>
                    <input type="text" id="mi-name-ext" class="form-input mi-input hidden" maxlength="6" placeholder="e.g. Jr., III" aria-label="Extension (Jr., Sr., III)" autocomplete="off" />
                  </div>
                </div>
                <button type="button" class="mi-add-person" id="mi-add-person">${ICON_PLUS}<span id="mi-add-person-label">Add to prayer list</span></button>
                <p id="mi-added-note" class="mi-added-note hidden" aria-live="polite"></p>
              </div>
            </div>
          </section>

          <section class="mi-step hidden" data-step="2">
            <div class="mi-cols mi-cols-2b">
              <div class="mi-col mi-col-list">
                <div id="mi-list-wrap" class="mi-list-wrap">
                  <h4 class="mi-step-title">Prayer list <span id="mi-list-count" class="mi-optional"></span></h4>
                  <p class="mi-step-hint">Everyone the Mass will be offered for.</p>
                  <div class="mi-table-wrap">
                    <table class="mi-table">
                      <thead><tr><th>Name</th><th>Intentions</th><th class="mi-th-act"><span class="sr-only">Actions</span></th></tr></thead>
                      <tbody id="mi-list"></tbody>
                    </table>
                    <p id="mi-list-empty" class="mi-list-empty">No one on the list yet.</p>
                  </div>
                  <button type="button" class="mi-add-person mi-add-another" id="mi-add-another">${ICON_PLUS} Add another person</button>
                </div>
              </div>
              <div class="mi-col">
                <h4 class="mi-step-title">${admin ? 'Mass date assigned' : 'Which weekend?'}</h4>
                <p class="mi-step-hint">${admin ? 'Optional — pick the exact Saturday or Sunday Mass, or leave it blank to assign later.' : 'Optional — leave it blank and the parish office will choose a weekend for you.'}</p>
                <div id="mi-date-cal"></div>
                ${admin ? `
                <div class="mi-admin-row">
                  <div>
                    <label class="mi-label" for="mi-mass-time">Mass time</label>
                    <input type="time" id="mi-mass-time" class="form-input mi-input" />
                  </div>
                  <div>
                    <label class="mi-label" for="mi-status">Status</label>
                    <select id="mi-status" class="form-input mi-input mi-field-select">
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>` : ''}
                <h4 class="mi-step-title mi-step-title-2">${admin ? 'Offering' : 'Your offering'}</h4>
                <p class="mi-step-hint" id="mi-offering-hint"></p>
                <div class="mi-offer-row" id="mi-offer-presets" role="group" aria-label="Offering amount"></div>
                <label class="mi-label" for="mi-offering">Amount</label>
                <div class="offering-input-wrap mi-offer-input">
                  <span class="offering-peso">₱</span>
                  <input type="number" id="mi-offering" class="form-input offering-input mi-input" min="0" step="50" inputmode="numeric" />
                </div>
              </div>
            </div>
          </section>

          <section class="mi-step hidden" data-step="3">
            <h4 class="mi-step-title">${admin ? 'Check the intention' : 'Please check your intention'}</h4>
            <p class="mi-step-hint">If something is wrong, tap Change.</p>
            <div id="mi-review"></div>
          </section>
        </div>
      </div>
      <div class="modal-footer mi-page-footer">
        <button type="button" class="btn-secondary mi-nav-btn" id="mi-back">Cancel</button>
        <button type="button" class="btn-lavender mi-nav-btn" id="mi-next">Next →</button>
        <button type="button" class="btn-lavender mi-nav-btn hidden" id="mi-submit">${ICON_CHECK}<span id="mi-submit-label">Submit Intention</span></button>
      </div>
    </div>`;
}

/**
 * Builds the form inside `modal` (an empty `.modal-overlay.mi-page` element).
 * @param {HTMLElement} modal
 * @param {object} opts
 * @param {'parishioner'|'admin'} [opts.role]
 * @param {Array<{id,label,iconBg,iconColor,icon}>} opts.intentionTypes
 * @param {(data: object) => Promise<void>} opts.onSubmit  throws to keep the form open
 * @param {(msg: string, isError?: boolean) => void} [opts.toast]
 * @param {number} [opts.minOffering]  parishioner: MIN_INTENTION_OFFERING (one offering covers the whole intention)
 * @returns {{ open(prefill?: object): void, close(): void }}
 *   prefill (admin edit): { title, submitLabel, donor, people:[{name,typeIds}], offering, massDate, massTime24, status, locked }
 *   onSubmit data: { donor, people, records:[{name,typeId,offering}], offering, massDate, massTime24, status, lockedOnly }
 */
export function createIntentionForm(modal, {
  role = 'parishioner',
  intentionTypes,
  onSubmit,
  toast = (...a) => window.showToast?.(...a),
  minOffering = role === 'admin' ? 1 : MIN_INTENTION_OFFERING,
}) {
  const admin = role === 'admin';
  const defaults = admin
    ? { title: 'Add Mass Intention', sub: 'Log an intention for a walk-in or phone request.', submitLabel: 'Save Intention' }
    : { title: 'Submit a Mass Intention', sub: 'Offer a Mass for a loved one — living or departed, in thanksgiving or for healing.', submitLabel: 'Submit Intention' };
  modal.innerHTML = markup({ admin, ...defaults });

  const $ = (id) => modal.querySelector('#' + id);
  const typeConfig = (id) => intentionTypes.find(t => t.id === id) || intentionTypes[intentionTypes.length - 1];
  const catTitle = (id) => CAT_TEXT[id]?.[0] || typeConfig(id).label;
  const chipsHtml = (ids) => ids.map(id => { const t = typeConfig(id); return `<span class="mi-chip mi-chip-cat" style="background-color:${t.iconBg};color:${t.iconColor};">${esc(catTitle(id))}</span>`; }).join('');
  const NAME_IDS = ['mi-name-first', 'mi-name-middle', 'mi-name-last', 'mi-name-ext'];

  const catGrid = $('mi-cat-grid'), listEl = $('mi-list'), addBtn = $('mi-add-person'), addBtnLabel = $('mi-add-person-label');
  const offeringInput = $('mi-offering'), presetsEl = $('mi-offer-presets'), offeringHint = $('mi-offering-hint'), reviewEl = $('mi-review');
  const backBtn = $('mi-back'), nextBtn = $('mi-next'), submitBtn = $('mi-submit');
  const extToggle = $('mi-ext-toggle'), extInput = $('mi-name-ext');
  const steps = [...modal.querySelectorAll('.mi-step')];
  const dots = [...modal.querySelectorAll('.mi-step-bar .mstep-dot')];

  let step = 1, furthest = 1;
  let chosen = new Set();   // categories for the person being entered
  let people = [];          // [{ name, typeIds }]
  let editingIndex = null;  // person being edited, or null when adding
  let offeringTouched = false;
  let locked = false;       // admin edit on/after the Mass day: status only
  let massDate = '';

  const calendar = createWeekendCalendar($('mi-date-cal'), {
    weekendsOnly: true,
    mode: admin ? 'day' : 'weekend',
    onChange: (v) => { massDate = v; },
  });

  const intentionCount = () => people.reduce((n, p) => n + p.typeIds.length, 0);
  const nameStarted = () => NAME_IDS.some(id => $(id).value.trim());
  function flag(el) {
    el.classList.add('border-red-400');
    el.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
  }

  /* --- step 1 · categories --- */
  catGrid.innerHTML = intentionTypes.map(t => `
    <button type="button" class="mi-cat" data-type-id="${t.id}" aria-pressed="false">
      <span class="mi-cat-icon" style="background-color:${t.iconBg};color:${t.iconColor};">${t.icon}</span>
      <span class="mi-cat-text"><span class="mi-cat-title">${esc(catTitle(t.id))}</span><span class="mi-cat-hint">${esc(CAT_TEXT[t.id]?.[1] || '')}</span></span>
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
    if (!b || locked) return;
    const id = b.dataset.typeId;
    chosen.has(id) ? chosen.delete(id) : chosen.add(id);
    catGrid.classList.remove('mi-invalid');
    paintCats();
  });

  /* --- step 1 · extension checkbox --- */
  function syncExt(focus = false) {
    extInput.classList.toggle('hidden', !extToggle.checked);
    if (!extToggle.checked) extInput.value = '';
    else if (focus) extInput.focus();
  }
  extToggle.addEventListener('change', () => syncExt(true));

  /* --- prayer list --- */
  function renderPeople() {
    $('mi-list-count').textContent = people.length ? `(${people.length})` : '';
    $('mi-list-empty').classList.toggle('hidden', people.length > 0);
    listEl.closest('table').classList.toggle('hidden', !people.length);
    listEl.innerHTML = people.map((p, i) => `
      <tr class="mi-person-row${i === editingIndex ? ' is-editing' : ''}">
        <td class="mi-td-name">${esc(nameOf(p.name))}</td>
        <td class="mi-td-cats"><span class="mi-chips">${chipsHtml(p.typeIds)}</span></td>
        <td class="mi-td-act">${locked ? '' : `
          <button type="button" class="mi-person-btn" data-edit="${i}">Edit</button>
          <button type="button" class="mi-person-btn mi-person-btn-remove" data-remove="${i}" aria-label="Remove ${esc(nameOf(p.name))}">Remove</button>`}
        </td>
      </tr>`).join('');
    addBtnLabel.textContent = editingIndex !== null ? 'Save changes' : 'Add to prayer list';
    const note = $('mi-added-note');
    note.classList.toggle('hidden', !people.length);
    note.innerHTML = people.length ? `<strong>${people.length}</strong> ${people.length === 1 ? 'person' : 'people'} on ${admin ? 'the' : 'your'} prayer list — add more, or tap <strong>Next</strong> to review the list.` : '';
    $('mi-add-another').classList.toggle('hidden', locked);
  }

  /** Clears the category + name fields (or loads person `index` to edit). */
  function startPerson(index = null) {
    editingIndex = index;
    const p = index === null ? null : people[index];
    chosen = new Set(p ? p.typeIds : []);
    paintCats();
    const nm = p ? (typeof p.name === 'string' ? { firstName: p.name } : p.name) : {};
    setNameFields('mi-name', nm);
    extToggle.checked = !!(nm.extension || '').trim();
    syncExt();
    NAME_IDS.forEach(id => $(id).classList.remove('border-red-400'));
    catGrid.classList.remove('mi-invalid');
    renderPeople();
  }

  /** Adds (or saves) the person in the fields. Returns false if something's missing. */
  function addPerson() {
    let ok = true;
    if (!chosen.size) { catGrid.classList.add('mi-invalid'); ok = false; }
    if (!nameFieldsFilled('mi-name')) {
      ['mi-name-first', 'mi-name-last'].forEach(id => { if (!$(id).value.trim()) flag($(id)); });
      ok = false;
    }
    if (!ok) {
      toast(!chosen.size ? 'Tap one of the intentions above first.' : 'Please enter a first and last name.', true);
      return false;
    }
    const person = { name: readNameFields('mi-name'), typeIds: intentionTypes.map(t => t.id).filter(id => chosen.has(id)) };
    if (editingIndex === null) people.push(person); else people[editingIndex] = person;
    startPerson();
    return true;
  }

  // Adding stays on step 1 so more people can be added; saving an edit returns to the list.
  addBtn.addEventListener('click', () => {
    const wasEditing = editingIndex !== null;
    if (!addPerson()) return;
    if (wasEditing) { go(2); return; }
    toast(`${nameOf(people[people.length - 1].name)} added to the prayer list.`);
    $('mi-name-first').focus({ preventScroll: true });
  });
  $('mi-add-another').addEventListener('click', () => { startPerson(); go(1); });
  NAME_IDS.forEach(id => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } }));
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

  /* --- step 2 · offering --- */
  function renderOffering() {
    offeringHint.textContent = admin
      ? 'The amount the donor gave for this whole intention.'
      : `The minimum offering is ₱${minOffering}. One offering covers your whole intention, no matter how many names or intentions are on your list.`;
    if (!offeringTouched && !offeringInput.value) offeringInput.value = admin ? '' : minOffering;
    const current = Number(offeringInput.value);
    presetsEl.innerHTML = [MIN_INTENTION_OFFERING, 100, 300, 500].map((a) => `
      <button type="button" class="mi-offer${current === a ? ' selected' : ''}" data-amount="${a}" aria-pressed="${current === a}" ${locked ? 'disabled' : ''}>${peso(a)}</button>`).join('');
  }
  presetsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.mi-offer');
    if (!b || b.disabled) return;
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

  /* --- step 3 · review --- */
  const time12 = (t24) => {
    if (!t24) return '';
    let [h, m] = t24.split(':').map(Number);
    const mer = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${mer}`;
  };
  function renderReview() {
    const row = (dt, dd, cls = '') => `<div><dt>${dt}</dt><dd${cls ? ` class="${cls}"` : ''}>${dd}</dd></div>`;
    const when = admin
      ? (massDate ? esc(formatDay(massDate)) : 'Not assigned yet')
      : (massDate ? esc(formatWeekend(massDate)) : 'The parish office will choose');
    reviewEl.innerHTML = `
      <div class="mi-review-card">
        <div class="mi-review-head"><span>Praying for (${people.length})</span>${locked ? '' : '<button type="button" class="mi-link" data-goto="1">Change</button>'}</div>
        <div class="mi-review-table">
          <table class="mi-table">
            <thead><tr><th>Name</th><th>Intentions</th></tr></thead>
            <tbody>${people.map(p => `<tr><td class="mi-td-name">${esc(nameOf(p.name))}</td><td class="mi-td-cats"><span class="mi-chips">${chipsHtml(p.typeIds)}</span></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <div class="mi-review-card">
        <div class="mi-review-head"><span>Mass &amp; offering</span><button type="button" class="mi-link" data-goto="2">Change</button></div>
        <dl class="mi-review-rows">
          ${admin ? row('Donor', esc($('mi-donor').value.trim())) : ''}
          ${row(admin ? 'Mass day' : 'Weekend', when)}
          ${admin && massDate ? row('Mass time', esc(time12($('mi-mass-time').value)) || '—') : ''}
          ${admin ? row('Status', esc($('mi-status').selectedOptions[0]?.textContent || '')) : ''}
          ${row('Intentions', intentionCount())}
          ${row('Offering', peso(Number(offeringInput.value) || 0), 'mi-review-total')}
        </dl>
      </div>`;
  }

  /* --- moving between steps --- */
  function go(n) {
    step = Math.max(locked ? 2 : 1, Math.min(3, n));
    furthest = Math.max(furthest, step);
    steps.forEach(s => s.classList.toggle('hidden', Number(s.dataset.step) !== step));
    dots.forEach(d => {
      const k = Number(d.dataset.step);
      d.classList.toggle('is-current', k === step);
      d.classList.toggle('is-done', k < furthest && k !== step);
      d.disabled = k > furthest || (locked && k === 1);
      d.setAttribute('aria-current', k === step ? 'step' : 'false');
    });
    if (step === 1) renderPeople();
    if (step === 2) { renderPeople(); renderOffering(); }
    if (step === 3) renderReview();
    backBtn.textContent = step === 1 || (locked && step === 2) ? (people.length && !locked ? '← Back to prayer list' : 'Cancel') : '← Back';
    nextBtn.classList.toggle('hidden', step === 3);
    submitBtn.classList.toggle('hidden', step !== 3);
    nextBtn.textContent = step === 1 ? 'Next: Prayer List →' : 'Next: Confirm →';
    modal.querySelector('.mi-page-body').scrollTop = 0;
  }

  function finishStep1() {
    if (admin && !$('mi-donor').value.trim()) { flag($('mi-donor')); toast('Please enter the donor\'s name.', true); return false; }
    if (nameStarted() || (chosen.size && !people.length) || editingIndex !== null) {
      if (!addPerson()) return false;
    }
    if (!people.length) {
      catGrid.classList.add('mi-invalid');
      flag($('mi-name-first'));
      toast('Tap one of the intentions above first, then enter the person’s name.', true);
      return false;
    }
    return true;
  }

  function finishStep2() {
    if (locked) return true;
    if (!people.length) {
      // Empty list: back to step 1, where the first thing to do is pick an intention.
      startPerson();
      go(1);
      catGrid.classList.add('mi-invalid');
      toast('Tap one of the intentions above first, then enter the person’s name.', true);
      catGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    const amount = parseInt(offeringInput.value, 10);
    if (!amount || amount < minOffering) {
      flag(offeringInput);
      toast(minOffering > 1 ? `The offering must be at least ₱${minOffering}.` : 'Please enter the offering amount.', true);
      return false;
    }
    return true;
  }

  nextBtn.addEventListener('click', () => {
    if (step === 1 && finishStep1()) go(2);
    else if (step === 2 && finishStep2()) go(3);
  });
  backBtn.addEventListener('click', () => {
    if (step === 1 || (locked && step === 2)) {
      if (!people.length || locked) { close(); return; }
      startPerson(); // drop the unsaved edit/new person
      go(2);
    } else go(step - 1);
  });
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-mi-close]')) { close(); return; }
    const target = Number(e.target.closest('[data-goto]')?.dataset.goto || e.target.closest('.mi-step-bar .mstep-dot:not(:disabled)')?.dataset.step || 0);
    if (!target || target === step) return;
    if (target < step) { go(target); return; }
    if (step === 1 && !finishStep1()) return;
    if (target === 3 && step <= 2 && !finishStep2()) { go(2); return; }
    go(target);
  });

  submitBtn.addEventListener('click', async () => {
    if (!locked && !people.length) { go(1); return; }
    if (!finishStep2()) { go(2); return; }
    const offering = parseInt(offeringInput.value, 10) || 0;
    // One record per person per category; the offering is split evenly
    // (remainder on the last) so the records add up to what was entered.
    const flat = people.flatMap(p => p.typeIds.map(typeId => ({ name: p.name, typeId })));
    const base = flat.length ? Math.floor(offering / flat.length) : 0;
    const remainder = offering - base * flat.length;
    const records = flat.map((r, i) => ({ ...r, offering: base + (i === flat.length - 1 ? remainder : 0) }));
    const data = {
      donor: admin ? $('mi-donor').value.trim() : undefined,
      people, records, offering, massDate,
      massTime24: admin ? $('mi-mass-time').value : '',
      status: admin ? $('mi-status').value : 'scheduled',
      lockedOnly: locked,
    };
    submitBtn.disabled = true;
    try {
      await onSubmit(data);
      close();
    } catch (err) {
      console.error('Failed to save the intention:', err);
      toast(err.message || "Couldn't save the intention.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* --- open / close --- */
  function setLocked(on) {
    locked = on;
    $('mi-locked-note').classList.toggle('hidden', !on);
    modal.querySelectorAll('.mi-wiz input, .mi-wiz select, .mi-wiz button:not(.mstep-dot):not(.mi-link)').forEach(el => {
      if (el.id !== 'mi-status') el.disabled = on;
    });
  }

  function open(prefill = {}) {
    $('mi-page-title').textContent = prefill.title || defaults.title;
    $('mi-submit-label').textContent = prefill.submitLabel || defaults.submitLabel;
    people = (prefill.people || []).map(p => ({ name: p.name, typeIds: [...p.typeIds] }));
    furthest = people.length ? 2 : 1;
    offeringTouched = prefill.offering != null;
    offeringInput.value = prefill.offering ?? '';
    offeringInput.classList.remove('border-red-400');
    massDate = prefill.massDate || '';
    calendar.set(massDate);
    if (admin) {
      $('mi-donor').value = prefill.donor || '';
      $('mi-donor').classList.remove('border-red-400');
      $('mi-mass-time').value = prefill.massTime24 || '';
      $('mi-status').value = prefill.status || 'scheduled';
    }
    setLocked(!!prefill.locked);
    startPerson();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    go(people.length ? 2 : 1); // editing opens on the prayer list
  }

  function close() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

  return { open, close };
}
