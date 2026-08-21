/* ============================================
   SacraDigit — User Request a Service Scripts (AWS Amplify)
   Runs after user-shell.js.
   Browsing + submitting only — the tracking log now
   lives on user-requested-services.html/.js. Backed
   by the Blessing model. Status mapping: pending ->
   Pending, scheduled -> Approved, completed ->
   Completed, declined -> Rejected.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = 'Maria P. Santos';

  const serviceTypes = [
    { id: 'baptism', name: 'Baptism', desc: 'Sacrament of initiation for infants, children, or adults.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>`,
      fields: [
        { id: 'child-name', label: "Child's Full Name", placeholder: 'e.g. Sofia Santos', required: true, span2: true },
        { id: 'father-name', label: "Father's Name", placeholder: 'e.g. Ricardo Santos', required: false },
        { id: 'mother-name', label: "Mother's Maiden Name", placeholder: 'e.g. Elena Reyes', required: false },
      ] },
    { id: 'wedding', name: 'Wedding', desc: 'Sacrament of matrimony for the Catholic rite.',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
      fields: [
        { id: 'groom-name', label: "Groom's Full Name", placeholder: 'e.g. Juan Dela Cruz', required: true },
        { id: 'bride-name', label: "Bride's Full Name", placeholder: 'e.g. Ana Reyes', required: true },
      ] },
    { id: 'funeral', name: 'Funeral Mass', desc: 'Mass and rites for a deceased loved one.',
      iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
      fields: [
        { id: 'deceased-name', label: 'Full Name of Deceased', placeholder: 'e.g. Pedro Garcia', required: true, span2: true },
        { id: 'requester-rel', label: 'Relationship to Deceased', placeholder: 'e.g. Son, Daughter, Spouse', required: true },
      ] },
    { id: 'house-blessing', name: 'House Blessing', desc: 'Blessing for a home or residence.',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
      fields: [
        { id: 'address', label: 'Complete Address', placeholder: 'e.g. 12 Mabini St., Cubao', required: true, span2: true },
        { id: 'household', label: 'Household / Owner Name', placeholder: 'e.g. Santos Family', required: true },
      ] },
    { id: 'vehicle-blessing', name: 'Vehicle / Item Blessing', desc: 'Blessing for a vehicle or a special item.',
      iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
      fields: [
        { id: 'item', label: 'Item Description', placeholder: 'e.g. 2023 Honda CR-V — XYZ 456', required: true, span2: true },
        { id: 'owner', label: "Owner's Name", placeholder: 'e.g. Maria Santos', required: true },
      ] },
    { id: 'first-communion', name: 'First Communion', desc: 'Sacrament of the Holy Eucharist, first reception.',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      fields: [
        { id: 'child-name-fc', label: "Child's Full Name", placeholder: 'e.g. Sofia Reyes', required: true, span2: true },
        { id: 'parents-fc', label: "Parent(s)' Names", placeholder: 'e.g. Carmen & Jose Reyes', required: false },
      ] },
    { id: 'business-dedication', name: 'Business Dedication', desc: 'Blessing to dedicate a new or existing business.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6M9 9v.01M9 12v.01M9 15v.01"/></svg>`,
      fields: [
        { id: 'business-name', label: 'Business Name', placeholder: 'e.g. Reyes Bakery', required: true, span2: true },
        { id: 'business-address', label: 'Business Address', placeholder: 'e.g. Aurora Blvd. corner 8th', required: true },
      ] },
    { id: 'anniversary-mass', name: 'Anniversary Mass', desc: 'Thanksgiving mass for a wedding or ordination anniversary.',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>`,
      fields: [
        { id: 'couple-names', label: "Couple's Names", placeholder: 'e.g. Ricardo & Maria Santos', required: true, span2: true },
        { id: 'years', label: 'Years Being Celebrated', placeholder: 'e.g. 15 years', required: false },
      ] },
  ];

  const menuView      = document.getElementById('menu-view');
  const formView       = document.getElementById('form-view');
  const svcDynamicFields      = document.getElementById('svc-dynamic-fields');
  const svcDateInput             = document.getElementById('svc-date');
  const svcContactInput             = document.getElementById('svc-contact');
  const svcNotesInput                  = document.getElementById('svc-notes');
  const svcSubmitBtn                     = document.getElementById('svc-submit');
  const formViewTitle                   = document.getElementById('form-view-title');
  const svcTypeGrid      = document.getElementById('svc-type-grid');

  let selectedTypeId = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) { msg = document.createElement('p'); msg.className = 'form-error-msg'; input.insertAdjacentElement('afterend', msg); }
    msg.textContent = message;
  }
  function clearFieldError(input) {
    input.classList.remove('has-error');
    const msg = input.parentElement.querySelector('.form-error-msg');
    if (msg) msg.remove();
  }
  /* --- Services We Offer — on-page catalog --- */
  svcTypeGrid.innerHTML = serviceTypes.map(s => `
    <button type="button" class="svc-type-card" data-id="${s.id}">
      <div class="svc-icon" style="background-color:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
      <p class="svc-type-name">${escapeHtml(s.name)}</p>
      <p class="svc-type-desc">${escapeHtml(s.desc)}</p>
      <span class="svc-type-cta">Start request
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
      </span>
    </button>`).join('');

  svcTypeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.svc-type-card');
    if (card) selectService(card.dataset.id);
  });

  function selectService(id) {
    const svc = serviceTypes.find(s => s.id === id);
    if (!svc) return;
    selectedTypeId = id;

    formViewTitle.textContent = `Request — ${svc.name}`;
    svcDateInput.value = '';
    svcContactInput.value = '';
    svcNotesInput.value = '';
    [svcDateInput, svcContactInput].forEach(clearFieldError);

    svcDynamicFields.innerHTML = svc.fields.map(f => `
      <div class="${f.span2 ? 'sm:col-span-2' : ''}">
        <label class="form-label" for="${f.id}">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
        <input type="text" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />
      </div>`).join('');

    menuView.classList.add('hidden');
    formView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToMenu() {
    selectedTypeId = null;
    formView.classList.add('hidden');
    menuView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('btn-back-to-menu').addEventListener('click', goToMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !formView.classList.contains('hidden')) goToMenu();
  });

  [svcDateInput, svcContactInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
    input.addEventListener('change', () => clearFieldError(input));
  });

  svcSubmitBtn.addEventListener('click', async () => {
    if (!selectedTypeId) return;
    const svc = serviceTypes.find(s => s.id === selectedTypeId);

    let hasError = false;
    svc.fields.filter(f => f.required).forEach(f => {
      const el = document.getElementById(f.id);
      clearFieldError(el);
      if (!el.value.trim()) { setFieldError(el, `${f.label} is required.`); hasError = true; }
    });

    clearFieldError(svcDateInput);
    if (!svcDateInput.value) { setFieldError(svcDateInput, 'Preferred date is required.'); hasError = true; }

    clearFieldError(svcContactInput);
    if (!svcContactInput.value.trim()) { setFieldError(svcContactInput, 'Contact number is required.'); hasError = true; }

    if (hasError) { window.showToast('Please fix the highlighted fields.', true); return; }

    const details = {};
    svc.fields.forEach(f => {
      const val = document.getElementById(f.id).value.trim();
      if (val) details[f.label] = val;
    });

    svcSubmitBtn.disabled = true;

    try {
      const result = await client.models.Blessing.create({
        requesterName: REQUESTER_NAME,
        type: svc.name,
        contact: svcContactInput.value.trim(),
        notes: svcNotesInput.value.trim() || undefined,
        details: JSON.stringify(details),
        preferredDate: svcDateInput.value,
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      goToMenu();
      window.showToast(`Your ${svc.name} request has been submitted — track it under "Requested Services."`);
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      svcSubmitBtn.disabled = false;
    }
  });

});