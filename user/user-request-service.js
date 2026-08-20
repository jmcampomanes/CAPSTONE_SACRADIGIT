/* ============================================
   SacraDigit — User Request a Service Scripts (AWS Amplify)
   Runs after user-shell.js.
   Backed by the same Blessing model the admin
   Blessings page uses. Status mapping:
   pending -> Pending, scheduled -> Approved,
   completed -> Completed, declined -> Rejected.
   "My Requests" filters client-side by
   requesterName === hardcoded demo name.
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

  const serviceByName = name => serviceTypes.find(s => s.name === name);

  const badgeClass  = { pending: 'badge-amber', scheduled: 'badge-green', declined: 'badge-red', completed: 'badge-blue' };
  const statusLabel = { pending: 'Pending', scheduled: 'Approved', declined: 'Rejected', completed: 'Completed' };

  let myRequests = [];

  const requestsList  = document.getElementById('requests-list');
  const requestsEmpty  = document.getElementById('requests-empty');
  const requestsCount   = document.getElementById('requests-count');

  const requestModal = document.getElementById('request-modal');
  const svcStepType    = document.getElementById('svc-step-type');
  const svcTypeGrid      = document.getElementById('svc-type-grid');
  const svcStepForm         = document.getElementById('svc-step-form');
  const svcDynamicFields      = document.getElementById('svc-dynamic-fields');
  const svcDateInput             = document.getElementById('svc-date');
  const svcContactInput             = document.getElementById('svc-contact');
  const svcNotesInput                  = document.getElementById('svc-notes');
  const svcSubmitBtn                     = document.getElementById('svc-submit');
  const requestModalTitle                   = document.getElementById('request-modal-title');

  const detailModal    = document.getElementById('detail-modal');
  const modalStatusBadge  = document.getElementById('modal-status-badge');
  const modalSubmittedDate = document.getElementById('modal-submitted-date');
  const modalDetails          = document.getElementById('modal-details');
  const modalScheduleWrap        = document.getElementById('modal-schedule-wrap');
  const modalScheduleValue          = document.getElementById('modal-schedule-value');
  const modalRejectionWrap             = document.getElementById('modal-rejection-wrap');
  const modalRejection                    = document.getElementById('modal-rejection');
  const modalNotesWrap                       = document.getElementById('modal-notes-wrap');
  const modalNotes                              = document.getElementById('modal-notes');

  const modalCancelBtn    = document.getElementById('modal-cancel-request');
  const cancelRequestModal = document.getElementById('cancel-request-modal');
  const cancelRequestTypeEl = document.getElementById('cancel-request-type');
  const cancelRequestConfirm = document.getElementById('cancel-request-confirm');

  let selectedTypeId = null;
  let currentDetailId = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function fmtDate(input) {
    if (!input) return '—';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }
  function getDetails(r) {
    if (!r.details) return {};
    try { return JSON.parse(r.details); } catch { return {}; }
  }

  client.models.Blessing.observeQuery({ filter: { requesterName: { eq: REQUESTER_NAME } } }).subscribe({
    next: ({ items }) => { myRequests = items; renderStats(); renderList(); },
    error: (err) => {
      console.error('Failed to load requests:', err);
      requestsList.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load requests.</p>`;
    },
  });

  function renderStats() {
    document.getElementById('stat-total').textContent     = myRequests.length;
    document.getElementById('stat-pending').textContent   = myRequests.filter(r => r.status === 'pending').length;
    document.getElementById('stat-approved').textContent  = myRequests.filter(r => r.status === 'scheduled').length;
    document.getElementById('stat-completed').textContent = myRequests.filter(r => r.status === 'completed').length;
  }

  function renderList() {
    requestsCount.textContent = `${myRequests.length} request${myRequests.length === 1 ? '' : 's'}`;

    if (myRequests.length === 0) {
      requestsList.innerHTML = '';
      requestsEmpty.classList.remove('hidden');
      return;
    }
    requestsEmpty.classList.add('hidden');

    const sorted = myRequests.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    requestsList.innerHTML = sorted.map((r) => {
      const svc = serviceByName(r.type) || { name: r.type, iconBg: '#eee', iconColor: '#888', icon: '' };
      const scheduleChip = r.date ? `<span class="svc-row-schedule">${fmtDate(r.date)}${r.time ? ` at ${r.time}` : ''}</span>` : '';

      return `<div class="svc-row">
        <div class="svc-row-icon" style="background-color:${svc.iconBg};color:${svc.iconColor};">${svc.icon}</div>
        <div class="svc-row-body">
          <p class="svc-row-title">${escapeHtml(svc.name)}</p>
          <p class="svc-row-meta">Preferred ${fmtDate(r.preferredDate)} · Submitted ${fmtDate(r.createdAt)}</p>
          <div>${scheduleChip}</div>
        </div>
        <div class="svc-row-actions">
          <span class="badge ${badgeClass[r.status] || 'badge-gray'}">${statusLabel[r.status] || r.status}</span>
          <button type="button" class="btn-view-details" data-id="${r.id}">View ›</button>
        </div>
      </div>`;
    }).join('');
  }

  requestsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-details');
    if (btn) openDetailModal(btn.dataset.id);
  });

  function resetRequestModal() {
    selectedTypeId = null;
    svcStepType.classList.remove('hidden');
    svcStepForm.classList.add('hidden');
    svcSubmitBtn.classList.add('hidden');
    requestModalTitle.textContent = 'Request a Service';
    svcDateInput.value = '';
    svcContactInput.value = '';
    svcNotesInput.value = '';
    [svcDateInput, svcContactInput].forEach(clearFieldError);
    document.querySelectorAll('.svc-type-card').forEach(c => c.classList.remove('selected'));
  }

  function openRequestModal() { resetRequestModal(); openModal(requestModal); }
  document.getElementById('btn-request-service').addEventListener('click', openRequestModal);
  document.getElementById('btn-empty-request').addEventListener('click', openRequestModal);

  svcTypeGrid.innerHTML = serviceTypes.map(s => `
    <button type="button" class="svc-type-card" data-id="${s.id}">
      <div class="svc-icon" style="background-color:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
      <p class="svc-type-name">${escapeHtml(s.name)}</p>
      <p class="svc-type-desc">${escapeHtml(s.desc)}</p>
    </button>`).join('');

  svcTypeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.svc-type-card');
    if (card) selectServiceType(card.dataset.id);
  });

  function selectServiceType(id) {
    const svc = serviceTypes.find(s => s.id === id);
    if (!svc) return;
    selectedTypeId = id;

    document.querySelectorAll('.svc-type-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
    requestModalTitle.textContent = `Request — ${svc.name}`;

    svcDynamicFields.innerHTML = svc.fields.map(f => `
      <div class="${f.span2 ? 'sm:col-span-2' : ''}">
        <label class="form-label" for="${f.id}">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
        <input type="text" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />
      </div>`).join('');

    svcStepType.classList.add('hidden');
    svcStepForm.classList.remove('hidden');
    svcSubmitBtn.classList.remove('hidden');
  }

  document.getElementById('btn-change-svc-type').addEventListener('click', () => {
    selectedTypeId = null;
    svcStepType.classList.remove('hidden');
    svcStepForm.classList.add('hidden');
    svcSubmitBtn.classList.add('hidden');
    requestModalTitle.textContent = 'Request a Service';
    document.querySelectorAll('.svc-type-card').forEach(c => c.classList.remove('selected'));
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

      closeModal(requestModal);
      window.showToast(`Your ${svc.name} request has been submitted for review.`);
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    }
  });

  function openDetailModal(id) {
    const r = myRequests.find(x => x.id === id);
    if (!r) return;
    const svc = serviceByName(r.type) || { name: r.type };
    const details = getDetails(r);

    currentDetailId = id;
    modalCancelBtn.classList.toggle('hidden', r.status !== 'pending');

    document.getElementById('detail-modal-title').textContent = `${svc.name} Request`;
    modalStatusBadge.textContent = statusLabel[r.status] || r.status;
    modalStatusBadge.className = `badge ${badgeClass[r.status] || 'badge-gray'}`;
    modalSubmittedDate.textContent = `Submitted ${fmtDate(r.createdAt)}`;

    modalDetails.innerHTML = Object.entries(details).map(([label, value]) => `
      <div><p class="modal-detail-item-label">${escapeHtml(label)}</p><p class="modal-detail-item-value">${escapeHtml(value)}</p></div>`).join('') + `
      <div><p class="modal-detail-item-label">Preferred Date</p><p class="modal-detail-item-value">${fmtDate(r.preferredDate)}</p></div>
      <div><p class="modal-detail-item-label">Contact</p><p class="modal-detail-item-value">${escapeHtml(r.contact)}</p></div>`;

    if (r.date) {
      modalScheduleValue.textContent = `${fmtDate(r.date)}${r.time ? ` at ${r.time}` : ''}`;
      modalScheduleWrap.classList.remove('hidden');
    } else modalScheduleWrap.classList.add('hidden');

    if (r.status === 'declined' && r.declineReason) {
      modalRejection.textContent = r.declineReason;
      modalRejectionWrap.classList.remove('hidden');
    } else modalRejectionWrap.classList.add('hidden');

    if (r.status !== 'declined' && r.notes) {
      modalNotes.textContent = r.notes;
      modalNotesWrap.classList.remove('hidden');
    } else modalNotesWrap.classList.add('hidden');

    openModal(detailModal);
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(requestModal); closeModal(detailModal); closeModal(cancelRequestModal); });
  });
  [requestModal, detailModal, cancelRequestModal].forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(requestModal); closeModal(detailModal); closeModal(cancelRequestModal); } });

  modalCancelBtn.addEventListener('click', () => {
    if (!currentDetailId) return;
    const r = myRequests.find(x => x.id === currentDetailId);
    if (!r) return;
    cancelRequestTypeEl.textContent = serviceByName(r.type)?.name || r.type;
    openModal(cancelRequestModal);
  });

  cancelRequestConfirm.addEventListener('click', async () => {
    if (!currentDetailId) return;
    const removed = myRequests.find(x => x.id === currentDetailId);
    try {
      const result = await client.models.Blessing.delete({ id: currentDetailId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      currentDetailId = null;
      closeModal(detailModal);
      closeModal(cancelRequestModal);
      window.showToast(`${removed ? serviceByName(removed.type)?.name || removed.type : 'Request'} cancelled.`);
    } catch (err) {
      console.error('Failed to cancel request:', err);
      window.showToast(err.message || "Couldn't cancel the request.", true);
    }
  });

});
