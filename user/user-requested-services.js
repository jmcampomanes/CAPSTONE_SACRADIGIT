/* ============================================
   SacraDigit — User Requested Services Scripts (AWS Amplify)
   Runs after user-shell.js.
   The tracking log for service/blessing requests —
   split out of user-request-service.js, which now
   only handles browsing services and submitting a
   new request. Backed by the same Blessing model.
   New requests book a fixed slot and are saved as
   'scheduled' right away (see ../service-schedule.js).
   Status mapping: scheduled -> Scheduled, completed ->
   Completed, declined -> Cancelled (by the parish),
   pending -> Pending (older requests from before
   fixed schedules).
   Filters client-side by requesterName === hardcoded
   demo name (matches user-request-service.js).
   ============================================ */

import { client } from '../amplify-init.js';
import { formatFullName, isNameEmpty } from '../name-utils.js';
import { downloadBookingIcs } from '../service-schedule.js';

document.addEventListener('DOMContentLoaded', () => {

  function isNameShaped(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v) &&
      ('firstName' in v || 'middleName' in v || 'lastName' in v || 'extension' in v);
  }

  // This page's `details` blob is keyed by field LABEL (not id), and most
  // values are plain strings — except name fields, stored as
  // {firstName, middleName, lastName, extension} objects (see
  // name-utils.js). Returns null to skip a row entirely (an untouched,
  // still-blank optional name field).
  function formatDetailValue(value) {
    if (isNameShaped(value)) return isNameEmpty(value) ? null : formatFullName(value);
    return value === null || value === undefined || value === '' ? null : String(value);
  }

  const REQUESTER_NAME = 'Maria P. Santos';

  const serviceTypes = [
    { id: 'baptism', name: 'Baptism',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>` },
    { id: 'wedding', name: 'Wedding',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>` },
    { id: 'funeral', name: 'Funeral Mass',
      iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>` },
    { id: 'house-blessing', name: 'House Blessing',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>` },
    { id: 'vehicle-blessing', name: 'Vehicle / Item Blessing',
      iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>` },
    { id: 'first-communion', name: 'First Communion',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` },
    { id: 'business-dedication', name: 'Business Dedication',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6M9 9v.01M9 12v.01M9 15v.01"/></svg>` },
    { id: 'anniversary-mass', name: 'Anniversary Mass',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>` },
  ];

  const serviceByName = name => serviceTypes.find(s => s.name === name);

  const badgeClass  = { pending: 'badge-amber', scheduled: 'badge-green', declined: 'badge-red', completed: 'badge-blue' };
  const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', declined: 'Cancelled', completed: 'Completed' };

  let myRequests = [];

  const requestsList  = document.getElementById('requests-list');
  const requestsEmpty  = document.getElementById('requests-empty');
  const requestsCount   = document.getElementById('requests-count');

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
  const modalCalendarBtn  = document.getElementById('modal-add-calendar');
  const cancelRequestModal = document.getElementById('cancel-request-modal');
  const cancelRequestTypeEl = document.getElementById('cancel-request-type');
  const cancelRequestConfirm = document.getElementById('cancel-request-confirm');

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
          <p class="svc-row-meta">${r.date ? '' : `Preferred ${fmtDate(r.preferredDate)} · `}Submitted ${fmtDate(r.createdAt)}</p>
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

  function openDetailModal(id) {
    const r = myRequests.find(x => x.id === id);
    if (!r) return;
    const svc = serviceByName(r.type) || { name: r.type };
    const details = getDetails(r);

    currentDetailId = id;
    // Pending requests, and booked slots that haven't happened yet, can
    // be cancelled — deleting the record frees the slot for someone else.
    const todayISO = new Date().toLocaleDateString('en-CA');
    const cancellable = r.status === 'pending' || (r.status === 'scheduled' && (r.date || '') >= todayISO);
    modalCancelBtn.classList.toggle('hidden', !cancellable);
    modalCalendarBtn.classList.toggle('hidden', !(r.status === 'scheduled' && r.date && r.time && r.date >= todayISO));

    document.getElementById('detail-modal-title').textContent = `${svc.name} Request`;
    modalStatusBadge.textContent = statusLabel[r.status] || r.status;
    modalStatusBadge.className = `badge ${badgeClass[r.status] || 'badge-gray'}`;
    modalSubmittedDate.textContent = `Submitted ${fmtDate(r.createdAt)}`;

    modalDetails.innerHTML = Object.entries(details)
      .map(([label, value]) => [label, formatDetailValue(value)])
      .filter(([, value]) => value)
      .map(([label, value]) => `
        <div><p class="modal-detail-item-label">${escapeHtml(label)}</p><p class="modal-detail-item-value">${escapeHtml(value)}</p></div>`).join('') + `
      ${r.date ? '' : `<div><p class="modal-detail-item-label">Preferred Date</p><p class="modal-detail-item-value">${fmtDate(r.preferredDate)}</p></div>`}
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
    btn.addEventListener('click', () => { closeModal(detailModal); closeModal(cancelRequestModal); });
  });
  [detailModal, cancelRequestModal].forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(detailModal); closeModal(cancelRequestModal); } });

  modalCalendarBtn.addEventListener('click', () => {
    const r = myRequests.find(x => x.id === currentDetailId);
    if (!r || !r.date || !r.time) return;
    const name = serviceByName(r.type)?.name || r.type;
    downloadBookingIcs({
      uid: r.id,
      title: name + ' - Our Lady of Fatima Parish',
      date: r.date,
      time: r.time,
      location: r.location || '',
      description: 'Your ' + name + ' booking with the parish. Please arrive 15 minutes early.',
    });
  });

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