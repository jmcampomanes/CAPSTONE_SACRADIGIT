/* ============================================
   SacraDigit — User Request Certificate Scripts (AWS Amplify)
   Runs after user-shell.js.
   requesterName is hardcoded to match the demo
   user in user-shell.js until real parishioner
   login exists.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = 'Maria P. Santos';

  const certTypes = [
    { id: 'baptismal', name: 'Baptismal Certificate', desc: 'Proof of baptism recorded at the parish.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>`,
      fields: [
        { id: 'baptized-name', label: 'Full Name of Baptized Person', placeholder: 'e.g. Maria Paz Santos', required: true },
        { id: 'baptism-date', label: 'Approximate Date of Baptism', type: 'date', required: false },
        { id: 'father-name', label: "Father's Name", placeholder: 'e.g. Jose Santos', required: false },
        { id: 'mother-name', label: "Mother's Maiden Name", placeholder: 'e.g. Remedios Reyes', required: false },
      ] },
    { id: 'confirmation', name: 'Confirmation Certificate', desc: 'Proof of confirmation sacrament.',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      fields: [
        { id: 'confirmed-name', label: 'Full Name of Confirmed Person', placeholder: 'e.g. Maria Paz Santos', required: true },
        { id: 'confirmation-date', label: 'Approximate Date of Confirmation', type: 'date', required: false },
        { id: 'sponsor-name', label: "Sponsor's Name", placeholder: 'e.g. Elena Cruz', required: false },
      ] },
    { id: 'marriage', name: 'Marriage Certificate', desc: 'Parish record of a Catholic marriage.',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
      fields: [
        { id: 'groom-name', label: "Groom's Full Name", placeholder: 'e.g. Juan Dela Cruz', required: true },
        { id: 'bride-name', label: "Bride's Full Name", placeholder: 'e.g. Ana Reyes', required: true },
        { id: 'marriage-date', label: 'Date of Marriage', type: 'date', required: false },
      ] },
    { id: 'death', name: 'Death Certificate', desc: 'Parish record of a Catholic burial or funeral mass.',
      iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
      fields: [
        { id: 'deceased-name', label: 'Full Name of Deceased', placeholder: 'e.g. Pedro Garcia', required: true },
        { id: 'death-date', label: 'Approximate Date of Death', type: 'date', required: false },
        { id: 'requester-rel', label: 'Relationship to Deceased', placeholder: 'e.g. Son, Daughter, Spouse', required: true },
      ] },
  ];

  let selectedType = null;

  const certTypeGrid   = document.getElementById('cert-type-grid');
  const requestFormWrap = document.getElementById('request-form-wrap');
  const formTypeLabel   = document.getElementById('form-type-label');
  const dynamicFields    = document.getElementById('dynamic-fields');
  const successBanner    = document.getElementById('success-banner');
  const successDesc       = document.getElementById('success-desc');

  certTypeGrid.innerHTML = certTypes.map(c => `
    <button type="button" class="cert-type-card" data-id="${c.id}">
      <div class="cert-icon" style="background-color:${c.iconBg};color:${c.iconColor};">${c.icon}</div>
      <p class="cert-type-name">${c.name}</p>
      <p class="cert-type-desc">${c.desc}</p>
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

    dynamicFields.innerHTML = selectedType.fields.map(f => `
      <div class="${['baptized-name','confirmed-name','groom-name'].includes(f.id) ? 'sm:col-span-2' : ''}">
        <label class="form-label" for="${f.id}">${f.label}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
        ${f.type === 'date'
          ? `<input type="date" id="${f.id}" class="form-input" />`
          : `<input type="text" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />`}
      </div>`).join('');

    requestFormWrap.classList.remove('hidden');
    successBanner.classList.add('hidden');
    requestFormWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('btn-change-type').addEventListener('click', () => {
    selectedType = null;
    requestFormWrap.classList.add('hidden');
    successBanner.classList.add('hidden');
    document.querySelectorAll('.cert-type-card').forEach(c => c.classList.remove('selected'));
    certTypeGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('btn-submit-request').addEventListener('click', async () => {
    if (!selectedType) return;

    const requiredFields = selectedType.fields.filter(f => f.required);
    let allFilled = true;
    const details = {};

    selectedType.fields.forEach(f => {
      const el = document.getElementById(f.id);
      details[f.id] = el ? el.value.trim() : '';
      if (f.required && (!el || !el.value.trim())) {
        allFilled = false;
        el?.classList.add('border-red-400');
        el?.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
      }
    });

    const purposeEl = document.getElementById('field-purpose');
    const notesEl = document.getElementById('field-notes');
    if (!purposeEl.value.trim()) {
      allFilled = false;
      purposeEl.classList.add('border-red-400');
      purposeEl.addEventListener('input', () => purposeEl.classList.remove('border-red-400'), { once: true });
    }

    if (!allFilled) {
      window.showToast('Please fill in all required fields.', true);
      return;
    }

    const submitBtn = document.getElementById('btn-submit-request');
    submitBtn.disabled = true;

    try {
      const result = await client.models.CertificateRequest.create({
        requesterName: REQUESTER_NAME,
        certificateType: selectedType.name,
        purpose: purposeEl.value.trim(),
        notes: notesEl.value.trim() || undefined,
        details: JSON.stringify(details),
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      requestFormWrap.classList.add('hidden');
      successBanner.classList.remove('hidden');
      successDesc.textContent = `Your request for a ${selectedType.name} has been submitted. You'll be notified when it's ready for pick-up (typically 3–5 working days).`;
      successBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });

      window.showToast(`${selectedType.name} request submitted successfully.`);
      document.querySelectorAll('.cert-type-card').forEach(c => c.classList.remove('selected'));
      selectedType = null;
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('btn-new-request').addEventListener('click', () => {
    successBanner.classList.add('hidden');
    requestFormWrap.classList.add('hidden');
    document.querySelectorAll('.cert-type-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('#request-form-wrap input, #request-form-wrap textarea').forEach(el => el.value = '');
    certTypeGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

});
