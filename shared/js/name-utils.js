/* ============================================
   SacraDigit — Shared Name Field Helpers
   Every place in the app that collects a person's
   name uses FOUR separate fields — first, middle,
   last, extension (Jr., III, etc.) — instead of one
   free-text box, so certificates and other generated
   documents can be formatted correctly and
   consistently (e.g. "Santos, Juan M. Jr.") instead
   of guessing where to split a single string.

   Import from admin pages as:  import { ... } from '../../shared/js/name-utils.js';
   Import from user pages as:   import { ... } from '../../shared/js/name-utils.js';
   (this file lives at the project root, next to amplify-init.js)
   ============================================ */

/**
 * Builds the markup for one name group (4 inputs sharing an id prefix).
 * fieldPrefix 'father-name' -> ids: father-name-first, father-name-middle,
 * father-name-last, father-name-ext.
 */
export function nameFieldsHtml(fieldPrefix, label, { required = false, spanFull = true } = {}) {
  const req = required ? ' <span class="text-red-500">*</span>' : '';
  return `
    <div class="name-field-group${spanFull ? ' sm:col-span-2' : ''}">
      <label class="form-label">${label}${req}</label>
      <div class="name-field-row">
        <input type="text" id="${fieldPrefix}-first" class="form-input" placeholder="First Name" />
        <input type="text" id="${fieldPrefix}-middle" class="form-input" placeholder="Middle Name" />
        <input type="text" id="${fieldPrefix}-last" class="form-input" placeholder="Last Name" />
        <input type="text" id="${fieldPrefix}-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
      </div>
    </div>`;
}

/** Reads the 4 inputs for a name group into { firstName, middleName, lastName, extension }. */
export function readNameFields(fieldPrefix) {
  const get = (suffix) => (document.getElementById(`${fieldPrefix}-${suffix}`)?.value || '').trim();
  return {
    firstName: get('first'),
    middleName: get('middle'),
    lastName: get('last'),
    extension: get('ext'),
  };
}

/** Fills the 4 inputs for a name group from a { firstName, middleName, lastName, extension } object. */
export function setNameFields(fieldPrefix, name) {
  const n = name || {};
  const set = (suffix, value) => { const el = document.getElementById(`${fieldPrefix}-${suffix}`); if (el) el.value = value || ''; };
  set('first', n.firstName);
  set('middle', n.middleName);
  set('last', n.lastName);
  set('ext', n.extension);
  syncExtToggle(document.getElementById(`${fieldPrefix}-ext`), { matchValue: true }); // cleared form → unticked
}

/* ------------------------------------------
   "Add extension" checkbox (phones)
   On small screens the Ext. box (Jr., III) is
   hidden behind a checkbox — most names don't
   have one. Tick it and the box appears; untick
   it and the box is cleared. On wider screens the
   checkbox is hidden and the box always shows
   (CSS: "Name field group" in user-shell.css).
   Works for name groups added later (guardians,
   Mass intention names) too.
   ------------------------------------------ */

const EXT_TOGGLE = 'name-ext-toggle';

function addExtToggle(input) {
  if (!input || input.previousElementSibling?.classList.contains(EXT_TOGGLE)) return;
  const label = document.createElement('label');
  label.className = EXT_TOGGLE;
  label.innerHTML = '<input type="checkbox" class="checkbox-input" /> Add extension (Jr., Sr., III)';
  const box = label.querySelector('input');
  box.addEventListener('change', () => {
    if (box.checked) input.focus();
    else if (input.value) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true })); // let previews/validation catch up
    }
  });
  input.before(label);
  syncExtToggle(input);
}

/**
 * Keeps the checkbox in step with the Ext. box: ticked when it has a value
 * (and, with matchValue, unticked when it's empty), disabled along with it.
 */
export function syncExtToggle(input, { matchValue = false } = {}) {
  const label = input?.previousElementSibling;
  if (!label?.classList.contains(EXT_TOGGLE)) return;
  const box = label.querySelector('input');
  const hasValue = !!input.value.trim();
  if (hasValue || matchValue) box.checked = hasValue;
  box.disabled = input.disabled;
  label.classList.toggle('is-disabled', input.disabled);
}

// Styles travel with the feature so every portal (parishioner, admin, ITech,
// Media) gets the same phone layout without each stylesheet copying it.
const EXT_STYLE = `
  .name-ext-toggle { display: none; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: #4b5563; cursor: pointer; padding: 0.25rem 0; }
  .name-ext-toggle .checkbox-input { width: 1rem; height: 1rem; accent-color: #8b8fc7; cursor: pointer; flex-shrink: 0; }
  .name-ext-toggle.is-disabled { opacity: 0.5; cursor: default; }
  :root[data-theme="dark"] .name-ext-toggle { color: #c4c9d3; }
  /* Phones: one box per line, and the Ext. box only once its checkbox is ticked. */
  @media (max-width: 640px) {
    .name-field-row, .marriage-cell-name-row { grid-template-columns: 1fr !important; }
    .name-ext-toggle { display: flex; }
    .name-ext-toggle:not(:has(input:checked)) + .name-ext-input { display: none; }
  }
`;

/* A visible "First / Middle / Last / Ext." label over each box, so it's
   still clear which box is which once they're filled in (placeholders
   vanish as soon as you type). */
const NAME_PARTS = { first: 'First', middle: 'Middle', last: 'Last', ext: 'Ext. (Jr., III)' };

function labelNameParts(row) {
  if (row.classList.contains('has-part-labels')) return;
  const inputs = [...row.querySelectorAll(':scope > input')];
  const parts = inputs.map(i => (i.id.match(/-(first|middle|last|ext)$/) || [])[1]);
  if (!inputs.length || parts.some(p => !p)) return;
  inputs.forEach((input, n) => {
    const label = document.createElement('label');
    label.className = `name-part-label name-part-${parts[n]}`;
    label.htmlFor = input.id;
    label.textContent = NAME_PARTS[parts[n]];
    // The phone "Add extension" checkbox must stay right before the Ext. box.
    const anchor = input.previousElementSibling?.classList.contains(EXT_TOGGLE) ? input.previousElementSibling : input;
    anchor.before(label);
  });
  row.classList.add('has-part-labels');
}

const PART_STYLE = `
  .name-field-row.has-part-labels { grid-auto-flow: column; grid-template-rows: auto auto; row-gap: 0.2rem; }
  .name-part-label { font-size: 0.75rem; font-weight: 600; color: #4b5563; }
  :root[data-theme="dark"] .name-part-label { color: #b6bdca; }
  @media (max-width: 640px) {
    .name-field-row.has-part-labels { grid-auto-flow: row; grid-template-rows: none; }
    .name-field-row.has-part-labels > input:not(:last-child) { margin-bottom: 0.4rem; }
    .name-part-label.name-part-ext { display: none; }
  }
`;

/** Adds the checkbox to every Ext. box on the page, now and as forms are built. */
export function initExtToggles(root = document.body) {
  if (!document.getElementById('name-ext-styles')) {
    const st = document.createElement('style');
    st.id = 'name-ext-styles';
    st.textContent = EXT_STYLE + PART_STYLE;
    document.head.appendChild(st);
  }
  root.querySelectorAll('.name-ext-input').forEach(addExtToggle);
  root.querySelectorAll('.name-field-row').forEach(labelNameParts);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes') { syncExtToggle(m.target); continue; } // "Not applicable" disables the boxes
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches('.name-ext-input')) addExtToggle(n);
        n.querySelectorAll?.('.name-ext-input').forEach(addExtToggle);
        if (n.matches('.name-field-row')) labelNameParts(n);
        n.querySelectorAll?.('.name-field-row').forEach(labelNameParts);
      });
    }
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}

/** True once both first and last name are filled in (the minimum for a usable name). */
export function nameFieldsFilled(fieldPrefix) {
  const n = readNameFields(fieldPrefix);
  return !!(n.firstName && n.lastName);
}

/** True when a name object has nothing entered in any of its 4 parts. */
export function isNameEmpty(n) {
  return !n || !((n.firstName || '').trim() || (n.middleName || '').trim() || (n.lastName || '').trim() || (n.extension || '').trim());
}

export function middleInitial(middleName) {
  const m = (middleName || '').trim();
  return m ? m.charAt(0).toUpperCase() + '.' : '';
}

/** "Juan Miguel Santos Jr." — first middle last extension, for on-certificate body text. */
export function formatFullName(n) {
  if (!n) return '';
  const parts = [n.firstName, n.middleName, n.lastName].map(s => (s || '').trim()).filter(Boolean);
  let out = parts.join(' ');
  const ext = (n.extension || '').trim();
  if (ext) out += (out ? ' ' : '') + ext;
  return out;
}

/** "Santos, Juan M. Jr." — last, first M.I. extension, for tables/registers/search. */
export function formatLastFirstMI(n) {
  if (!n) return '';
  const last = (n.lastName || '').trim();
  const first = (n.firstName || '').trim();
  const mi = middleInitial(n.middleName);
  const ext = (n.extension || '').trim();
  if (!last && !first) return '';
  let out = last ? (first ? `${last}, ${first}` : last) : first;
  if (mi) out += ` ${mi}`;
  if (ext) out += ` ${ext}`;
  return out;
}
