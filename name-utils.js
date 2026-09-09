/* ============================================
   SacraDigit — Shared Name Field Helpers
   Every place in the app that collects a person's
   name uses FOUR separate fields — first, middle,
   last, extension (Jr., III, etc.) — instead of one
   free-text box, so certificates and other generated
   documents can be formatted correctly and
   consistently (e.g. "Santos, Juan M. Jr.") instead
   of guessing where to split a single string.

   Import from admin pages as:  import { ... } from '../name-utils.js';
   Import from user pages as:   import { ... } from '../name-utils.js';
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
