/* ============================================
   SacraDigit — Baptismal / Confirmation / First Communion
   request forms, step by step (same look as Marriage)

   Shared by the parishioner's Request a Certificate page
   (user/user-request-certificate.js) and the admin's
   walk-in / phone request on Record Requests
   (Sacradigit/record-requests.js), so both ask the same
   things, in the same steps, and store the same `details`
   (keys Generate Certificate reads — don't rename them).

     Baptismal       Baptized → Family → Godparents → Confirm
     Confirmation    Confirmand → Family → Sponsor → Confirm
     First Communion Communicant → Confirm

   createCertStepForm() renders a type's fields, wires them
   (guardian section, Region/City, Add More Godparents,
   Confirmation Name…), then moves each block into its step.
   "Next" runs the type's own checks but only blocks on —
   and highlights — what's missing in the current step.

   Styles: marriage-request-form.css (.mwiz / .mstep-*).
   ============================================ */

import { nameFieldsHtml, readNameFields, setNameFields, nameFieldsFilled } from './name-utils.js';
import { regionOptionsHtml, cityOptionsHtml, OTHER_CITY_VALUE } from './ph-locations.js';
import { confirmationNameOptionsHtml, OTHER_NAME_VALUE as OTHER_SAINT_NAME_VALUE } from './saint-names.js';
import { GUARDIAN_RELATIONSHIPS, TODAY_ISO, MIN_DATE_ISO, isReasonableDate, guardDateInputRange } from './marriage-request-form.js';
import { stepHistory } from './step-history.js';

const PARISH_NAME = 'Our Lady of Fatima Parish';
let godparentCounter = 2; // Sponsor 1 & 2 are the first two; "Add More Godparents" continues from here.

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
      <label class="field-na-label" style="font-size:0.8125rem;">
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
   page's submit handler — called from there when the type is
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
      window.showToast?.('The guardian must be older than the person being baptized.', true);
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

/* ------------------------------------------
   CONFIRMATION CERTIFICATE — custom fields
   (guardian sub-section mirroring the Baptismal
   Certificate's, independent N/A toggles on
   Father's/Mother's names, Confirmation Name
   dropdown with an "Other" fallback)
------------------------------------------ */
function renderConfirmationFieldsHtml() {
  return `
    ${nameFieldsHtml('confirmed-name', 'Full Name of Confirmand', { required: true, spanFull: true })}

    <div>
      <label class="form-label" for="baptism-date">Date of Baptism</label>
      <input type="date" id="baptism-date" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
    </div>

    <div>
      <label class="form-label" for="confirmation-name">Confirmation Name (Saint Name) <span class="text-red-500">*</span></label>
      <select id="confirmation-name" class="form-input">${confirmationNameOptionsHtml()}</select>
      <input type="text" id="confirmation-name-other" class="form-input mt-2 hidden" placeholder="Enter confirmation name" />
    </div>

    <div class="sm:col-span-2">
      <label class="form-label" for="confirmation-date">Approximate Date of Confirmation</label>
      <input type="date" id="confirmation-date" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
    </div>

    <div class="sm:col-span-2">
      <label class="field-na-label" style="font-size:0.8125rem;">
        <input type="checkbox" id="guardian-toggle" class="checkbox-input" />
        This person is being presented by a guardian (not the parents)
      </label>
    </div>

    <div class="form-subblock hidden" id="guardian-fields">
      <div class="sm:col-span-2">
        <label class="form-label" for="guardian-relationship">Guardian's Relationship to the Confirmand <span class="text-red-500">*</span></label>
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

    ${nameFieldsHtml('sponsor-name', "Sponsor's Name", { required: false, spanFull: true })}
  `;
}

function wireConfirmationFields() {
  [document.getElementById('baptism-date'), document.getElementById('confirmation-date'), document.getElementById('guardian-birthdate')]
    .forEach(guardDateInputRange);

  const confirmationNameEl = document.getElementById('confirmation-name');
  const confirmationNameOtherEl = document.getElementById('confirmation-name-other');
  confirmationNameEl.addEventListener('change', () => {
    confirmationNameOtherEl.classList.toggle('hidden', confirmationNameEl.value !== OTHER_SAINT_NAME_VALUE);
    if (confirmationNameEl.value !== OTHER_SAINT_NAME_VALUE) confirmationNameOtherEl.value = '';
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

  // Same "guardian supersedes parents" graying-out behavior as the
  // Baptismal Certificate's identically-structured block — see
  // wireBaptismalFields() above for the fuller explanation. Kept as
  // a separate copy (not a shared helper) so the two certificate
  // types' forms can't accidentally affect each other.
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
}

/* Validates and collects the Confirmation Certificate's custom
   fields. Mirrors validateAndCollectBaptismal() above. */
function validateAndCollectConfirmation(flagInvalid) {
  let allFilled = true;
  const details = {};

  details['confirmed-name'] = readNameFields('confirmed-name');
  if (!nameFieldsFilled('confirmed-name')) {
    allFilled = false;
    flagInvalid(document.getElementById('confirmed-name-first'));
    flagInvalid(document.getElementById('confirmed-name-last'));
  }

  const baptismDateEl = document.getElementById('baptism-date');
  details['baptism-date'] = baptismDateEl.value;
  if (baptismDateEl.value && !isReasonableDate(baptismDateEl.value)) {
    allFilled = false;
    flagInvalid(baptismDateEl);
  }

  // Church of Baptism isn't asked of the requester — this parish only
  // has records for itself, so it's always Our Lady of Fatima Parish.
  // Stored under the same 'baptism-church' key the admin's Generate
  // Certificate modal already reads from a parishioner's request, so
  // that prefill keeps working unchanged (see record-requests.js).
  details['baptism-church'] = PARISH_NAME;

  const confirmationNameEl = document.getElementById('confirmation-name');
  const confirmationNameOtherEl = document.getElementById('confirmation-name-other');
  const confirmationNameValue = confirmationNameEl.value === OTHER_SAINT_NAME_VALUE
    ? confirmationNameOtherEl.value.trim()
    : confirmationNameEl.value;
  if (!confirmationNameValue) {
    allFilled = false;
    flagInvalid(confirmationNameEl.value === OTHER_SAINT_NAME_VALUE ? confirmationNameOtherEl : confirmationNameEl);
  }
  details['confirmation-name'] = confirmationNameValue;

  const confirmationDateEl = document.getElementById('confirmation-date');
  details['confirmation-date'] = confirmationDateEl.value;
  if (confirmationDateEl.value && !isReasonableDate(confirmationDateEl.value)) {
    allFilled = false;
    flagInvalid(confirmationDateEl);
  }

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

    // Unlike the Baptismal Certificate, this form doesn't collect the
    // confirmand's own date of birth, so there's no field to compare
    // the guardian's birthdate against for an "older than" check —
    // only a sanity check on the guardian's own birthdate is possible.
    if (!guardianBirthdateEl.value) {
      allFilled = false;
      flagInvalid(guardianBirthdateEl);
    } else if (!isReasonableDate(guardianBirthdateEl.value)) {
      allFilled = false;
      flagInvalid(guardianBirthdateEl);
    }

    details['guardian'] = {
      relationship,
      name: guardianName,
      birthdate: guardianBirthdateEl.value,
    };
  } else {
    details['guardian'] = null;
  }

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

  details['sponsor-name'] = readNameFields('sponsor-name');

  return { allFilled, details };
}

/* ------------------------------------------
   FIRST COMMUNION — two fields
------------------------------------------ */
export const FIRST_COMMUNION_FIELDS = [
  { id: 'fc-name', label: 'Full Name of Communicant', kind: 'name', required: true },
  { id: 'fc-communion-date', label: 'Approximate Date of First Communion', type: 'date', required: false },
];

function renderFirstCommunionFieldsHtml() {
  return FIRST_COMMUNION_FIELDS.map(f => f.kind === 'name'
    ? nameFieldsHtml(f.id, f.label, { required: f.required, spanFull: true })
    : `
      <div>
        <label class="form-label" for="${f.id}">${f.label}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
        <input type="date" id="${f.id}" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
      </div>`).join('');
}

function validateAndCollectFirstCommunion(flagInvalid) {
  let allFilled = true;
  const details = {};
  FIRST_COMMUNION_FIELDS.forEach(f => {
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
    if (el && el.value && !isReasonableDate(el.value)) { allFilled = false; flagInvalid(el); }
  });
  return { allFilled, details };
}

/* ------------------------------------------
   THE STEPS
------------------------------------------ */
export const CERT_STEPS = {
  baptismal: [
    { label: 'Baptized', title: 'Baptized person', hint: 'Who was baptized, and when and where they were born.',
      ids: ['baptized-name-first', 'birth-date', 'birth-region', 'baptism-date'] },
    { label: 'Family', title: 'Family', hint: 'Parents, or a guardian if one signs instead.',
      ids: ['guardian-toggle', 'guardian-fields', 'father-name-first', 'mother-name-first'] },
    { label: 'Godparents', title: 'Godparents', hint: 'Principal sponsors (ninong and ninang) — optional.',
      ids: ['sponsor-1-first', 'sponsor-2-first', 'godparents-extra-container', 'btn-add-godparent'] },
  ],
  confirmation: [
    { label: 'Confirmand', title: 'Confirmand', hint: 'Who was confirmed, and their confirmation name.',
      ids: ['confirmed-name-first', 'baptism-date', 'confirmation-name', 'confirmation-date'] },
    { label: 'Family', title: 'Family', hint: 'Parents, or a guardian if one signs instead.',
      ids: ['guardian-toggle', 'guardian-fields', 'father-name-first', 'mother-name-first'] },
    { label: 'Sponsor', title: 'Sponsor', hint: 'The confirmation sponsor — optional.',
      ids: ['sponsor-name-first'] },
  ],
  'first-communion': [
    { label: 'Communicant', title: 'Communicant', hint: 'Who received First Holy Communion, and about when.',
      ids: ['fc-name-first', 'fc-communion-date'] },
  ],
};

const FORMS = {
  baptismal: { render: () => { godparentCounter = 2; return renderBaptismalFieldsHtml(); }, wire: () => wireBaptismalFields(), check: (flag) => validateAndCollectBaptismal(flag) },
  confirmation: { render: () => renderConfirmationFieldsHtml(), wire: () => wireConfirmationFields(), check: (flag) => validateAndCollectConfirmation(flag) },
  'first-communion': { render: renderFirstCommunionFieldsHtml, wire: () => FIRST_COMMUNION_FIELDS.filter(f => f.type === 'date').forEach(f => guardDateInputRange(document.getElementById(f.id))), check: validateAndCollectFirstCommunion },
};

/** Certificate types this file can build ('baptismal', 'confirmation', 'first-communion'). */
export const hasCertStepForm = (typeId) => !!FORMS[typeId];

/** Red outline until the box is edited. */
function flagRed(el) {
  if (!el) return;
  el.classList.add('border-red-400');
  el.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
  el.addEventListener('change', () => el.classList.remove('border-red-400'), { once: true });
}

/**
 * Builds a step-by-step request form for `typeId` inside `container`.
 * @param {HTMLElement} container
 * @param {string} typeId  'baptismal' | 'confirmation' | 'first-communion'
 * @param {object} [opts]
 * @param {(step: number, isLast: boolean) => void} [opts.onStepChange]  e.g. show the host's own Submit on the last step
 * @param {(msg: string, isError?: boolean) => void} [opts.toast]
 * @param {string} [opts.confirmHint]  text under "Confirm details"
 * @param {boolean} [opts.lastStepBack]  a Back button on the last step (if the host has none of its own)
 * @param {Element} [opts.scrollTarget]  scrolled into view on each step change
 * @returns {{ go(step:number):void, readonly step:number, labels:string[], slot:HTMLElement,
 *             collect(flag?):{allFilled:boolean, details:object}, firstUnfinished():number|undefined }}
 */
export function createCertStepForm(container, typeId, {
  onStepChange = () => {},
  toast = (...a) => window.showToast?.(...a),
  confirmHint = 'Almost done — check the details, then submit.',
  lastStepBack = false,
  scrollTarget = null,
} = {}) {
  const form = FORMS[typeId];
  const steps = CERT_STEPS[typeId];
  if (!form || !steps) throw new Error(`No step form for "${typeId}"`);

  // 1. Render + wire the fields exactly as the single-page form did
  container.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 cert-step-staging">${form.render()}</div>`;
  const staging = container.querySelector('.cert-step-staging');
  form.wire();

  // 2. Build the steps and move each block into its step
  const all = [...steps, { label: 'Confirm', title: 'Confirm details', hint: confirmHint, ids: [] }];
  const nav = (i) => `
    <div class="mstep-nav">
      ${i > 0 ? '<button type="button" class="btn-secondary mstep-back">← Back</button>' : '<span></span>'}
      <button type="button" class="btn-lavender mstep-next">Next: ${all[i + 1].label} →</button>
    </div>`;
  staging.insertAdjacentHTML('beforebegin', `
    <div class="mwiz sm:col-span-2 cert-steps">
      <ol class="mstep-bar" aria-label="Steps" style="grid-template-columns: repeat(${all.length}, minmax(0, 1fr));">
        ${all.map((s, i) => `<li><button type="button" class="mstep-dot" data-step="${i}" aria-label="Step ${i + 1}: ${s.label}"><span class="mstep-num">${i + 1}</span><span class="mstep-label">${s.label}</span></button></li>`).join('')}
      </ol>
      ${all.map((s, i) => `
      <section class="mstep-panel${i ? ' hidden' : ''}" data-step="${i}" aria-label="${s.label}">
        <p class="mstep-count">Step ${i + 1} of ${all.length}</p>
        <h3 class="mstep-title">${s.title}</h3>
        <p class="mstep-hint">${s.hint}</p>
        ${i < steps.length
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mstep-section mstep-fields"></div>${nav(i)}`
          : `<div class="mstep-slot"></div>${lastStepBack ? '<div class="mstep-nav"><button type="button" class="btn-secondary mstep-back">← Back</button><span></span></div>' : ''}`}
      </section>`).join('')}
    </div>`);
  const wiz = container.querySelector('.cert-steps');
  const panels = [...wiz.querySelectorAll('.mstep-panel')];
  const dots = [...wiz.querySelectorAll('.mstep-dot')];
  const owner = (el) => steps.findIndex(s => s.ids.some(id => el.id === id || el.querySelector(`#${CSS.escape(id)}`)));
  let lastOwner = 0;
  [...staging.children].forEach(el => {
    const i = owner(el);
    if (i >= 0) lastOwner = i;
    panels[i >= 0 ? i : lastOwner].querySelector('.mstep-fields').appendChild(el); // unlisted blocks stay with the step before
  });
  staging.remove();

  // 3. Checking: which steps miss something — without marking later steps red
  const missingSteps = () => {
    const missing = new Set();
    form.check((el) => { const p = el?.closest('.mstep-panel'); if (p) missing.add(Number(p.dataset.step)); });
    return missing;
  };
  const flagIn = (step) => form.check((el) => { if (el && panels[step].contains(el)) flagRed(el); });

  let current = 0;
  let furthest = 0;
  const backNav = stepHistory(`cert-${typeId}`, (s) => go(s), () => wiz.isConnected);
  function go(step) {
    current = Math.max(0, Math.min(step, all.length - 1));
    furthest = Math.max(furthest, current);
    panels.forEach((p, i) => p.classList.toggle('hidden', i !== current));
    dots.forEach((d, i) => {
      d.classList.toggle('is-current', i === current);
      d.classList.toggle('is-done', i < furthest && i !== current);
      d.disabled = i > furthest;
      d.setAttribute('aria-current', i === current ? 'step' : 'false');
    });
    onStepChange(current, current === all.length - 1);
    (scrollTarget || wiz).scrollIntoView({ behavior: 'smooth', block: 'start' });
    backNav.moved(current);
  }
  function tryForward(target) {
    if (missingSteps().has(current)) {
      flagIn(current);
      toast('Please fill in the highlighted fields to continue.', true);
      panels[current].querySelector('.border-red-400')?.focus();
      return;
    }
    go(target);
  }
  wiz.addEventListener('click', (e) => {
    if (e.target.closest('.mstep-next')) { tryForward(current + 1); return; }
    if (e.target.closest('.mstep-back')) { go(current - 1); return; }
    const dot = e.target.closest('.mstep-dot');
    if (dot && !dot.disabled) {
      const target = Number(dot.dataset.step);
      if (target > current) tryForward(target); else go(target);
    }
  });

  go(0);
  return {
    go,
    get step() { return current; },
    labels: all.map(s => s.label),
    slot: wiz.querySelector('.mstep-slot'),
    /** Checks everything and gathers the `details` to save. */
    collect: (flag = flagRed) => form.check(flag),
    /** First step still missing something (its fields get marked), or undefined. */
    firstUnfinished() {
      const missing = [...missingSteps()].sort((a, b) => a - b)[0];
      if (missing !== undefined) flagIn(missing);
      return missing;
    },
  };
}
