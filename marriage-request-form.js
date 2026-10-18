/* ============================================
   SacraDigit — Marriage Certificate request form
   (step by step: 1 Groom → 2 Bride → 3 Sponsors → 4 Confirm)

   Shared by the parishioner's Request a Certificate page
   (user/user-request-certificate.js) and the admin's
   walk-in / phone request on Record Requests
   (Sacradigit/record-requests.js), so both ask the same
   things in the same order and store the same `details`.

   One thing at a time so it reads well on a phone. Each
   side (groom, bride) has its own optional guardian section
   and Not Applicable toggles on Father's/Mother's names;
   two sponsors/witnesses are required (Canon 1108 §1).
   The `details` keys (groom-name, groom-father, …,
   witness-1, witness-2, marriage-date, marriage-place) are
   what Record Requests' Generate Certificate and the printed
   certificate read — don't rename them.

   Styles: marriage-request-form.css (both pages link it).
   ============================================ */

import { nameFieldsHtml, readNameFields, setNameFields, nameFieldsFilled } from './name-utils.js';

/** "Add Guardian" relationship options — "Other" reveals a text box. */
export const GUARDIAN_RELATIONSHIPS = [
  'Mother', 'Father', 'Grandfather', 'Grandmother', 'Aunt', 'Uncle',
  'Cousin', 'Older Brother', 'Older Sister', 'Godmother', 'Godfather', 'Other',
];

// Date fields: nothing in the future, and a 4-digit-year floor keeps the
// native picker's year spinner from producing dates like "20000-11-11".
export const TODAY_ISO = new Date().toISOString().slice(0, 10);
export const MIN_DATE_ISO = '1900-01-01';

/** True for a real YYYY-MM-DD date between 1900 and this year (empty counts as fine). */
export function isReasonableDate(iso) {
  if (!iso) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const year = Number(iso.slice(0, 4));
  return year >= 1900 && year <= new Date().getFullYear();
}

/** Clears a date box once it holds a settled, impossible value (judged on blur, never mid-typing). */
export function guardDateInputRange(el, toast) {
  // Also used as `.forEach(guardDateInputRange)`, which passes the index — so only a function counts.
  const say = typeof toast === 'function' ? toast : (...args) => window.showToast?.(...args);
  el?.addEventListener('blur', () => {
    if (el.value && !isReasonableDate(el.value)) {
      el.value = '';
      say('Please enter a valid, real date (year between 1900 and this year).', true);
    }
  });
}

export const MARRIAGE_STEPS = [
  { key: 'groom', label: 'Groom' },
  { key: 'bride', label: 'Bride' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'confirm', label: 'Confirm' },
];

/* ---------- markup ---------- */

/** First / Middle / Last / Ext. — 4 across on wide screens, one per line on phones. */
function nameInputs(prefix) {
  return `
    <div class="name-field-row">
      <input type="text" id="${prefix}-first" class="form-input" placeholder="First Name" />
      <input type="text" id="${prefix}-middle" class="form-input" placeholder="Middle Name" />
      <input type="text" id="${prefix}-last" class="form-input" placeholder="Last Name" />
      <input type="text" id="${prefix}-ext" class="form-input name-ext-input" placeholder="Ext. (Jr., III)" />
    </div>`;
}

/* A checkbox that reveals relationship (with "Other" free text), guardian
   name and birthday. Guardian info is request-only context (Generate
   Certificate doesn't print it), same as the other certificate types. */
function guardianHtml(side, sideLabel) {
  return `
    <label class="field-na-label" style="font-size:0.8125rem;">
      <input type="checkbox" id="${side}-guardian-toggle" class="checkbox-input" />
      Add Guardian
    </label>
    <div class="marriage-cell-guardian hidden" id="${side}-guardian-fields">
      <div class="mt-2">
        <label class="form-label" for="${side}-guardian-relationship">Relationship to the ${sideLabel} <span class="text-red-500">*</span></label>
        <select id="${side}-guardian-relationship" class="form-input">
          <option value="">Select relationship…</option>
          ${GUARDIAN_RELATIONSHIPS.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div class="mt-2 hidden" id="${side}-guardian-relationship-other-wrap">
        <label class="form-label" for="${side}-guardian-relationship-other">Specify Relationship <span class="text-red-500">*</span></label>
        <input type="text" id="${side}-guardian-relationship-other" class="form-input" placeholder="e.g. Family friend" />
      </div>
      <div class="mt-2">
        <label class="form-label">Guardian's Full Name <span class="text-red-500">*</span></label>
        ${nameInputs(`${side}-guardian-name`)}
      </div>
      <div class="mt-2">
        <label class="form-label" for="${side}-guardian-birthdate">Guardian's Birthday <span class="text-red-500">*</span></label>
        <input type="date" id="${side}-guardian-birthdate" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
      </div>
    </div>`;
}

function parentHtml(side, who) {
  const prefix = `${side}-${who}`;
  return `
    <div class="field-na-row">
      <label class="field-na-label"><input type="checkbox" id="${prefix}-na" class="checkbox-input" /> Not Applicable / Prefer not to say</label>
    </div>
    ${nameInputs(prefix)}`;
}

function personStepHtml(side, sideLabel) {
  return `
    <div class="mstep-section">
      <p class="form-label">${sideLabel}'s Full Name <span class="text-red-500">*</span></p>
      ${nameInputs(`${side}-name`)}
    </div>
    <div class="mstep-section">
      <p class="mstep-section-title">Guardian <span class="mstep-optional">(only if a guardian signs instead of the parents)</span></p>
      ${guardianHtml(side, sideLabel)}
    </div>
    <div class="mstep-section">
      <p class="form-label">${sideLabel}'s Father's Name <span class="text-red-500">*</span></p>
      ${parentHtml(side, 'father')}
    </div>
    <div class="mstep-section">
      <p class="form-label">${sideLabel}'s Mother's Maiden Name <span class="text-red-500">*</span></p>
      ${parentHtml(side, 'mother')}
    </div>
    <p class="marriage-table-note">* Required unless you tick Not Applicable, or add a guardian for the ${sideLabel.toLowerCase()}.</p>`;
}

function formHtml({ confirmHint, lastStepBack }) {
  const stepNav = (i) => `
    <div class="mstep-nav">
      ${i > 0 ? '<button type="button" class="btn-secondary mstep-back">← Back</button>' : '<span></span>'}
      <button type="button" class="btn-lavender mstep-next">Next: ${MARRIAGE_STEPS[i + 1].label} →</button>
    </div>`;
  return `
    <div class="mwiz">
      <ol class="mstep-bar" aria-label="Steps">
        ${MARRIAGE_STEPS.map((s, i) => `
        <li><button type="button" class="mstep-dot" data-step="${i}">
          <span class="mstep-num">${i + 1}</span><span class="mstep-label">${s.label}</span>
        </button></li>`).join('')}
      </ol>

      <section class="mstep-panel" data-step="0" aria-label="Groom">
        <h3 class="mstep-title">Groom's details</h3>
        ${personStepHtml('groom', 'Groom')}
        ${stepNav(0)}
      </section>

      <section class="mstep-panel hidden" data-step="1" aria-label="Bride">
        <h3 class="mstep-title">Bride's details</h3>
        ${personStepHtml('bride', 'Bride')}
        ${stepNav(1)}
      </section>

      <section class="mstep-panel hidden" data-step="2" aria-label="Sponsors">
        <h3 class="mstep-title">Sponsors &amp; wedding</h3>
        <p class="mstep-hint">The two principal sponsors (ninong and ninang) who witnessed the wedding.</p>
        <div class="mstep-section">${nameFieldsHtml('witness-1', 'Sponsor / Witness 1', { required: true, spanFull: false })}</div>
        <div class="mstep-section">${nameFieldsHtml('witness-2', 'Sponsor / Witness 2', { required: true, spanFull: false })}</div>
        <div class="mstep-section mstep-two-col">
          <div>
            <label class="form-label" for="marriage-date">Date of Marriage</label>
            <input type="date" id="marriage-date" class="form-input" min="${MIN_DATE_ISO}" max="${TODAY_ISO}" />
          </div>
          <div>
            <label class="form-label" for="marriage-place">Place of Marriage</label>
            <input type="text" id="marriage-place" class="form-input" placeholder="e.g. Our Lady of Fatima Parish" />
          </div>
        </div>
        ${stepNav(2)}
      </section>

      <section class="mstep-panel hidden" data-step="3" aria-label="Confirm">
        <h3 class="mstep-title">Confirm details</h3>
        <p class="mstep-hint">${confirmHint}</p>
        <div class="mstep-slot"></div>
        ${lastStepBack ? '<div class="mstep-nav"><button type="button" class="btn-secondary mstep-back">← Back</button><span></span></div>' : ''}
      </section>
    </div>`;
}

/* ---------- wiring ---------- */

/* Guardian toggle, relationship "Other", and the parents' N/A boxes for one side. */
function wirePerson(root, side) {
  const $ = (id) => root.querySelector(`#${id}`);
  const guardianToggle = $(`${side}-guardian-toggle`);
  const guardianFields = $(`${side}-guardian-fields`);

  function updateParentFieldsState() {
    const guardianOn = guardianToggle.checked;
    ['father', 'mother'].forEach(who => {
      const prefix = `${side}-${who}`;
      const na = $(`${prefix}-na`);
      const disabled = guardianOn || na.checked;
      ['first', 'middle', 'last', 'ext'].forEach(part => { $(`${prefix}-${part}`).disabled = disabled; });
      na.disabled = guardianOn;
    });
  }

  guardianToggle.addEventListener('change', () => {
    guardianFields.classList.toggle('hidden', !guardianToggle.checked);
    if (!guardianToggle.checked) {
      $(`${side}-guardian-relationship`).value = '';
      $(`${side}-guardian-relationship-other-wrap`).classList.add('hidden');
      $(`${side}-guardian-relationship-other`).value = '';
      setNameFields(`${side}-guardian-name`, null);
      $(`${side}-guardian-birthdate`).value = '';
    }
    updateParentFieldsState();
  });

  const relationshipEl = $(`${side}-guardian-relationship`);
  relationshipEl.addEventListener('change', () => {
    $(`${side}-guardian-relationship-other-wrap`).classList.toggle('hidden', relationshipEl.value !== 'Other');
    if (relationshipEl.value !== 'Other') $(`${side}-guardian-relationship-other`).value = '';
  });

  ['father', 'mother'].forEach(who => {
    const prefix = `${side}-${who}`;
    const na = $(`${prefix}-na`);
    na.addEventListener('change', () => {
      if (na.checked) ['first', 'middle', 'last', 'ext'].forEach(part => { $(`${prefix}-${part}`).value = ''; });
      updateParentFieldsState();
    });
  });
  updateParentFieldsState();
}

/* ---------- checking + collecting ---------- */

function checkPerson(side, flag, details) {
  let ok = true;
  const el = (id) => document.getElementById(id);

  details[`${side}-name`] = readNameFields(`${side}-name`);
  if (!nameFieldsFilled(`${side}-name`)) { ok = false; flag(el(`${side}-name-first`)); flag(el(`${side}-name-last`)); }

  const guardianOn = el(`${side}-guardian-toggle`).checked;
  if (guardianOn) {
    const relEl = el(`${side}-guardian-relationship`);
    const relOtherEl = el(`${side}-guardian-relationship-other`);
    const bdayEl = el(`${side}-guardian-birthdate`);
    let relationship = relEl.value;
    if (!relationship) { ok = false; flag(relEl); }
    if (relationship === 'Other') {
      if (!relOtherEl.value.trim()) { ok = false; flag(relOtherEl); }
      relationship = relOtherEl.value.trim() || 'Other';
    }
    const guardianName = readNameFields(`${side}-guardian-name`);
    if (!nameFieldsFilled(`${side}-guardian-name`)) { ok = false; flag(el(`${side}-guardian-name-first`)); flag(el(`${side}-guardian-name-last`)); }
    // The form doesn't ask for the groom's/bride's own birthday, so only sanity-check the guardian's.
    if (!bdayEl.value || !isReasonableDate(bdayEl.value)) { ok = false; flag(bdayEl); }
    details[`${side}-guardian`] = { relationship, name: guardianName, birthdate: bdayEl.value };
  } else {
    details[`${side}-guardian`] = null;
  }

  ['father', 'mother'].forEach(who => {
    const prefix = `${side}-${who}`;
    if (guardianOn || el(`${prefix}-na`).checked) { details[prefix] = null; return; }
    details[prefix] = readNameFields(prefix);
    if (!nameFieldsFilled(prefix)) { ok = false; flag(el(`${prefix}-first`)); flag(el(`${prefix}-last`)); }
  });

  return ok;
}

function checkSponsors(flag, details) {
  let ok = true;
  const dateEl = document.getElementById('marriage-date');
  details['marriage-date'] = dateEl.value;
  if (dateEl.value && !isReasonableDate(dateEl.value)) { ok = false; flag(dateEl); }
  details['marriage-place'] = document.getElementById('marriage-place').value.trim();

  ['witness-1', 'witness-2'].forEach(w => {
    details[w] = readNameFields(w);
    if (!nameFieldsFilled(w)) { ok = false; flag(document.getElementById(`${w}-first`)); flag(document.getElementById(`${w}-last`)); }
  });
  return ok;
}

/** Red outline until the box is edited. */
export function flagInvalid(el) {
  if (!el) return;
  el.classList.add('border-red-400');
  el.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
}

/**
 * Builds the step-by-step Marriage form inside `container`.
 * @param {HTMLElement} container
 * @param {object} [opts]
 * @param {(step: number, isLast: boolean) => void} [opts.onStepChange]  e.g. show the host's own Submit on the last step
 * @param {(msg: string, isError?: boolean) => void} [opts.toast]
 * @param {string} [opts.confirmHint]  text under "Confirm details"
 * @param {boolean} [opts.lastStepBack]  put a Back button on the Confirm step (if the host has none of its own)
 * @param {Element} [opts.scrollTarget]  scrolled into view on each step change
 * @returns {{ go(step:number):void, readonly step:number, slot:HTMLElement, collect(flag?):{allFilled:boolean, details:object}, firstUnfinished(flag?):number|undefined }}
 */
export function createMarriageForm(container, {
  onStepChange = () => {},
  toast = window.showToast,
  confirmHint = 'Almost done — check the details below, then submit.',
  lastStepBack = false,
  scrollTarget = null,
} = {}) {
  container.innerHTML = formHtml({ confirmHint, lastStepBack });
  const wiz = container.querySelector('.mwiz');
  const panels = [...wiz.querySelectorAll('.mstep-panel')];
  const dots = [...wiz.querySelectorAll('.mstep-dot')];

  ['marriage-date', 'groom-guardian-birthdate', 'bride-guardian-birthdate']
    .forEach(id => guardDateInputRange(wiz.querySelector(`#${id}`), toast));
  wirePerson(wiz, 'groom');
  wirePerson(wiz, 'bride');

  const checkStep = (step, flag = flagInvalid) => {
    const scratch = {};
    if (step === 0) return checkPerson('groom', flag, scratch);
    if (step === 1) return checkPerson('bride', flag, scratch);
    if (step === 2) return checkSponsors(flag, scratch);
    return true;
  };

  let current = 0;
  let furthest = 0; // furthest step reached — the bar can jump back to any of these

  function go(step) {
    current = Math.max(0, Math.min(step, MARRIAGE_STEPS.length - 1));
    furthest = Math.max(furthest, current);
    panels.forEach((p, i) => p.classList.toggle('hidden', i !== current));
    dots.forEach((d, i) => {
      d.classList.toggle('is-current', i === current);
      d.classList.toggle('is-done', i < furthest && i !== current);
      d.disabled = i > furthest;
      d.setAttribute('aria-current', i === current ? 'step' : 'false');
    });
    onStepChange(current, current === MARRIAGE_STEPS.length - 1);
    (scrollTarget || wiz).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function tryForward(target) {
    if (!checkStep(current)) {
      toast?.('Please fill in the highlighted fields to continue.', true);
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
    slot: wiz.querySelector('.mstep-slot'),
    /** Checks every step and gathers the `details` to save. */
    collect(flag = flagInvalid) {
      const details = {};
      const a = checkPerson('groom', flag, details);
      const b = checkPerson('bride', flag, details);
      const c = checkSponsors(flag, details);
      return { allFilled: a && b && c, details };
    },
    /** Index of the first step that's still missing something, or undefined. */
    firstUnfinished(flag = flagInvalid) {
      return [0, 1, 2].find(step => !checkStep(step, flag));
    },
  };
}
