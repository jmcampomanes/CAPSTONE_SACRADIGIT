/* ============================================
   SacraDigit Admin — Schedule Offers Scripts (AWS Amplify)
   Runs after dashboard.js.

   Backed by the same Blessing model as Sacradigit/blessings.js and
   user/user-request-service.js — despite the model's name, it's used
   as the general parishioner service-request record for everything in
   user-request-service.js's catalog (sacraments, special masses, and
   literal blessings alike), so this page reviews all of it, not just
   blessings. Status mapping matches user-requested-services.js exactly:
   scheduled -> Scheduled, completed -> Completed, declined -> Cancelled,
   pending -> Pending.

   Parishioners now book fixed slots (../service-schedule.js), so new
   records arrive already 'scheduled'. Approve/Decline only shows for
   older 'pending' rows; upcoming bookings get a Cancel action instead.
   ============================================ */

import { client } from '../amplify-init.js';
import { logBookingAction } from '../service-schedule.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  let offers = []; // kept in sync via observeQuery, each has .id

  const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', declined: 'Cancelled', completed: 'Completed' };
  const badgeClass = { Pending: 'badge-amber', Scheduled: 'badge-green', Cancelled: 'badge-red', Completed: 'badge-blue' };

  const tbody       = document.getElementById('offers-tbody');
  const offersEmpty  = document.getElementById('offers-empty');
  const resultsCount  = document.getElementById('results-count');
  const searchInput   = document.getElementById('search-input');
  const typeFilter     = document.getElementById('type-filter');
  const statusFilter    = document.getElementById('status-filter');

  function escapeHtml(str) {
    const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // record.details is stored as an AWSJSON string (see
  // user-request-service.js's create() call) — parse it defensively,
  // since a malformed or missing value shouldn't break the row/modal.
  function parseDetails(record) {
    if (!record.details) return {};
    if (typeof record.details !== 'string') return record.details;
    try {
      const parsed = JSON.parse(record.details);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // A detail value can be a plain string, or a { firstName, middleName,
  // lastName, extension } name object (see name-utils.js) for any
  // name-kind field in the request form.
  function formatDetailValue(value) {
    if (value && typeof value === 'object') {
      return [value.firstName, value.middleName, value.lastName].filter(Boolean).join(' ') +
        (value.extension ? ` ${value.extension}` : '');
    }
    return value;
  }

  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'form-error-msg';
      input.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = message;
  }

  function clearFieldError(input) {
    input.classList.remove('has-error');
    const msg = input.parentElement.querySelector('.form-error-msg');
    if (msg) msg.remove();
  }


  /* --- Live data --- */
  client.models.Blessing.observeQuery().subscribe({
    next: ({ items }) => {
      offers = items;
      renderTypeFilterOptions();
      renderStats();
      renderTable();
    },
    error: (err) => {
      console.error('Failed to load schedule requests:', err);
      tbody.innerHTML = '';
      offersEmpty.classList.remove('hidden');
      offersEmpty.querySelector('p').textContent = "Couldn't load schedule requests from the database.";
    },
  });

  // Built from whatever service types actually exist in the live data
  // (rather than a hardcoded list) so it can never drift out of sync
  // with user-request-service.js's catalog of requestable services.
  let lastTypeOptions = null;
  function renderTypeFilterOptions() {
    const types = [...new Set(offers.map(o => o.type).filter(Boolean))].sort();
    const key = types.join('|');
    if (key === lastTypeOptions) return; // avoid clobbering an open selection on every live update
    lastTypeOptions = key;

    const current = typeFilter.value;
    typeFilter.innerHTML = `<option value="">All Services</option>` +
      types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if (types.includes(current)) typeFilter.value = current;
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    const weekStart = new Date(todayISO + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekCount = offers.filter(o => {
      if (!o.date) return false;
      const d = new Date(o.date + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    }).length;

    document.getElementById('stat-total').textContent    = offers.length;
    document.getElementById('stat-pending').textContent  = offers.filter(o => o.status === 'pending').length;
    document.getElementById('stat-approved').textContent = offers.filter(o => o.status === 'scheduled').length;
    document.getElementById('stat-week').textContent     = weekCount;

    updateActiveStatCard();
  }

  /* ------------------------------------------
     1b. STAT CARDS AS QUICK FILTERS
     Total clears the status filter; Pending /
     Approved set it and jump straight to the
     matching rows. "This Week" isn't a status,
     so it stays informational only.
  ------------------------------------------ */
  const statCardTotal    = document.getElementById('stat-total').closest('.stat-card');
  const statCardPending  = document.getElementById('stat-pending').closest('.stat-card');
  const statCardApproved = document.getElementById('stat-approved').closest('.stat-card');

  const statCardsByStatus = [
    { card: statCardTotal,    status: '' },
    { card: statCardPending,  status: 'Pending' },
    { card: statCardApproved, status: 'Scheduled' },
  ];

  statCardsByStatus.forEach(({ card, status }) => {
    card.classList.add('stat-card-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => {
      statusFilter.value = status;
      renderTable();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        statusFilter.value = status;
        renderTable();
      }
    });
  });

  function updateActiveStatCard() {
    statCardsByStatus.forEach(({ card, status }) => {
      card.classList.toggle('stat-card-active', statusFilter.value === status);
    });
  }


  /* ------------------------------------------
     2. RENDER TABLE
  ------------------------------------------ */
  function renderTable() {
    const query     = searchInput.value.trim().toLowerCase();
    const typeVal    = typeFilter.value;
    const statusVal   = statusFilter.value;

    updateActiveStatCard();

    const filtered = offers.filter(o => {
      const label = statusLabel[o.status] || o.status;
      const matchQuery  = !query || (o.requesterName || '').toLowerCase().includes(query) || (o.type || '').toLowerCase().includes(query);
      const matchType    = !typeVal   || o.type === typeVal;
      const matchStatus  = !statusVal || label  === statusVal;
      return matchQuery && matchType && matchStatus;
    });

    const sorted = filtered.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    resultsCount.textContent = `${sorted.length} request${sorted.length === 1 ? '' : 's'}`;

    if (sorted.length === 0) {
      tbody.innerHTML = '';
      offersEmpty.querySelector('p').textContent = 'No requests match your filters';
      offersEmpty.classList.remove('hidden');
      return;
    }
    offersEmpty.classList.add('hidden');

    tbody.innerHTML = sorted.map(o => {
      const label = statusLabel[o.status] || o.status;

      let actionsHtml = '';
      if (o.status === 'pending') {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-approve" data-id="${o.id}">Approve</button>
            <button type="button" class="row-reject"  data-id="${o.id}">Decline</button>
          </div>`;
      } else if (o.status === 'scheduled' && (o.date || '') >= todayISO) {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-view" data-id="${o.id}">View ›</button>
            <button type="button" class="row-reject row-cancel" data-id="${o.id}">Cancel</button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-view" data-id="${o.id}">View ›</button>
          </div>`;
      }

      return `
        <tr>
          <td class="font-medium text-gray-900">${escapeHtml(o.requesterName)}</td>
          <td>
            <span class="service-type-tag">${escapeHtml(o.type)}</span>
          </td>
          <td>
            ${o.date
              ? `${fmtDate(o.date)}${o.time ? `<span class="text-gray-400"> · ${escapeHtml(o.time)}</span>` : ''}`
              : `${fmtDate(o.preferredDate)} <span class="text-gray-400">(preferred)</span>`}
          </td>
          <td class="text-gray-400">${fmtDateTime(o.createdAt)}</td>
          <td><span class="badge ${badgeClass[label] || 'badge-gray'}">${escapeHtml(label)}</span></td>
          <td class="text-right">${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  }

  // Wire filters
  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);
  statusFilter.addEventListener('change', renderTable);
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value   = '';
    statusFilter.value  = '';
    renderTable();
  });

  // Delegate row actions
  tbody.addEventListener('click', e => {
    const approveBtn = e.target.closest('.row-approve');
    const rejectBtn   = e.target.closest('.row-reject');
    const viewBtn      = e.target.closest('.row-view');

    if (approveBtn) openAssignModal(approveBtn.dataset.id);
    if (rejectBtn)  openRejectModal(rejectBtn.dataset.id, { cancelBooking: rejectBtn.classList.contains('row-cancel') });
    if (viewBtn)    openViewModal(viewBtn.dataset.id);
  });


  /* ------------------------------------------
     3. ASSIGN (APPROVE) MODAL
  ------------------------------------------ */
  const assignModal     = document.getElementById('assign-modal');
  const assignName       = document.getElementById('assign-name');
  const assignService     = document.getElementById('assign-service');
  const assignDetailGrid  = document.getElementById('assign-detail-grid');
  const assignDateInput    = document.getElementById('assign-date');
  const assignTimeInput     = document.getElementById('assign-time');
  const assignNoteInput      = document.getElementById('assign-note');

  let assignTargetId = null;

  function openAssignModal(id) {
    const o = offers.find(x => x.id === id);
    if (!o) return;
    assignTargetId = id;

    assignName.textContent    = o.requesterName;
    assignService.textContent  = o.type;
    assignDateInput.value      = o.preferredDate || '';
    assignTimeInput.value       = '';
    assignNoteInput.value         = o.notes || '';
    [assignDateInput, assignTimeInput].forEach(clearFieldError);

    const details = parseDetails(o);
    assignDetailGrid.innerHTML = Object.entries(details).map(([label, value]) => `
      <div>
        <p class="so-detail-label">${escapeHtml(label)}</p>
        <p class="so-detail-value">${escapeHtml(formatDetailValue(value))}</p>
      </div>
    `).join('') + `
      <div>
        <p class="so-detail-label">Preferred Date</p>
        <p class="so-detail-value">${fmtDate(o.preferredDate)}</p>
      </div>
      <div>
        <p class="so-detail-label">Contact</p>
        <p class="so-detail-value">${escapeHtml(o.contact) || '—'}</p>
      </div>
    `;

    openModal(assignModal);
  }

  [assignDateInput, assignTimeInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
    input.addEventListener('change', () => clearFieldError(input));
  });

  document.getElementById('assign-submit').addEventListener('click', async () => {
    if (assignTargetId === null) return;

    const date      = assignDateInput.value;
    const time24     = assignTimeInput.value;
    const note         = assignNoteInput.value.trim();

    [assignDateInput, assignTimeInput].forEach(clearFieldError);

    let hasError = false;
    if (!date)   { setFieldError(assignDateInput, 'Confirmed date is required.'); hasError = true; }
    if (!time24) { setFieldError(assignTimeInput, 'Confirmed time is required.'); hasError = true; }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    const o = offers.find(x => x.id === assignTargetId);
    const submitBtn = document.getElementById('assign-submit');
    submitBtn.disabled = true;

    try {
      const confirmedTime = formatTime12(time24);
      const result = await client.models.Blessing.update({
        id: assignTargetId,
        status: 'scheduled',
        date,
        time: confirmedTime,
        notes: note || undefined,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(assignModal);
      showToast(`${o ? o.type : 'Request'} for ${o ? o.requesterName : 'requester'} approved — ${fmtDate(date)} at ${confirmedTime}.`);
      assignTargetId = null;
    } catch (err) {
      console.error('Failed to approve request:', err);
      showToast(err.message || "Couldn't approve request.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });


  /* ------------------------------------------
     4. REJECT MODAL
  ------------------------------------------ */
  const rejectModal  = document.getElementById('reject-modal');
  const rejectName    = document.getElementById('reject-name');
  const rejectReason   = document.getElementById('reject-reason');
  const rejectTitle    = document.getElementById('reject-title');
  const rejectVerb     = document.getElementById('reject-verb');
  const rejectSubmitBtn = document.getElementById('reject-submit');
  let rejectTargetId = null;
  let rejectIsCancel = false;

  // Also used to cancel a booked slot — status 'declined' frees the
  // slot and shows the reason to the parishioner.
  function openRejectModal(id, { cancelBooking = false } = {}) {
    const o = offers.find(x => x.id === id);
    if (!o) return;
    rejectTargetId = id;
    rejectIsCancel = cancelBooking;
    rejectTitle.textContent = cancelBooking ? 'Cancel Booking' : 'Decline Request';
    rejectVerb.textContent = cancelBooking
      ? `Cancelling the ${o.type} booking on ${fmtDate(o.date)}${o.time ? ` at ${o.time}` : ''} for`
      : 'Declining request from';
    rejectSubmitBtn.textContent = cancelBooking ? 'Cancel Booking' : 'Decline Request';
    rejectName.textContent = o.requesterName;
    rejectReason.value      = '';
    clearFieldError(rejectReason);
    openModal(rejectModal);
  }

  rejectReason.addEventListener('input', () => clearFieldError(rejectReason));

  document.getElementById('reject-submit').addEventListener('click', async () => {
    if (rejectTargetId === null) return;
    const reason = rejectReason.value.trim();
    if (!reason) {
      setFieldError(rejectReason, rejectIsCancel ? 'Please tell the parishioner why it was cancelled.' : 'Please provide a reason for declining.');
      showToast('Please fix the highlighted fields.', true);
      return;
    }
    clearFieldError(rejectReason);

    const o = offers.find(x => x.id === rejectTargetId);
    const submitBtn = document.getElementById('reject-submit');
    submitBtn.disabled = true;

    try {
      const result = await client.models.Blessing.update({
        id: rejectTargetId,
        status: 'declined',
        declineReason: reason,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(rejectModal);
      logBookingAction(client, { action: rejectIsCancel ? 'Cancel' : 'Decline', record: o, reason });
      showToast(rejectIsCancel
        ? `Booking for ${o ? o.requesterName : 'requester'} cancelled — the slot is open again.`
        : `Request from ${o ? o.requesterName : 'requester'} declined.`);
      rejectTargetId = null;
    } catch (err) {
      console.error('Failed to decline request:', err);
      showToast(err.message || "Couldn't decline request.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });


  /* ------------------------------------------
     5. VIEW DETAILS MODAL (non-pending rows)
  ------------------------------------------ */
  const viewModal          = document.getElementById('view-modal');
  const viewName             = document.getElementById('view-name');
  const viewStatusBadge       = document.getElementById('view-status-badge');
  const viewDetailGrid          = document.getElementById('view-detail-grid');
  const viewScheduleWrap           = document.getElementById('view-schedule-wrap');
  const viewScheduleValue             = document.getElementById('view-schedule-value');
  const viewDeclineWrap                = document.getElementById('view-decline-wrap');
  const viewDeclineReason                = document.getElementById('view-decline-reason');
  const viewNotesWrap                       = document.getElementById('view-notes-wrap');
  const viewNotes                              = document.getElementById('view-notes');

  function openViewModal(id) {
    const o = offers.find(x => x.id === id);
    if (!o) return;

    const label = statusLabel[o.status] || o.status;
    viewName.textContent = o.requesterName;
    viewStatusBadge.textContent = label;
    viewStatusBadge.className = `badge ${badgeClass[label] || 'badge-gray'}`;

    const details = parseDetails(o);
    viewDetailGrid.innerHTML = Object.entries(details).map(([l, value]) => `
      <div>
        <p class="so-detail-label">${escapeHtml(l)}</p>
        <p class="so-detail-value">${escapeHtml(formatDetailValue(value))}</p>
      </div>
    `).join('') + `
      <div>
        <p class="so-detail-label">Service Type</p>
        <p class="so-detail-value">${escapeHtml(o.type)}</p>
      </div>
      <div>
        <p class="so-detail-label">Preferred Date</p>
        <p class="so-detail-value">${fmtDate(o.preferredDate)}</p>
      </div>
      <div>
        <p class="so-detail-label">Submitted</p>
        <p class="so-detail-value">${fmtDateTime(o.createdAt)}</p>
      </div>
      <div>
        <p class="so-detail-label">Contact</p>
        <p class="so-detail-value">${escapeHtml(o.contact) || '—'}</p>
      </div>
    `;

    if (o.date) {
      viewScheduleValue.textContent = `${fmtDate(o.date)}${o.time ? ` at ${o.time}` : ''}`;
      viewScheduleWrap.classList.remove('hidden');
    } else {
      viewScheduleWrap.classList.add('hidden');
    }

    if (o.status === 'declined' && o.declineReason) {
      viewDeclineReason.textContent = o.declineReason;
      viewDeclineWrap.classList.remove('hidden');
    } else {
      viewDeclineWrap.classList.add('hidden');
    }

    if (o.notes) {
      viewNotes.textContent = o.notes;
      viewNotesWrap.classList.remove('hidden');
    } else {
      viewNotesWrap.classList.add('hidden');
    }

    openModal(viewModal);
  }


  /* ------------------------------------------
     6. MODAL HELPERS
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(assignModal);
      closeModal(rejectModal);
      closeModal(viewModal);
    });
  });

  [assignModal, rejectModal, viewModal].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal(assignModal);
      closeModal(rejectModal);
      closeModal(viewModal);
    }
  });

  function openModal(m) {
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(m) {
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function formatTime12(t24) {
    let [h, m] = t24.split(':').map(Number);
    const mer = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`;
  }


  /* ------------------------------------------
     7. TOAST
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message; else toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});