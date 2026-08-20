/* ============================================
   SacraDigit — User My Requests Scripts (AWS Amplify)
   Runs after user-shell.js.
   No login yet, so this shows ALL CertificateRequest
   records rather than one person's — same caveat as
   the dashboard's "My Recent Requests" panel.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const STEPS = ['Submitted', 'Under Review', 'Approved', 'Ready for Pick-up', 'Released'];
  const stepIndexFor = { pending: 0, approved: 2, released: 4, rejected: -1 };

  let requests = [];
  let activeFilter = 'All';
  let currentDetailId = null;

  const filterMap = {
    'Pending':  ['pending'],
    'Approved': ['approved'],
    'Ready':    ['approved'], // schema has no separate "ready" status yet
    'Released': ['released'],
    'Rejected': ['rejected'],
  };

  const badgeClass = { pending: 'badge-amber', approved: 'badge-green', released: 'badge-gray', rejected: 'badge-red' };
  const statusLabel = { pending: 'Pending', approved: 'Approved', released: 'Released', rejected: 'Rejected' };

  const list        = document.getElementById('requests-list');
  const emptyState   = document.getElementById('requests-empty');
  const detailModal  = document.getElementById('detail-modal');

  const modalCancelBtn    = document.getElementById('modal-cancel-request');
  const cancelRequestModal = document.getElementById('cancel-request-modal');
  const cancelRequestTypeEl = document.getElementById('cancel-request-type');
  const cancelRequestConfirm = document.getElementById('cancel-request-confirm');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function formatShortDate(input) {
    if (!input) return '';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function getDetails(r) {
    if (!r.details) return {};
    try { return JSON.parse(r.details); } catch { return {}; }
  }

  client.models.CertificateRequest.observeQuery().subscribe({
    next: ({ items }) => {
      requests = items;
      renderStats();
      renderList();
    },
    error: (err) => {
      console.error('Failed to load requests:', err);
      list.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load requests.</p>`;
    },
  });

  function renderStats() {
    document.getElementById('stat-total').textContent   = requests.length;
    document.getElementById('stat-pending').textContent = requests.filter(r => r.status === 'pending').length;
    document.getElementById('stat-ready').textContent   = requests.filter(r => r.status === 'approved').length;
  }

  function renderList() {
    const filtered = activeFilter === 'All'
      ? requests
      : requests.filter(r => (filterMap[activeFilter] || []).includes(r.status));

    const sorted = filtered.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    list.innerHTML = '';
    if (sorted.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    sorted.forEach((r) => {
      const isRejected = r.status === 'rejected';
      const stepIdx = stepIndexFor[r.status] ?? 0;

      const stepDotsHtml = STEPS.map((step, i) => {
        let cls = '';
        if (isRejected) cls = i === 0 ? 'done' : i === 1 ? 'rejected' : '';
        else { if (i < stepIdx) cls = 'done'; else if (i === stepIdx) cls = 'current'; }
        return `<div class="req-step ${cls}"><div class="req-step-dot"></div><span class="req-step-label">${step.replace(' for Pick-up', '')}</span></div>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'req-card';
      card.innerHTML = `
        <div class="req-card-icon" style="background-color:rgba(139,143,199,0.16);color:#5b5fa8;">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <div class="req-card-body">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p class="req-card-title">${escapeHtml(r.certificateType)}</p>
              <p class="req-card-meta">Submitted ${formatShortDate(r.createdAt)}</p>
              <p class="req-card-purpose">${escapeHtml(r.purpose)}</p>
            </div>
            <span class="badge ${badgeClass[r.status] || 'badge-gray'}">${statusLabel[r.status] || r.status}</span>
          </div>
          <div class="req-progress-wrap"><div class="req-progress-steps">${stepDotsHtml}</div></div>
        </div>
        <div class="req-card-actions"><button type="button" class="btn-view-details" data-id="${r.id}">Details</button></div>`;
      list.appendChild(card);
    });
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-details');
    if (btn) openDetail(btn.dataset.id);
  });

  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.status-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeFilter = tab.dataset.filter;
      renderList();
    });
  });

  function openDetail(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;
    const isRejected = r.status === 'rejected';
    const details = getDetails(r);

    currentDetailId = id;
    modalCancelBtn.classList.toggle('hidden', r.status !== 'pending');

    document.getElementById('modal-title').textContent = r.certificateType;
    document.getElementById('modal-date').textContent  = `Submitted ${formatShortDate(r.createdAt)}`;

    const statusBadge = document.getElementById('modal-status-badge');
    statusBadge.textContent = statusLabel[r.status] || r.status;
    statusBadge.className   = `badge ${badgeClass[r.status] || 'badge-gray'}`;

    const detailGrid = document.getElementById('modal-details');
    detailGrid.innerHTML = Object.entries(details).filter(([, v]) => v).map(([label, value]) => `
      <div><p class="modal-detail-item-label">${escapeHtml(label)}</p><p class="modal-detail-item-value">${escapeHtml(value)}</p></div>`).join('');

    const purposeWrap = document.getElementById('modal-purpose-wrap');
    if (r.purpose) { purposeWrap.classList.remove('hidden'); document.getElementById('modal-purpose').textContent = r.purpose; }
    else purposeWrap.classList.add('hidden');

    const rejWrap = document.getElementById('modal-rejection-wrap');
    if (isRejected && r.rejectionReason) { rejWrap.classList.remove('hidden'); document.getElementById('modal-rejection').textContent = r.rejectionReason; }
    else rejWrap.classList.add('hidden');

    const stepIdx = stepIndexFor[r.status] ?? 0;
    const timeline = document.getElementById('modal-timeline');
    timeline.innerHTML = STEPS.map((step, i) => {
      let cls = '', sub = '';
      if (isRejected) {
        if (i === 0) { cls = 'done'; sub = formatShortDate(r.createdAt); }
        else if (i === 1) { cls = 'rejected'; sub = 'Request rejected'; }
      } else {
        if (i < stepIdx) { cls = 'done'; sub = 'Completed'; }
        else if (i === stepIdx) { cls = 'current'; sub = 'Current status'; }
        else sub = 'Pending';
        if (i === 0) sub = formatShortDate(r.createdAt);
      }
      return `<div class="req-timeline-step ${cls}">
        <div class="req-timeline-dot">${cls === 'done' ? '<svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}</div>
        <div class="req-timeline-content"><p class="req-timeline-label">${step}</p>${sub ? `<p class="req-timeline-sub">${sub}</p>` : ''}</div>
      </div>`;
    }).join('');

    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    detailModal.classList.add('hidden');
    cancelRequestModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeDetail));
  [detailModal, cancelRequestModal].forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeDetail(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

  modalCancelBtn.addEventListener('click', () => {
    if (!currentDetailId) return;
    const r = requests.find(x => x.id === currentDetailId);
    if (!r) return;
    cancelRequestTypeEl.textContent = r.certificateType;
    cancelRequestModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  cancelRequestConfirm.addEventListener('click', async () => {
    if (!currentDetailId) return;
    const removed = requests.find(x => x.id === currentDetailId);
    try {
      const result = await client.models.CertificateRequest.delete({ id: currentDetailId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeDetail();
      window.showToast(`${removed ? removed.certificateType : 'Request'} cancelled.`);
      currentDetailId = null;
    } catch (err) {
      console.error('Failed to cancel request:', err);
      window.showToast(err.message || "Couldn't cancel the request.", true);
    }
  });

});
