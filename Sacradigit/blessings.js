/* ============================================
   SacraDigit Admin — Blessings Scripts (AWS Amplify)
   Backed by the Blessing model.
   Fields: requesterName, type, location,
   status ('pending'|'scheduled'|'completed'|'declined'),
   preferredDate, date, time, declineReason
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  let upcoming = [];
  let requests = [];
  let completed = [];

  const upcomingList   = document.getElementById('upcoming-list');
  const upcomingEmpty   = document.getElementById('upcoming-empty');
  const upcomingCount   = document.getElementById('upcoming-count');
  const requestsList    = document.getElementById('requests-list');
  const requestsEmpty    = document.getElementById('requests-empty');
  const requestsCount    = document.getElementById('requests-count');
  const completedList    = document.getElementById('completed-list');
  const completedCount    = document.getElementById('completed-count');

  const searchInput = document.getElementById('search-input');
  const typeFilter    = document.getElementById('type-filter');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatLongDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function blessingIconSvg() {
    return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
  }

  function matchesFilters(record) {
    const query   = searchInput.value.trim().toLowerCase();
    const typeVal = typeFilter.value;

    const matchesQuery = !query ||
      (record.requesterName || '').toLowerCase().includes(query) ||
      (record.type || '').toLowerCase().includes(query);

    const matchesType = !typeVal || record.type === typeVal;

    return matchesQuery && matchesType;
  }


  /* --- Live data --- */
  client.models.Blessing.observeQuery().subscribe({
    next: ({ items }) => {
      upcoming = [];
      requests = [];
      completed = [];

      items.forEach(b => {
        if (b.status === 'scheduled') upcoming.push(b);
        else if (b.status === 'pending') requests.push(b);
        else if (b.status === 'completed') completed.push(b);
        // 'declined' records are intentionally not shown in any list
      });

      renderStats();
      renderUpcoming();
      renderRequests();
      renderCompleted();
    },
    error: (err) => {
      console.error('Failed to load blessings:', err);
      showToast("Couldn't load blessings from the database.", true);
    },
  });


  function renderStats() {
    document.getElementById('stat-scheduled').textContent = upcoming.length;
    document.getElementById('stat-pending').textContent   = requests.length;
  }


  function renderUpcoming() {
    const sorted = upcoming.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const filtered = sorted.filter(matchesFilters);

    upcomingCount.textContent = `${filtered.length} scheduled`;

    if (filtered.length === 0) {
      upcomingList.innerHTML = '';
      upcomingEmpty.classList.remove('hidden');
      return;
    }
    upcomingEmpty.classList.add('hidden');

    upcomingList.innerHTML = filtered.map(b => `
      <li>
        <div class="blessing-row">
          <div class="blessing-icon">${blessingIconSvg()}</div>
          <div class="blessing-info">
            <p class="blessing-name">${escapeHtml(b.requesterName)}</p>
            <p class="blessing-meta">${escapeHtml(b.type)} · ${escapeHtml(b.location)}</p>
          </div>
          <div>
            <div class="blessing-datetime">
              ${formatLongDate(b.date)}<br/>${escapeHtml(b.time)}
            </div>
            <button type="button" class="blessing-details-btn" data-section="upcoming" data-id="${b.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join('');
  }


  function renderRequests() {
    const filtered = requests.filter(matchesFilters);

    requestsCount.textContent = `${filtered.length} pending`;

    if (filtered.length === 0) {
      requestsList.innerHTML = '';
      requestsEmpty.classList.remove('hidden');
      return;
    }
    requestsEmpty.classList.add('hidden');

    requestsList.innerHTML = filtered.map((r) => `
      <li>
        <div class="request-row">
          <div class="request-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="request-info">
            <p class="request-name">${escapeHtml(r.requesterName)}</p>
            <p class="request-meta">${escapeHtml(r.type)} · requested for ${formatLongDate(r.preferredDate)}</p>
          </div>
          <div class="request-actions">
            <div class="request-action-row">
              <button type="button" class="req-approve" data-id="${r.id}">Approve</button>
              <button type="button" class="req-decline" data-id="${r.id}">Decline</button>
            </div>
            <button type="button" class="blessing-details-btn" data-section="requests" data-id="${r.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join('');
  }

  requestsList.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('.req-approve');
    const declineBtn = e.target.closest('.req-decline');

    if (approveBtn) approveRequest(approveBtn.dataset.id);
    if (declineBtn) openDeclineModal(declineBtn.dataset.id);
  });

  async function approveRequest(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;

    try {
      const result = await client.models.Blessing.update({
        id,
        status: 'scheduled',
        date: r.preferredDate,
        time: r.time || '09:00 AM',
        location: r.location || 'To be confirmed',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      showToast(`Request approved — ${r.requesterName} added to the schedule.`);
    } catch (err) {
      console.error('Failed to approve request:', err);
      showToast(err.message || "Couldn't approve request.", true);
    }
  }


  function renderCompleted() {
    const sorted = completed.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const filtered = sorted.filter(matchesFilters);

    completedCount.textContent = `${filtered.length} completed`;

    completedList.innerHTML = filtered.map(c => `
      <li>
        <div class="completed-row">
          <div class="completed-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${escapeHtml(c.requesterName)}</p>
            <p class="completed-meta">${escapeHtml(c.type)}</p>
          </div>
          <div>
            <div class="completed-date">${formatLongDate(c.date)}</div>
            <button type="button" class="blessing-details-btn" data-section="completed" data-id="${c.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join('');
  }


  searchInput.addEventListener('input', () => { renderUpcoming(); renderRequests(); renderCompleted(); });
  typeFilter.addEventListener('change', () => { renderUpcoming(); renderRequests(); renderCompleted(); });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    renderUpcoming(); renderRequests(); renderCompleted();
  });

  [upcomingList, requestsList, completedList].forEach(listEl => {
    listEl.addEventListener('click', (e) => {
      const detailsBtn = e.target.closest('.blessing-details-btn');
      if (!detailsBtn) return;
      openDetailsModal(detailsBtn.dataset.section, detailsBtn.dataset.id);
    });
  });


  /* --- Schedule Blessing Modal --- */
  const scheduleModal = document.getElementById('schedule-modal');

  document.getElementById('btn-schedule-blessing').addEventListener('click', () => {
    document.getElementById('schedule-date').value = todayISO;
    openModal(scheduleModal);
  });

  document.getElementById('schedule-submit').addEventListener('click', async () => {
    const requesterName = document.getElementById('schedule-requester').value.trim();
    const date       = document.getElementById('schedule-date').value;
    const time24     = document.getElementById('schedule-time').value;
    const type        = document.getElementById('schedule-type').value;
    const location     = document.getElementById('schedule-location').value.trim();

    if (!requesterName || !date || !time24 || !type) {
      showToast('Please fill in requester, date, time, and blessing type.', true);
      return;
    }

    const submitBtn = document.getElementById('schedule-submit');
    submitBtn.disabled = true;

    try {
      const result = await client.models.Blessing.create({
        requesterName,
        type,
        location: location || 'Not specified',
        date,
        time: formatTime12(time24),
        status: 'scheduled',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(scheduleModal);
      showToast(`Blessing scheduled for ${requesterName} on ${formatLongDate(date)}.`);
      document.getElementById('schedule-requester').value = '';
      document.getElementById('schedule-time').value = '';
      document.getElementById('schedule-type').value = '';
      document.getElementById('schedule-location').value = '';
    } catch (err) {
      console.error('Failed to schedule blessing:', err);
      showToast("Couldn't save the blessing.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* --- Decline Reason Modal --- */
  const declineModal = document.getElementById('decline-modal');
  const declineTargetName = document.getElementById('decline-target-name');
  const declineReasonInput = document.getElementById('decline-reason');
  let declineTargetId = null;

  function openDeclineModal(id) {
    const r = requests.find(x => x.id === id);
    if (!r) return;
    declineTargetId = id;
    declineTargetName.textContent = r.requesterName;
    declineReasonInput.value = '';
    openModal(declineModal);
  }

  document.getElementById('decline-submit').addEventListener('click', async () => {
    if (!declineTargetId) return;

    const r = requests.find(x => x.id === declineTargetId);
    const reason = declineReasonInput.value.trim();

    try {
      const result = await client.models.Blessing.update({
        id: declineTargetId,
        status: 'declined',
        declineReason: reason || undefined,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(declineModal);
      showToast(`Request from ${r ? r.requesterName : 'requester'} declined.`);
      declineTargetId = null;
    } catch (err) {
      console.error('Failed to decline request:', err);
      showToast("Couldn't decline the request.", true);
    }
  });


  /* --- Modal helpers --- */
  const detailsModal = document.getElementById('details-modal');
  const detailsBody   = document.getElementById('details-body');

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(scheduleModal);
      closeModal(declineModal);
      closeModal(detailsModal);
    });
  });

  [scheduleModal, declineModal, detailsModal].forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(scheduleModal); closeModal(declineModal); closeModal(detailsModal); }
  });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

  function openDetailsModal(section, id) {
    let record, statusLabel, dateLabel, dateValue, extraRows = '';

    if (section === 'upcoming') {
      record = upcoming.find(x => x.id === id);
      statusLabel = 'Scheduled';
      dateLabel = 'Date & Time';
      if (record) dateValue = `${formatLongDate(record.date)} · ${record.time}`;
      if (record) extraRows = `<div><p class="so-detail-label">Location</p><p class="so-detail-value">${escapeHtml(record.location)}</p></div>`;
    } else if (section === 'requests') {
      record = requests.find(x => x.id === id);
      statusLabel = 'Pending Approval';
      dateLabel = 'Preferred Date';
      if (record) dateValue = formatLongDate(record.preferredDate);
    } else {
      record = completed.find(x => x.id === id);
      statusLabel = 'Completed';
      dateLabel = 'Date Completed';
      if (record) dateValue = formatLongDate(record.date);
    }

    if (!record) return;

    detailsBody.innerHTML = `
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Requester</p><p class="so-detail-value">${escapeHtml(record.requesterName)}</p></div>
        <div><p class="so-detail-label">Blessing Type</p><p class="so-detail-value">${escapeHtml(record.type)}</p></div>
        <div><p class="so-detail-label">Status</p><p class="so-detail-value">${statusLabel}</p></div>
        <div><p class="so-detail-label">${dateLabel}</p><p class="so-detail-value">${dateValue}</p></div>
        ${extraRows}
      </div>
    `;

    openModal(detailsModal);
  }


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
