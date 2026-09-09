/* ============================================
   SacraDigit — User Request Certificate Scripts (AWS Amplify)
   Runs after user-shell.js.
   requesterName is hardcoded to match the demo
   user in user-shell.js until real parishioner
   login exists.
   ============================================ */

import { client } from '../amplify-init.js';
import { nameFieldsHtml, readNameFields, setNameFields, nameFieldsFilled, formatFullName, isNameEmpty } from '../name-utils.js';
import { regionOptionsHtml, cityOptionsHtml, OTHER_CITY_VALUE } from '../ph-locations.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = 'Maria P. Santos';
  const PARISH_NAME = 'Our Lady of Fatima Parish';

  // Options for the Baptismal Certificate's "Add Guardian" relationship
  // dropdown — "Other" reveals a free-text field to specify.
  const GUARDIAN_RELATIONSHIPS = [
    'Mother', 'Father', 'Grandfather', 'Grandmother', 'Aunt', 'Uncle',
    'Cousin', 'Older Brother', 'Older Sister', 'Godmother', 'Godfather', 'Other',
  ];

  // Shared bounds for every date-of-event field on this form: nothing
  // can be dated in the future, and a 4-digit-year floor keeps the native
  // date picker's year spinner (which otherwise accepts up to 6 digits)
  // from producing garbage dates like "20000-11-11".
  const TODAY_ISO = new Date().toISOString().slice(0, 10);
  const MIN_DATE_ISO = '1900-01-01';

  /** True for a real, sensible YYYY-MM-DD date: exactly 4 year digits
      (rules out the "20000-11-11" overflow bug) and not further in the
      future than this year or further back than 1900 (rules out typos
      like "9909" that are syntactically a valid 4-digit year but not a
      plausible date). */
  function isReasonableDate(iso) {
    if (!iso) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const year = Number(iso.slice(0, 4));
    return year >= 1900 && year <= new Date().getFullYear();
  }

  /** Clears + flags a date input once it holds a settled, unreasonable
      value. Listens on 'blur' (not 'change'/'input') so it only judges
      the value after the user is done editing that field, never mid-type. */
  function guardDateInputRange(el) {
    el.addEventListener('blur', () => {
      if (el.value && !isReasonableDate(el.value)) {
        el.value = '';
        window.showToast('Please enter a valid, real date (year between 1900 and this year).', true);
      }
    });
  }

  const certTypes = [
    { id: 'baptismal', name: 'Baptismal Certificate', desc: 'Proof of baptism recorded at the parish.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>`,
      // These mirror exactly what appears on the printed Certificate of
      // Baptism (see baptismal-certificate-print.html) — Bk./Page/Line,
      // the officiating priest, and the issue date are filled in by the
      // parish office from the register, not asked of the requester here.
      // Rendering, validation, and data collection for this type are all
      // custom (see renderBaptismalFieldsHtml / validateAndCollectBaptismal
      // below) — it needs a guardian sub-section, a Region/City picker,
      // and a repeatable godparent list that the generic field-array
      // renderer used by the other 4 certificate types can't express.
      // This `fields` array only documents the field ids/labels that end
      // up as keys in the stored `details` JSON.
      baptismalCustom: true,
      fields: [
        { id: 'baptized-name', label: 'Full Name of Baptized Person', kind: 'name', required: true },
        { id: 'birth-date', label: 'Date of Birth', type: 'date', required: true },
        { id: 'birthplace', label: 'Place of Birth', required: true },
        { id: 'baptism-date', label: 'Date of Baptism', type: 'date', required: true },
        { id: 'father-name', label: "Father's Full Name", kind: 'name', required: true },
        { id: 'mother-name', label: "Mother's Maiden Name", kind: 'name', required: true },
        { id: 'sponsor-1', label: 'Principal Sponsor (Godparent) 1', kind: 'name', required: false },
        { id: 'sponsor-2', label: 'Principal Sponsor (Godparent) 2', kind: 'name', required: false },
      ] },
    { id: 'confirmation', name: 'Confirmation Certificate', desc: 'Proof of confirmation sacrament.',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      // These mirror exactly what appears on the printed Confirmation
      // Certificate (see confirmation-certificate-print.html) — the
      // confirming bishop and the certificate's issue date are filled
      // in by the parish office from the register, not asked of the
      // requester here.
      fields: [
        { id: 'confirmed-name', label: 'Full Name of Confirmand', kind: 'name', required: true },
        { id: 'father-name', label: "Father's Name", kind: 'name', required: false },
        { id: 'mother-name', label: "Mother's Name", kind: 'name', required: false },
        { id: 'baptism-date', label: 'Date of Baptism', type: 'date', required: false },
        { id: 'baptism-church', label: 'Church of Baptism', placeholder: 'e.g. Our Lady of Fatima Parish', required: false },
        { id: 'confirmation-name', label: 'Confirmation Name (Saint Name)', placeholder: 'e.g. Teresa', required: false },
        { id: 'confirmation-date', label: 'Approximate Date of Confirmation', type: 'date', required: false },
        { id: 'sponsor-name', label: "Sponsor's Name", kind: 'name', required: false },
      ] },
    { id: 'first-communion', name: 'First Communion Certificate', desc: 'Proof of First Holy Communion.',
      iconBg: 'rgba(180,140,60,0.16)', iconColor: '#8a6d1f',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 3h12l-1 8.5a5 5 0 01-10 0L6 3z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 16.5V21m-3.5 0h7"/></svg>`,
      // These mirror exactly what appears on the printed First Communion
      // Certificate (see first-communion-certificate-print.html) — the
      // catechist, officiating priest, Book/Page/Line, and the issue
      // date are filled in by the parish office from the register, not
      // asked of the requester here. Purpose is already collected below
      // as a general field, so it isn't repeated per certificate type.
      fields: [
        { id: 'fc-name', label: 'Full Name of Communicant', kind: 'name', required: true },
        { id: 'fc-communion-date', label: 'Approximate Date of First Communion', type: 'date', required: false },
      ] },
    { id: 'marriage', name: 'Marriage Certificate', desc: 'Parish record of a Catholic marriage.',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
      // These mirror exactly what appears on the printed Marriage
      // Certificate (see marriage-certificate-print.html) — a streamlined
      // parish-style certificate, not the full PSA civil-registrar form.
      // The officiating priest, Bk./Page/Line, and the issue date are
      // filled in by the parish office from the register, not asked of
      // the requester here.
      fields: [
        { id: 'groom-name', label: "Groom's Full Name", kind: 'name', required: true },
        { id: 'bride-name', label: "Bride's Full Name", kind: 'name', required: true },
        { id: 'groom-father', label: "Groom's Father's Name", kind: 'name', required: false },
        { id: 'groom-mother', label: "Groom's Mother's Name", kind: 'name', required: false },
        { id: 'bride-father', label: "Bride's Father's Name", kind: 'name', required: false },
        { id: 'bride-mother', label: "Bride's Mother's Name", kind: 'name', required: false },
        { id: 'marriage-date', label: 'Date of Marriage', type: 'date', required: false },
        { id: 'marriage-place', label: 'Place of Marriage', placeholder: 'e.g. Our Lady of Fatima Parish', required: false },
        { id: 'witness-1', label: 'Witness 1', kind: 'name', required: false },
        { id: 'witness-2', label: 'Witness 2', kind: 'name', required: false },
      ] },
    { id: 'death', name: 'Death Certificate', desc: 'Parish record of a Catholic burial or funeral mass.',
      iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
      // These mirror exactly what appears on the printed Death
      // Certificate (see death-certificate-print.html) — the
      // officiating priest, Bk./Page/Line, and the issue date are
      // filled in by the parish office from the register, not asked
      // of the requester here.
      fields: [
        { id: 'deceased-name', label: 'Full Name of Deceased', kind: 'name', required: true },
        { id: 'age', label: 'Age at Time of Death', placeholder: 'e.g. 78', required: false },
        { id: 'death-date', label: 'Approximate Date of Death', type: 'date', required: false },
        { id: 'place-of-death', label: 'Place of Death', placeholder: 'e.g. Quezon City', required: false },
        { id: 'burial-date', label: 'Date of Burial', type: 'date', required: false },
        { id: 'burial-place', label: 'Place of Burial', placeholder: 'e.g. Loyola Memorial Park', required: false },
        { id: 'requester-rel', label: 'Relationship to Deceased', placeholder: 'e.g. Son, Daughter, Spouse', required: true },
      ] },
  ];

  let selectedType = null;
  let godparentCounter = 2; // Sponsor 1 & 2 are the first two; "Add More Godparents" continues from here.

  const menuView        = document.getElementById('menu-view');
  const formView         = document.getElementById('form-view');
  const certTypeGrid   = document.getElementById('cert-type-grid');
  const requestFormWrap = document.getElementById('request-form-wrap');
  const formTypeLabel   = document.getElementById('form-type-label');
  const dynamicFields    = document.getElementById('dynamic-fields');
  const successBanner    = document.getElementById('success-banner');
  const successDesc       = document.getElementById('success-desc');
  const confirmModal       = document.getElementById('confirm-modal');
  const confirmDetailsGrid = document.getElementById('confirm-details-grid');

  // Holds the validated { details, purpose, notes } collected by the
  // Submit button while the Review & Confirm modal is open, so
  // "Confirm & Submit" can act on it without re-reading the form (which
  // may no longer match what was reviewed if the modal design changes
  // later) and "Back to Edit" can simply close the modal and leave the
  // form exactly as the requester left it.
  let pendingSubmission = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatShortDate(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isNameShaped(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v) &&
      ('firstName' in v || 'middleName' in v || 'lastName' in v || 'extension' in v);
  }

  /* Turns one raw `details` value into readable preview text, or null to
     skip it entirely (mirrors the same-purpose helper in
     user-my-requests.js, which formats these same shapes for display
     after they're saved). */
  function formatPreviewValue(key, value) {
    if (isNameShaped(value)) return isNameEmpty(value) ? null : formatFullName(value);
    if (key === 'guardian' && value && typeof value === 'object') {
      const name = formatFullName(value.name);
      if (!name) return null;
      const bday = value.birthdate ? formatShortDate(value.birthdate) : '';
      return `${name} (${value.relationship || 'Guardian'})${bday ? ` — b. ${bday}` : ''}`;
    }
    if (Array.isArray(value)) {
      const parts = value
        .map(g => {
          const name = formatFullName(g && g.name);
          return name ? `${name}${g.role ? ` (${g.role})` : ''}` : null;
        })
        .filter(Boolean);
      return parts.length ? parts.join(', ') : null;
    }
    return value === null || value === undefined || value === '' ? null : String(value);
  }

  // Ordered, human-labeled list of the Baptismal Certificate's custom
  // `details` keys for the review preview — 'birthplace' is skipped since
  // it's just region+city combined into one derived string (kept only
  // for the admin's Generate Certificate prefill; see validateAndCollectBaptismal).
  const BAPTISMAL_PREVIEW_FIELDS = [
    { key: 'baptized-name', label: 'Full Name of Baptized Person' },
    { key: 'birth-date', label: 'Date of Birth', isDate: true },
    { key: 'birth-region', label: 'Region of Birth' },
    { key: 'birth-city', label: 'City/Municipality of Birth' },
    { key: 'baptism-date', label: 'Date of Baptism', isDate: true },
    { key: 'guardian', label: 'Guardian' },
    { key: 'father-name', label: "Father's Name" },
    { key: 'mother-name', label: "Mother's Name" },
    { key: 'sponsor-1', label: 'Sponsor 1' },
    { key: 'sponsor-2', label: 'Sponsor 2' },
    { key: 'extraGodparents', label: 'Additional Godparents' },
  ];

  function buildPreviewGridHtml(details, purpose, notes) {
    const rows = [];
    const fieldList = selectedType.baptismalCustom
      ? BAPTISMAL_PREVIEW_FIELDS
      : selectedType.fields.map(f => ({ key: f.id, label: f.label, isDate: f.type === 'date' }));

    fieldList.forEach(({ key, label, isDate }) => {
      const raw = details[key];
      const value = isDate ? (raw ? formatShortDate(raw) : null) : formatPreviewValue(key, raw);
      if (value) rows.push([label, value]);
    });

    rows.push(['Purpose of Request', purpose]);
    if (notes) rows.push(['Additional Notes', notes]);

    return `<tbody>${rows.map(([label, value]) => `
      <tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody>`;
  }

  function openConfirmModal() {
    confirmDetailsGrid.innerHTML = buildPreviewGridHtml(pendingSubmission.details, pendingSubmission.purpose, pendingSubmission.notes);
    confirmModal.classList.remove('hidden');
  }

  function closeConfirmModal() {
    confirmModal.classList.add('hidden');
  }

  document.querySelectorAll('[data-close-confirm-modal]').forEach(btn => btn.addEventListener('click', closeConfirmModal));
  document.getElementById('btn-back-to-edit').addEventListener('click', closeConfirmModal);
  confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirmModal(); });

  certTypeGrid.innerHTML = certTypes.map(c => `
    <button type="button" class="cert-type-card" data-id="${c.id}">
      <div class="cert-icon" style="background-color:${c.iconBg};color:${c.iconColor};">${c.icon}</div>
      <p class="cert-type-name">${c.name}</p>
      <p class="cert-type-desc">${c.desc}</p>
      <span class="cert-type-cta">Start request
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
      </span>
    </button>`).join('');

  certTypeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.cert-type-card');
    if (card) selectType(card.dataset.id);
  });

  function selectType(id) {
    selectedType = certTypes.find(c => c.id === id);
    if (!selectedType) return;

    document.querySelectorAll('.cert-type-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
    formTypeLabel.textContent = selectedType.name;

    if (selectedType.baptismalCustom) {
      godparentCounter = 2;
      dynamicFields.innerHTML = renderBaptismalFieldsHtml();
      wireBaptismalFields();
    } else {
      dynamicFields.innerHTML = selectedType.fields.map(f => {
        if (f.kind === 'name') return nameFieldsHtml(f.id, f.label, { required: f.required, spanFull: true });
        return `
        <div>
          <label class="form-label" for="${f.id}">${f.label}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
          ${f.type === 'date'
            ? `<input type="date" id="${f.id}" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />`
            : `<input type="text" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />`}
        </div>`;
      }).join('');
      selectedType.fields.filter(f => f.type === 'date').forEach(f => guardDateInputRange(document.getElementById(f.id)));
    }

    menuView.classList.add('hidden');
    formView.classList.remove('hidden');
    requestFormWrap.classList.remove('hidden');
    successBanner.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToMenu() {
    selectedType = null;
    pendingSubmission = null;
    confirmModal.classList.add('hidden');
    formView.classList.add('hidden');
    menuView.classList.remove('hidden');
    successBanner.classList.add('hidden');
    requestFormWrap.classList.remove('hidden');
    document.querySelectorAll('.cert-type-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('#request-form-wrap input, #request-form-wrap textarea').forEach(el => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------
     BAPTISMAL CERTIFICATE — custom fields
     (guardian sub-section, Region/City picker,
     repeatable godparent list)
  ------------------------------------------ */
  function renderBaptismalFieldsHtml() {
    return `
      ${nameFieldsHtml('baptized-name', 'Full Name of Baptized Person', { required: true, spanFull: true })}

      <div>
        <label class="form-label" for="birth-date">Date of Birth <span class="text-red-500">*</span></label>
        <input type="date" id="birth-date" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
      </div>

      <div class="sm:col-span-2">
        <label class="form-label">Place of Birth <span class="text-red-500">*</span></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
          <select id="birth-region" class="form-input">${regionOptionsHtml()}</select>
          <select id="birth-city" class="form-input" disabled>${cityOptionsHtml('')}</select>
        </div>
        <input type="text" id="birth-city-other" class="form-input mt-2 hidden" placeholder="Enter city/municipality" />
      </div>

      <div>
        <label class="form-label" for="baptism-date">Date of Baptism <span class="text-red-500">*</span></label>
        <input type="date" id="baptism-date" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
      </div>

      <div class="sm:col-span-2">
        <label class="field-na-label" style="font-size:0.8125rem;color:#374151;">
          <input type="checkbox" id="guardian-toggle" class="checkbox-input" />
          This child is being presented by a guardian (not the parents)
        </label>
      </div>

      <div class="form-subblock hidden" id="guardian-fields">
        <div class="sm:col-span-2">
          <label class="form-label" for="guardian-relationship">Guardian's Relationship to the Child <span class="text-red-500">*</span></label>
          <select id="guardian-relationship" class="form-input">
            <option value="">Select relationship…</option>
            ${GUARDIAN_RELATIONSHIPS.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="sm:col-span-2 hidden" id="guardian-relationship-other-wrap">
          <label class="form-label" for="guardian-relationship-other">Specify Relationship <span class="text-red-500">*</span></label>
          <input type="text" id="guardian-relationship-other" class="form-input" placeholder="e.g. Family friend" />
        </div>
        ${nameFieldsHtml('guardian-name', "Guardian's Full Name", { required: true, spanFull: true })}
        <div class="sm:col-span-2">
          <label class="form-label" for="guardian-birthdate">Guardian's Birthday <span class="text-red-500">*</span></label>
          <input type="date" id="guardian-birthdate" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
          <p class="text-xs text-gray-400 mt-1">The guardian must be older than the person being baptized.</p>
        </div>
      </div>

      <div class="sm:col-span-2 name-field-group">
        <div class="field-na-row">
          <label class="form-label" style="margin-bottom:0;">Father's Full Name <span class="text-red-500 father-name-required-mark">*</span></label>
          <label class="field-na-label"><input type="checkbox" id="father-name-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
        </div>
        <div class="name-field-row">
          <input type="text" id="father-name-first" class="form-input" placeholder="First Name" />
          <input type="text" id="father-name-middle" class="form-input" placeholder="Middle Name" />
          <input type="text" id="father-name-last" class="form-input" placeholder="Last Name" />
          <input type="text" id="father-name-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
        </div>
      </div>

      <div class="sm:col-span-2 name-field-group">
        <div class="field-na-row">
          <label class="form-label" style="margin-bottom:0;">Mother's Full Maiden Name <span class="text-red-500 mother-name-required-mark">*</span></label>
          <label class="field-na-label"><input type="checkbox" id="mother-name-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
        </div>
        <div class="name-field-row">
          <input type="text" id="mother-name-first" class="form-input" placeholder="First Name" />
          <input type="text" id="mother-name-middle" class="form-input" placeholder="Middle Name" />
          <input type="text" id="mother-name-last" class="form-input" placeholder="Last Name" />
          <input type="text" id="mother-name-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
        </div>
      </div>

      ${nameFieldsHtml('sponsor-1', 'Principal Sponsor (Godparent) 1', { required: false, spanFull: true })}
      ${nameFieldsHtml('sponsor-2', 'Principal Sponsor (Godparent) 2', { required: false, spanFull: true })}

      <div class="sm:col-span-2" id="godparents-extra-container"></div>
      <button type="button" id="btn-add-godparent" class="btn-add-row">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add More Godparents
      </button>
    `;
  }

  function godparentRowHtml(n) {
    return `
      <div class="repeatable-row" data-godparent-row data-n="${n}">
        <button type="button" class="repeatable-row-remove" aria-label="Remove this godparent">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        ${nameFieldsHtml(`godparent-extra-${n}`, `Godparent ${n + 1}`, { required: true, spanFull: true })}
        <div>
          <label class="form-label" for="godparent-extra-${n}-role">Role <span class="text-red-500">*</span></label>
          <select id="godparent-extra-${n}-role" class="form-input">
            <option value="">Select…</option>
            <option value="Godmother">Godmother</option>
            <option value="Godfather">Godfather</option>
          </select>
        </div>
      </div>`;
  }

  function wireBaptismalFields() {
    [document.getElementById('birth-date'), document.getElementById('baptism-date'), document.getElementById('guardian-birthdate')]
      .forEach(guardDateInputRange);

    const regionEl = document.getElementById('birth-region');
    const cityEl = document.getElementById('birth-city');
    const cityOtherEl = document.getElementById('birth-city-other');

    regionEl.addEventListener('change', () => {
      cityEl.innerHTML = cityOptionsHtml(regionEl.value);
      cityEl.disabled = !regionEl.value;
      cityOtherEl.classList.add('hidden');
      cityOtherEl.value = '';
    });

    cityEl.addEventListener('change', () => {
      cityOtherEl.classList.toggle('hidden', cityEl.value !== OTHER_CITY_VALUE);
      if (cityEl.value !== OTHER_CITY_VALUE) cityOtherEl.value = '';
    });

    const guardianToggle = document.getElementById('guardian-toggle');
    const guardianFields = document.getElementById('guardian-fields');
    guardianToggle.addEventListener('change', () => {
      guardianFields.classList.toggle('hidden', !guardianToggle.checked);
      if (!guardianToggle.checked) {
        document.getElementById('guardian-relationship').value = '';
        document.getElementById('guardian-relationship-other-wrap').classList.add('hidden');
        document.getElementById('guardian-relationship-other').value = '';
        setNameFields('guardian-name', null);
        document.getElementById('guardian-birthdate').value = '';
      }
      updateParentFieldsState();
    });

    // A guardian is presenting the child in place of the parents, so
    // once "Add Guardian" is checked, the Father's/Mother's Name fields
    // are grayed out (disabled) and no longer marked required — they
    // stay grayed out regardless of their own N/A checkbox state until
    // the guardian toggle is unchecked again.
    function updateParentFieldsState() {
      const guardianOn = guardianToggle.checked;
      [
        { prefix: 'father-name', naId: 'father-name-na', markClass: 'father-name-required-mark' },
        { prefix: 'mother-name', naId: 'mother-name-na', markClass: 'mother-name-required-mark' },
      ].forEach(({ prefix, naId, markClass }) => {
        const naCheckbox = document.getElementById(naId);
        const inputs = [`${prefix}-first`, `${prefix}-middle`, `${prefix}-last`, `${prefix}-ext`]
          .map(id => document.getElementById(id));
        const requiredMark = document.querySelector(`.${markClass}`);
        const disabled = guardianOn || naCheckbox.checked;
        inputs.forEach(el => { el.disabled = disabled; });
        naCheckbox.disabled = guardianOn;
        if (requiredMark) requiredMark.classList.toggle('hidden', disabled);
      });
    }

    const relationshipEl = document.getElementById('guardian-relationship');
    const relationshipOtherWrap = document.getElementById('guardian-relationship-other-wrap');
    relationshipEl.addEventListener('change', () => {
      relationshipOtherWrap.classList.toggle('hidden', relationshipEl.value !== 'Other');
      if (relationshipEl.value !== 'Other') document.getElementById('guardian-relationship-other').value = '';
    });

    function wireNotApplicable(checkboxId, fieldPrefix) {
      const checkbox = document.getElementById(checkboxId);
      const inputs = [`${fieldPrefix}-first`, `${fieldPrefix}-middle`, `${fieldPrefix}-last`, `${fieldPrefix}-ext`]
        .map(id => document.getElementById(id));
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) inputs.forEach(el => { el.value = ''; });
        updateParentFieldsState();
      });
    }
    wireNotApplicable('father-name-na', 'father-name');
    wireNotApplicable('mother-name-na', 'mother-name');
    updateParentFieldsState();

    const godparentsContainer = document.getElementById('godparents-extra-container');
    document.getElementById('btn-add-godparent').addEventListener('click', () => {
      godparentCounter += 1;
      godparentsContainer.insertAdjacentHTML('beforeend', godparentRowHtml(godparentCounter));
    });

    godparentsContainer.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.repeatable-row-remove');
      if (!removeBtn) return;
      removeBtn.closest('[data-godparent-row]')?.remove();
    });
  }

  /* Validates and collects the Baptismal Certificate's custom fields.
     Mirrors the shape of flagInvalid()/allFilled from the generic
     submit handler below — called from there when selectedType is
     the baptismal type. */
  function validateAndCollectBaptismal(flagInvalid) {
    let allFilled = true;
    const details = {};

    details['baptized-name'] = readNameFields('baptized-name');
    if (!nameFieldsFilled('baptized-name')) {
      allFilled = false;
      flagInvalid(document.getElementById('baptized-name-first'));
      flagInvalid(document.getElementById('baptized-name-last'));
    }

    const birthDateEl = document.getElementById('birth-date');
    details['birth-date'] = birthDateEl.value;
    if (!birthDateEl.value) { allFilled = false; flagInvalid(birthDateEl); }
    else if (!isReasonableDate(birthDateEl.value)) { allFilled = false; flagInvalid(birthDateEl); }

    const regionEl = document.getElementById('birth-region');
    const cityEl = document.getElementById('birth-city');
    const cityOtherEl = document.getElementById('birth-city-other');
    const cityValue = cityEl.value === OTHER_CITY_VALUE ? cityOtherEl.value.trim() : cityEl.value;
    if (!regionEl.value) { allFilled = false; flagInvalid(regionEl); }
    if (!cityValue) { allFilled = false; flagInvalid(cityEl.value === OTHER_CITY_VALUE ? cityOtherEl : cityEl); }
    details['birth-region'] = regionEl.value;
    details['birth-city'] = cityValue;
    // Kept as a single formatted string too, under the same 'birthplace'
    // key the admin's Generate Certificate modal already reads from a
    // parishioner's request — so that prefill keeps working unchanged.
    details['birthplace'] = [cityValue, regionEl.value].filter(Boolean).join(', ');

    const baptismDateEl = document.getElementById('baptism-date');
    details['baptism-date'] = baptismDateEl.value;
    if (!baptismDateEl.value) { allFilled = false; flagInvalid(baptismDateEl); }
    else if (!isReasonableDate(baptismDateEl.value)) { allFilled = false; flagInvalid(baptismDateEl); }

    const guardianToggle = document.getElementById('guardian-toggle');
    if (guardianToggle.checked) {
      const relationshipEl = document.getElementById('guardian-relationship');
      const relationshipOtherEl = document.getElementById('guardian-relationship-other');
      const guardianBirthdateEl = document.getElementById('guardian-birthdate');

      let relationship = relationshipEl.value;
      if (!relationship) { allFilled = false; flagInvalid(relationshipEl); }
      if (relationship === 'Other') {
        if (!relationshipOtherEl.value.trim()) { allFilled = false; flagInvalid(relationshipOtherEl); }
        relationship = relationshipOtherEl.value.trim() || 'Other';
      }

      const guardianName = readNameFields('guardian-name');
      if (!nameFieldsFilled('guardian-name')) {
        allFilled = false;
        flagInvalid(document.getElementById('guardian-name-first'));
        flagInvalid(document.getElementById('guardian-name-last'));
      }

      if (!guardianBirthdateEl.value) {
        allFilled = false;
        flagInvalid(guardianBirthdateEl);
      } else if (!isReasonableDate(guardianBirthdateEl.value)) {
        allFilled = false;
        flagInvalid(guardianBirthdateEl);
      } else if (birthDateEl.value && guardianBirthdateEl.value >= birthDateEl.value) {
        // ISO yyyy-mm-dd strings compare correctly lexicographically —
        // an earlier (smaller) date means the guardian is older.
        allFilled = false;
        flagInvalid(guardianBirthdateEl);
        window.showToast('The guardian must be older than the person being baptized.', true);
      }

      details['guardian'] = {
        relationship,
        name: guardianName,
        birthdate: guardianBirthdateEl.value,
      };
    } else {
      details['guardian'] = null;
    }

    // A guardian being present already accounts for the parents not
    // being here to state their names, so father's/mother's names are
    // grayed out and not required once "Add Guardian" is checked —
    // matching the visual state set by updateParentFieldsState().
    const fatherNa = guardianToggle.checked || document.getElementById('father-name-na').checked;
    if (fatherNa) {
      details['father-name'] = null;
    } else {
      details['father-name'] = readNameFields('father-name');
      if (!nameFieldsFilled('father-name')) {
        allFilled = false;
        flagInvalid(document.getElementById('father-name-first'));
        flagInvalid(document.getElementById('father-name-last'));
      }
    }

    const motherNa = guardianToggle.checked || document.getElementById('mother-name-na').checked;
    if (motherNa) {
      details['mother-name'] = null;
    } else {
      details['mother-name'] = readNameFields('mother-name');
      if (!nameFieldsFilled('mother-name')) {
        allFilled = false;
        flagInvalid(document.getElementById('mother-name-first'));
        flagInvalid(document.getElementById('mother-name-last'));
      }
    }

    details['sponsor-1'] = readNameFields('sponsor-1');
    details['sponsor-2'] = readNameFields('sponsor-2');

    const extraGodparents = [];
    document.querySelectorAll('#godparents-extra-container [data-godparent-row]').forEach(row => {
      const n = row.dataset.n;
      const prefix = `godparent-extra-${n}`;
      const roleEl = document.getElementById(`${prefix}-role`);
      const name = readNameFields(prefix);
      if (!nameFieldsFilled(prefix)) {
        allFilled = false;
        flagInvalid(document.getElementById(`${prefix}-first`));
        flagInvalid(document.getElementById(`${prefix}-last`));
      }
      if (!roleEl.value) { allFilled = false; flagInvalid(roleEl); }
      extraGodparents.push({ name, role: roleEl.value });
    });
    details['extraGodparents'] = extraGodparents;

    return { allFilled, details };
  }

  document.getElementById('btn-back-to-menu').addEventListener('click', goToMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!confirmModal.classList.contains('hidden')) { closeConfirmModal(); return; }
    if (!formView.classList.contains('hidden')) goToMenu();
  });

  document.getElementById('btn-submit-request').addEventListener('click', async () => {
    if (!selectedType) return;

    let allFilled = true;
    let details = {};

    function flagInvalid(el) {
      if (!el) return;
      el.classList.add('border-red-400');
      el.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
    }

    if (selectedType.baptismalCustom) {
      const result = validateAndCollectBaptismal(flagInvalid);
      allFilled = result.allFilled;
      details = result.details;
    } else {
      selectedType.fields.forEach(f => {
        if (f.kind === 'name') {
          details[f.id] = readNameFields(f.id);
          if (f.required && !nameFieldsFilled(f.id)) {
            allFilled = false;
            flagInvalid(document.getElementById(`${f.id}-first`));
            flagInvalid(document.getElementById(`${f.id}-last`));
          }
          return;
        }
        const el = document.getElementById(f.id);
        details[f.id] = el ? el.value.trim() : '';
        if (f.required && (!el || !el.value.trim())) {
          allFilled = false;
          flagInvalid(el);
        } else if (f.type === 'date' && el && el.value && !isReasonableDate(el.value)) {
          allFilled = false;
          flagInvalid(el);
        }
      });
    }

    const purposeEl = document.getElementById('field-purpose');
    const notesEl = document.getElementById('field-notes');
    if (!purposeEl.value.trim()) {
      allFilled = false;
      purposeEl.classList.add('border-red-400');
      purposeEl.addEventListener('input', () => purposeEl.classList.remove('border-red-400'), { once: true });
    }

    const parishConfirmEl = document.getElementById('field-parish-confirm');
    let parishConfirmMissing = false;
    if (parishConfirmEl && !parishConfirmEl.checked) {
      allFilled = false;
      parishConfirmMissing = true;
      const parishConfirmLabel = parishConfirmEl.closest('label');
      if (parishConfirmLabel) {
        parishConfirmLabel.classList.add('text-red-500');
        parishConfirmEl.addEventListener('change', () => {
          if (parishConfirmEl.checked) parishConfirmLabel.classList.remove('text-red-500');
        }, { once: true });
      }
    }

    if (!allFilled) {
      window.showToast(
        parishConfirmMissing
          ? 'Please confirm this event took place at Our Lady of Fatima Parish before submitting.'
          : 'Please fill in all required fields.',
        true
      );
      return;
    }

    // Everything's valid — don't submit yet. Hold the collected data and
    // show a Review & Confirm preview so the requester can catch a
    // mistake and go back to edit instead of submitting blind.
    pendingSubmission = {
      details,
      purpose: purposeEl.value.trim(),
      notes: notesEl.value.trim(),
    };
    openConfirmModal();
  });

  document.getElementById('btn-confirm-submit').addEventListener('click', async () => {
    if (!selectedType || !pendingSubmission) return;

    const confirmBtn = document.getElementById('btn-confirm-submit');
    confirmBtn.disabled = true;

    try {
      const result = await client.models.CertificateRequest.create({
        requesterName: REQUESTER_NAME,
        certificateType: selectedType.name,
        purpose: pendingSubmission.purpose,
        notes: pendingSubmission.notes || undefined,
        details: JSON.stringify(pendingSubmission.details),
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeConfirmModal();
      requestFormWrap.classList.add('hidden');
      successBanner.classList.remove('hidden');
      successDesc.textContent = `Your request for a ${selectedType.name} has been submitted. You'll be notified when it's ready for pick-up (typically 3–5 working days).`;
      window.scrollTo({ top: 0, behavior: 'smooth' });

      window.showToast(`${selectedType.name} request submitted successfully.`);
      document.querySelectorAll('.cert-type-card').forEach(c => c.classList.remove('selected'));
      selectedType = null;
      pendingSubmission = null;
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      confirmBtn.disabled = false;
    }
  });

  document.getElementById('btn-new-request').addEventListener('click', goToMenu);

});