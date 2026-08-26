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
      // These mirror exactly what appears on the printed Certificate of
      // Baptism (see baptismal-certificate-print.html) — Bk./Page/Line,
      // the officiating priest, and the issue date are filled in by the
      // parish office from the register, not asked of the requester here.
      fields: [
        { id: 'baptized-name', label: 'Full Name of Baptized Person', placeholder: 'e.g. Maria Paz Santos', required: true },
        { id: 'birth-date', label: 'Date of Birth', type: 'date', required: false },
        { id: 'birthplace', label: 'Place of Birth', placeholder: 'e.g. Quezon City', required: false },
        { id: 'baptism-date', label: 'Date of Baptism', type: 'date', required: false },
        { id: 'father-name', label: "Father's Full Name", placeholder: 'e.g. Jose Santos', required: false },
        { id: 'mother-name', label: "Mother's Maiden Name", placeholder: 'e.g. Remedios Reyes', required: false },
        { id: 'sponsor-1', label: 'Principal Sponsor (Godparent) 1', placeholder: 'e.g. Elena Cruz', required: false },
        { id: 'sponsor-2', label: 'Principal Sponsor (Godparent) 2', placeholder: 'e.g. Ramon Torres', required: false },
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
        { id: 'confirmed-name', label: 'Full Name of Confirmand', placeholder: 'e.g. Maria Paz Santos', required: true },
        { id: 'father-name', label: "Father's Name", placeholder: 'e.g. Jose Santos', required: false },
        { id: 'mother-name', label: "Mother's Name", placeholder: 'e.g. Remedios Reyes', required: false },
        { id: 'baptism-date', label: 'Date of Baptism', type: 'date', required: false },
        { id: 'baptism-church', label: 'Church of Baptism', placeholder: 'e.g. Our Lady of Fatima Parish', required: false },
        { id: 'confirmation-name', label: 'Confirmation Name (Saint Name)', placeholder: 'e.g. Teresa', required: false },
        { id: 'confirmation-date', label: 'Approximate Date of Confirmation', type: 'date', required: false },
        { id: 'sponsor-name', label: "Sponsor's Name", placeholder: 'e.g. Elena Cruz', required: false },
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
        { id: 'fc-name', label: 'Full Name of Communicant', placeholder: 'e.g. Keiana Brielle A. Ching', required: true },
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
        { id: 'groom-name', label: "Groom's Full Name", placeholder: 'e.g. Juan Dela Cruz', required: true },
        { id: 'bride-name', label: "Bride's Full Name", placeholder: 'e.g. Ana Reyes', required: true },
        { id: 'groom-father', label: "Groom's Father's Name", placeholder: 'e.g. Pedro Dela Cruz', required: false },
        { id: 'groom-mother', label: "Groom's Mother's Name", placeholder: 'e.g. Corazon Santos', required: false },
        { id: 'bride-father', label: "Bride's Father's Name", placeholder: 'e.g. Ramon Reyes', required: false },
        { id: 'bride-mother', label: "Bride's Mother's Name", placeholder: 'e.g. Luz Bautista', required: false },
        { id: 'marriage-date', label: 'Date of Marriage', type: 'date', required: false },
        { id: 'marriage-place', label: 'Place of Marriage', placeholder: 'e.g. Our Lady of Fatima Parish', required: false },
        { id: 'witness-1', label: 'Witness 1', placeholder: 'e.g. Mark Villanueva', required: false },
        { id: 'witness-2', label: 'Witness 2', placeholder: 'e.g. Carla Mendoza', required: false },
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
        { id: 'deceased-name', label: 'Full Name of Deceased', placeholder: 'e.g. Pedro Garcia', required: true },
        { id: 'age', label: 'Age at Time of Death', placeholder: 'e.g. 78', required: false },
        { id: 'death-date', label: 'Approximate Date of Death', type: 'date', required: false },
        { id: 'place-of-death', label: 'Place of Death', placeholder: 'e.g. Quezon City', required: false },
        { id: 'burial-date', label: 'Date of Burial', type: 'date', required: false },
        { id: 'burial-place', label: 'Place of Burial', placeholder: 'e.g. Loyola Memorial Park', required: false },
        { id: 'requester-rel', label: 'Relationship to Deceased', placeholder: 'e.g. Son, Daughter, Spouse', required: true },
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

    dynamicFields.innerHTML = selectedType.fields.map(f => `
      <div class="${['baptized-name','confirmed-name','fc-name','groom-name','bride-name','deceased-name'].includes(f.id) ? 'sm:col-span-2' : ''}">
        <label class="form-label" for="${f.id}">${f.label}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
        ${f.type === 'date'
          ? `<input type="date" id="${f.id}" class="form-input" />`
          : `<input type="text" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />`}
      </div>`).join('');

    menuView.classList.add('hidden');
    formView.classList.remove('hidden');
    requestFormWrap.classList.remove('hidden');
    successBanner.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToMenu() {
    selectedType = null;
    formView.classList.add('hidden');
    menuView.classList.remove('hidden');
    successBanner.classList.add('hidden');
    requestFormWrap.classList.remove('hidden');
    document.querySelectorAll('.cert-type-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('#request-form-wrap input, #request-form-wrap textarea').forEach(el => el.value = '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('btn-back-to-menu').addEventListener('click', goToMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !formView.classList.contains('hidden')) goToMenu();
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
      window.scrollTo({ top: 0, behavior: 'smooth' });

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

  document.getElementById('btn-new-request').addEventListener('click', goToMenu);

});