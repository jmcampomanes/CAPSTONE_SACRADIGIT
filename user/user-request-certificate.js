/* ============================================
   SacraDigit — User Request Certificate Scripts (AWS Amplify)
   Runs after user-shell.js.
   requesterName is hardcoded to match the demo
   user in user-shell.js until real parishioner
   login exists.
   ============================================ */

import { client } from '../amplify-init.js';
import { currentUserName } from '../auth.js';
import { nameFieldsHtml, readNameFields, nameFieldsFilled, formatFullName, isNameEmpty } from '../name-utils.js';
import { createMarriageForm, MARRIAGE_STEPS, TODAY_ISO, MIN_DATE_ISO, isReasonableDate, guardDateInputRange } from '../marriage-request-form.js';
import { createCertStepForm, hasCertStepForm } from '../certificate-step-forms.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = currentUserName(); // the signed-in parishioner (auth.js)

  // GUARDIAN_RELATIONSHIPS, TODAY_ISO / MIN_DATE_ISO, isReasonableDate()
  // and guardDateInputRange() — the "Add Guardian" options and the date
  // checks every date field here uses — come from ../marriage-request-form.js.

  const certTypes = [
    { id: 'baptismal', name: 'Baptismal Certificate', desc: 'Proof of baptism recorded at the parish.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>`,
      // These mirror exactly what appears on the printed Certificate of
      // Baptism (see baptismal-certificate-print.html) — Bk./Page/Line,
      // the officiating priest, and the issue date are filled in by the
      // parish office from the register, not asked of the requester here.
      // Rendering, validation, and data collection for this type are all
      // custom (see ../certificate-step-forms.js, shared with the admin walk-in
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
      // Rendering, validation, and data collection for this type are
      // custom (see ../certificate-step-forms.js, shared with the admin walk-in
      // below) — it needs a guardian sub-section (mirroring the
      // Baptismal Certificate's), independent N/A toggles on Father's/
      // Mother's names, and a Confirmation Name dropdown that the
      // generic field-array renderer used by First Communion/Marriage
      // can't express. "Church of Baptism" isn't asked of the
      // requester — this parish only has records for itself, so it's
      // always filled in as Our Lady of Fatima Parish automatically
      // (see ../certificate-step-forms.js). This `fields` array only
      // documents the field ids/labels that end up as keys in the
      // stored `details` JSON.
      confirmationCustom: true,
      fields: [
        { id: 'confirmed-name', label: 'Full Name of Confirmand', kind: 'name', required: true },
        { id: 'baptism-date', label: 'Date of Baptism', type: 'date', required: false },
        { id: 'confirmation-name', label: 'Confirmation Name (Saint Name)', required: true },
        { id: 'confirmation-date', label: 'Approximate Date of Confirmation', type: 'date', required: false },
        { id: 'father-name', label: "Father's Full Name", kind: 'name', required: true },
        { id: 'mother-name', label: "Mother's Full Maiden Name", kind: 'name', required: true },
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
      //
      // Rendering, validation, and data collection for this type are
      // custom: a step-by-step form shared with the admin's walk-in request
      // (../marriage-request-form.js) — Groom, then Bride, then Sponsors,
      // then Confirm — and each side gets its own independent
      // "Add Guardian" toggle (mirroring the Baptismal/Confirmation
      // Certificates') plus independent N/A toggles on that side's
      // Father's/Mother's names — the generic field-array renderer used
      // by First Communion can't express any of that. Two
      // witnesses (not one) are required per Canon 1108 §1, which
      // requires the presence of two witnesses for a valid Catholic
      // marriage. This `fields` array only documents the field ids/
      // labels that end up as keys in the stored `details` JSON.
      marriageCustom: true,
      fields: [
        { id: 'groom-name', label: "Groom's Full Name", kind: 'name', required: true },
        { id: 'groom-father', label: "Groom's Father's Name", kind: 'name', required: true },
        { id: 'groom-mother', label: "Groom's Mother's Maiden Name", kind: 'name', required: true },
        { id: 'bride-name', label: "Bride's Full Name", kind: 'name', required: true },
        { id: 'bride-father', label: "Bride's Father's Name", kind: 'name', required: true },
        { id: 'bride-mother', label: "Bride's Mother's Maiden Name", kind: 'name', required: true },
        { id: 'marriage-date', label: 'Date of Marriage', type: 'date', required: false },
        { id: 'marriage-place', label: 'Place of Marriage', placeholder: 'e.g. Our Lady of Fatima Parish', required: false },
        { id: 'witness-1', label: 'Witness 1', kind: 'name', required: true },
        { id: 'witness-2', label: 'Witness 2', kind: 'name', required: true },
      ] },
  ];

  let selectedType = null;

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
    // Matches 'guardian' (Baptismal/Confirmation) as well as
    // 'groom-guardian'/'bride-guardian' (Marriage, one per side).
    if (key.endsWith('guardian') && value && typeof value === 'object') {
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
  // for the admin's Generate Certificate prefill; see ../certificate-step-forms.js).
  // `section` groups the review table under small headings so a long
  // request isn't one crowded list (see buildPreviewGridHtml).
  const BAPTISMAL_PREVIEW_FIELDS = [
    { section: 'Baptized Person', key: 'baptized-name', label: 'Full Name' },
    { section: 'Baptized Person', key: 'birth-date', label: 'Date of Birth', isDate: true },
    { section: 'Baptized Person', key: 'birth-region', label: 'Region of Birth' },
    { section: 'Baptized Person', key: 'birth-city', label: 'City / Municipality' },
    { section: 'Baptized Person', key: 'baptism-date', label: 'Date of Baptism', isDate: true },
    { section: 'Family', key: 'guardian', label: 'Guardian' },
    { section: 'Family', key: 'father-name', label: "Father's Name" },
    { section: 'Family', key: 'mother-name', label: "Mother's Name" },
    { section: 'Godparents', key: 'sponsor-1', label: 'Sponsor 1' },
    { section: 'Godparents', key: 'sponsor-2', label: 'Sponsor 2' },
    { section: 'Godparents', key: 'extraGodparents', label: 'Additional Godparents' },
  ];

  // Same idea for the Confirmation Certificate — 'baptism-church' is
  // skipped since it's never actually asked of the requester (always
  // Our Lady of Fatima Parish; see ../certificate-step-forms.js).
  const CONFIRMATION_PREVIEW_FIELDS = [
    { section: 'Confirmand', key: 'confirmed-name', label: 'Full Name' },
    { section: 'Confirmand', key: 'baptism-date', label: 'Date of Baptism', isDate: true },
    { section: 'Confirmand', key: 'confirmation-name', label: 'Confirmation Name' },
    { section: 'Confirmand', key: 'confirmation-date', label: 'Date of Confirmation (approx.)', isDate: true },
    { section: 'Family', key: 'guardian', label: 'Guardian' },
    { section: 'Family', key: 'father-name', label: "Father's Name" },
    { section: 'Family', key: 'mother-name', label: "Mother's Name" },
    { section: 'Sponsor', key: 'sponsor-name', label: "Sponsor's Name" },
  ];

  // Same order as the step-by-step form: Groom, Bride, then Sponsors.
  const MARRIAGE_PREVIEW_FIELDS = [
    { section: 'Groom', key: 'groom-name', label: 'Full Name' },
    { section: 'Groom', key: 'groom-guardian', label: 'Guardian' },
    { section: 'Groom', key: 'groom-father', label: "Father's Name" },
    { section: 'Groom', key: 'groom-mother', label: "Mother's Maiden Name" },
    { section: 'Bride', key: 'bride-name', label: 'Full Name' },
    { section: 'Bride', key: 'bride-guardian', label: 'Guardian' },
    { section: 'Bride', key: 'bride-father', label: "Father's Name" },
    { section: 'Bride', key: 'bride-mother', label: "Mother's Maiden Name" },
    { section: 'Sponsors & Wedding', key: 'witness-1', label: 'Sponsor / Witness 1' },
    { section: 'Sponsors & Wedding', key: 'witness-2', label: 'Sponsor / Witness 2' },
    { section: 'Sponsors & Wedding', key: 'marriage-date', label: 'Date of Marriage', isDate: true },
    { section: 'Sponsors & Wedding', key: 'marriage-place', label: 'Place of Marriage' },
  ];

  const FIRST_COMMUNION_PREVIEW_FIELDS = [
    { section: 'Communicant', key: 'fc-name', label: 'Full Name' },
    { section: 'Communicant', key: 'fc-communion-date', label: 'Date of First Communion (approx.)', isDate: true },
  ];

  /* The review table: one titled group per part of the form (e.g. Groom,
     Bride, Sponsors & Wedding, then Request), label | value per row. */
  function buildPreviewGridHtml(details, purpose, notes) {
    const fallbackSection = selectedType.name.replace(/ Certificate$/, '') === 'First Communion' ? 'Communicant' : 'Details';
    const fieldList = selectedType.baptismalCustom
      ? BAPTISMAL_PREVIEW_FIELDS
      : selectedType.confirmationCustom
        ? CONFIRMATION_PREVIEW_FIELDS
        : selectedType.marriageCustom
          ? MARRIAGE_PREVIEW_FIELDS
          : selectedType.id === 'first-communion'
            ? FIRST_COMMUNION_PREVIEW_FIELDS
            : selectedType.fields.map(f => ({ section: fallbackSection, key: f.id, label: f.label, isDate: f.type === 'date' }));

    const sections = new Map(); // section title → [[label, value], …] in form order
    fieldList.forEach(({ section, key, label, isDate }) => {
      const raw = details[key];
      const value = isDate ? (raw ? formatShortDate(raw) : null) : formatPreviewValue(key, raw);
      if (!value) return;
      if (!sections.has(section)) sections.set(section, []);
      sections.get(section).push([label, value]);
    });
    sections.set('Request', [['Purpose', purpose], ...(notes ? [['Notes', notes]] : [])]);

    return [...sections].map(([title, rows]) => `
      <tbody>
        <tr class="confirm-section"><th colspan="2" scope="colgroup">${escapeHtml(title)}</th></tr>
        ${rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
      </tbody>`).join('');
  }

  /* --- Review Your Request: its own page in place of the form ---
     (confirmModal is the review section; the name is kept from when it
     was a pop-up.) Opening adds a browser-history step, so the phone's
     Back button returns to the form instead of leaving the page. */
  const backToMenuBtn = document.getElementById('btn-back-to-menu');
  const reviewOpen = () => !confirmModal.classList.contains('hidden');

  function swapView(showReview) {
    confirmModal.classList.toggle('hidden', !showReview);
    requestFormWrap.classList.toggle('hidden', showReview);
    backToMenuBtn?.classList.toggle('hidden', showReview);
    (showReview ? confirmModal : requestFormWrap).classList.remove('view-enter');
    void confirmModal.offsetWidth; // restart the slide-in
    (showReview ? confirmModal : requestFormWrap).classList.add('view-enter');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openConfirmModal() {
    confirmDetailsGrid.innerHTML = buildPreviewGridHtml(pendingSubmission.details, pendingSubmission.purpose, pendingSubmission.notes);
    document.getElementById('review-type-label').textContent = selectedType.name;
    swapView(true);
    document.getElementById('review-title').focus({ preventScroll: true });
    history.pushState({ certReview: true }, '');
  }

  /* Back to the form, exactly as it was left. `viaHistory` = the browser's
     Back button already removed the history step. */
  function closeConfirmModal({ viaHistory = false } = {}) {
    if (!reviewOpen()) return;
    swapView(false);
    if (!viaHistory && history.state?.certReview) history.back();
  }

  window.addEventListener('popstate', () => { if (reviewOpen()) closeConfirmModal({ viaHistory: true }); });
  document.getElementById('btn-back-to-edit').addEventListener('click', () => closeConfirmModal());

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
    marriageWizard = null;
    stepForm = null;
    setCommonSectionVisible(true); // the step-by-step forms hide it again until their last step

    if (selectedType.marriageCustom) {
      openMarriageForm();
    } else if (hasCertStepForm(selectedType.id)) {
      // Baptismal / Confirmation / First Communion: step by step (../certificate-step-forms.js)
      openStepsFor(selectedType.id);
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
    marriageWizard = null;
    stepForm = null;
    setCommonSectionVisible(true);
    confirmModal.classList.add('hidden');
    backToMenuBtn?.classList.remove('hidden');
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

  /* Baptismal / Confirmation / First Communion fields, their wiring and
     checks now live in ../certificate-step-forms.js (shared with the
     admin walk-in). */

  /* ------------------------------------------
     MARRIAGE CERTIFICATE — step-by-step form
     1 Groom → 2 Bride → 3 Sponsors → 4 Confirm, shared
     with the admin's walk-in request (see
     ../marriage-request-form.js). The page's own bottom
     section (parish check, purpose, notes, Submit) shows
     only on the last step, "Confirm".
  ------------------------------------------ */
  let marriageWizard = null; // the open Marriage form (createMarriageForm), else null

  /* Every other certificate shows the bottom section under its fields. */
  function setCommonSectionVisible(show, { marriageLastStep = false } = {}) {
    ['common-fields', 'req-processing-note', 'submit-row'].forEach(id => {
      document.getElementById(id)?.classList.toggle('hidden', !show);
    });
    document.getElementById('btn-marriage-back')?.classList.toggle('hidden', !marriageLastStep);
  }

  function openMarriageForm() {
    dynamicFields.innerHTML = '<div id="marriage-form" class="sm:col-span-2"></div>';
    marriageWizard = createMarriageForm(document.getElementById('marriage-form'), {
      confirmHint: 'Almost done — tell us why you need the certificate, then review everything before it\'s sent.',
      scrollTarget: dynamicFields.closest('.req-form-panel'),
      onStepChange: (step, isLast) => setCommonSectionVisible(isLast, { marriageLastStep: isLast }),
    });
  }

  document.getElementById('btn-marriage-back').addEventListener('click', () => (marriageWizard || stepForm)?.go((marriageWizard || stepForm).step - 1));

  /* ------------------------------------------
     STEP-BY-STEP FOR THE OTHER CERTIFICATES
     Baptismal, Confirmation and First Communion use the
     same steps as Marriage — built by ../certificate-step-forms.js,
     shared with the admin's walk-in request. The page's own
     bottom section (purpose, notes, Submit) shows on the last step.
  ------------------------------------------ */
  let stepForm = null; // the open step-by-step form (non-Marriage), else null

  function openStepsFor(typeId) {
    stepForm = createCertStepForm(dynamicFields, typeId, {
      confirmHint: 'Almost done — tell us why you need the certificate, then review everything before it\'s sent.',
      scrollTarget: dynamicFields.closest('.req-form-panel'),
      onStepChange: (step, isLast) => setCommonSectionVisible(isLast, { marriageLastStep: isLast }),
    });
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

    // Step-by-step forms: something missing on an earlier step → take them back to it.
    if (stepForm) {
      const unfinished = stepForm.firstUnfinished();
      if (unfinished !== undefined) {
        stepForm.go(unfinished);
        window.showToast(`Please finish the ${stepForm.labels[unfinished]} step first.`, true);
        return;
      }
    }

    if (stepForm) {
      // Baptismal / Confirmation / First Communion (../certificate-step-forms.js)
      const result = stepForm.collect(flagInvalid);
      allFilled = result.allFilled;
      details = result.details;
    } else if (selectedType.marriageCustom) {
      const result = marriageWizard.collect(flagInvalid);
      // Something on an earlier step is missing: take them back to it.
      const unfinished = marriageWizard.firstUnfinished(flagInvalid);
      if (unfinished !== undefined) {
        marriageWizard.go(unfinished);
        window.showToast(`Please finish the ${MARRIAGE_STEPS[unfinished].label} step first.`, true);
        return;
      }
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