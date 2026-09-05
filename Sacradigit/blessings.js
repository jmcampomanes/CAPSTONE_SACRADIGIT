/* ============================================
   SacraDigit Admin — Blessings Scripts (AWS Amplify)
   Backed by the Blessing model.
   Fields: requesterName, type, location,
   status ('pending'|'scheduled'|'completed'|'declined'),
   preferredDate, date, time, declineReason
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  function toLocalISODate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todayISO = toLocalISODate();

  let upcoming = [];
  let requests = [];
  let completed = [];

  const upcomingList   = document.getElementById('upcoming-list');
  const upcomingEmpty   = document.getElementById('upcoming-empty');
  const upcomingCount   = document.getElementById('upcoming-count');
  const upcomingPagination = document.getElementById('upcoming-pagination');
  const requestsList    = document.getElementById('requests-list');
  const requestsEmpty    = document.getElementById('requests-empty');
  const requestsCount    = document.getElementById('requests-count');
  const requestsPagination = document.getElementById('requests-pagination');
  const completedList    = document.getElementById('completed-list');
  const completedCount    = document.getElementById('completed-count');
  const completedPagination = document.getElementById('completed-pagination');

  const searchInput = document.getElementById('search-input');
  const typeFilter    = document.getElementById('type-filter');

  const PAGE_SIZE = 6;
  let upcomingPage = 1;
  let requestsPage = 1;
  let completedPage = 1;

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
      if (showingCalendar) renderCalendar();
      // Keep an open Day Plan modal in sync with live updates (e.g.
      // another admin approving/declining a request while it's on screen).
      if (selectedDateIso && !dayPlanModal.classList.contains('hidden')) openDayPlanModal(selectedDateIso);
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


  /* ------------------------------------------
     STAT CARDS AS QUICK NAVIGATION
     "Scheduled This Week" and "Pending Requests"
     jump to and briefly highlight their matching
     panel below. "Avg. Per Week" and "Slots Open"
     are static placeholders with no backing panel,
     so they stay non-interactive.
  ------------------------------------------ */
  const statCardsToPanels = [
    { card: document.getElementById('stat-scheduled').closest('.stat-card'), panelId: 'upcoming-panel' },
    { card: document.getElementById('stat-pending').closest('.stat-card'),   panelId: 'requests-panel' },
  ];

  statCardsToPanels.forEach(({ card, panelId }) => {
    card.classList.add('stat-card-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => goToPanel(panelId));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goToPanel(panelId);
      }
    });
  });

  function goToPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel.classList.remove('panel-flash');
    // eslint-disable-next-line no-unused-expressions
    void panel.offsetWidth; // restart the animation if it's already running
    panel.classList.add('panel-flash');
    setTimeout(() => panel.classList.remove('panel-flash'), 1200);
  }


  function renderUpcoming() {
    const sorted = upcoming.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const filtered = sorted.filter(matchesFilters);

    upcomingCount.textContent = `${filtered.length} scheduled`;

    if (filtered.length === 0) {
      upcomingList.innerHTML = '';
      upcomingEmpty.classList.remove('hidden');
      upcomingPagination.innerHTML = '';
      return;
    }
    upcomingEmpty.classList.add('hidden');

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (upcomingPage > totalPages) upcomingPage = totalPages;

    const startIdx = (upcomingPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    upcomingList.innerHTML = pageItems.map(b => `
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

    renderPaginationBar(upcomingPagination, filtered.length, upcomingPage, totalPages, startIdx, pageItems.length);
  }


  function renderRequests() {
    const filtered = requests.filter(matchesFilters);

    requestsCount.textContent = `${filtered.length} pending`;

    if (filtered.length === 0) {
      requestsList.innerHTML = '';
      requestsEmpty.classList.remove('hidden');
      requestsPagination.innerHTML = '';
      return;
    }
    requestsEmpty.classList.add('hidden');

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (requestsPage > totalPages) requestsPage = totalPages;

    const startIdx = (requestsPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    requestsList.innerHTML = pageItems.map((r) => `
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

    renderPaginationBar(requestsPagination, filtered.length, requestsPage, totalPages, startIdx, pageItems.length);
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

    if (filtered.length === 0) {
      completedList.innerHTML = '';
      completedPagination.innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (completedPage > totalPages) completedPage = totalPages;

    const startIdx = (completedPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    completedList.innerHTML = pageItems.map(c => `
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

    renderPaginationBar(completedPagination, filtered.length, completedPage, totalPages, startIdx, pageItems.length);
  }


  /* Shared pagination-bar renderer for the three list panels above. */
  function renderPaginationBar(barEl, totalItems, currentPage, totalPages, startIdx, pageCount) {
    if (totalPages <= 1) {
      barEl.innerHTML = `<span class="pagination-info">Showing ${totalItems} of ${totalItems}</span>`;
      return;
    }
    const rangeStart = startIdx + 1;
    const rangeEnd = startIdx + pageCount;
    let pageBtns = '';
    for (let p = 1; p <= totalPages; p++) {
      pageBtns += `<button type="button" class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    barEl.innerHTML = `
      <span class="pagination-info">Showing ${rangeStart}–${rangeEnd} of ${totalItems}</span>
      <div class="pagination-controls">
        <button type="button" class="pagination-btn" data-action="prev" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
        ${pageBtns}
        <button type="button" class="pagination-btn" data-action="next" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
      </div>`;
  }

  upcomingPagination.addEventListener('click', (e) => {
    const btn = e.target.closest('.pagination-btn');
    if (!btn) return;
    if (btn.dataset.action === 'prev') { if (upcomingPage > 1) upcomingPage--; }
    else if (btn.dataset.action === 'next') { upcomingPage++; }
    else if (btn.dataset.page) { upcomingPage = parseInt(btn.dataset.page, 10); }
    renderUpcoming();
  });

  requestsPagination.addEventListener('click', (e) => {
    const btn = e.target.closest('.pagination-btn');
    if (!btn) return;
    if (btn.dataset.action === 'prev') { if (requestsPage > 1) requestsPage--; }
    else if (btn.dataset.action === 'next') { requestsPage++; }
    else if (btn.dataset.page) { requestsPage = parseInt(btn.dataset.page, 10); }
    renderRequests();
  });

  completedPagination.addEventListener('click', (e) => {
    const btn = e.target.closest('.pagination-btn');
    if (!btn) return;
    if (btn.dataset.action === 'prev') { if (completedPage > 1) completedPage--; }
    else if (btn.dataset.action === 'next') { completedPage++; }
    else if (btn.dataset.page) { completedPage = parseInt(btn.dataset.page, 10); }
    renderCompleted();
  });


  /* ------------------------------------------
     CALENDAR VIEW
     Shows scheduled + completed blessings on
     their confirmed date, plus pending requests
     on their preferred date (styled differently
     so it's clear that date isn't confirmed yet).
     Declined records are never shown, matching
     the list panels above.
  ------------------------------------------ */
  let calendarDate = new Date(todayISO + 'T00:00:00');
  let selectedDateIso = null;

  const calMonthLabel = document.getElementById('cal-month-label');
  const calGrid          = document.getElementById('calendar-grid');

  const dayPlanModal = document.getElementById('day-plan-modal');
  const dayPlanTitle   = document.getElementById('day-plan-title');
  const dayPlanList      = document.getElementById('day-plan-list');
  const dayPlanEmpty       = document.getElementById('day-plan-empty');

  const calBadgeClass = { scheduled: 'badge-lavender', pending: 'badge-amber', completed: 'badge-green' };
  const calStatusLabel = { scheduled: 'Scheduled', pending: 'Pending', completed: 'Completed' };

  function isoFromParts(y, m, d) {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  // Merge the three lists into one, each item carrying the date it
  // should appear under on the calendar (confirmed `date` for
  // scheduled/completed, `preferredDate` for pending requests).
  function calendarItems() {
    return [
      ...upcoming.map(b => ({ id: b.id, requesterName: b.requesterName, type: b.type, location: b.location, time: b.time, status: 'scheduled', calDate: b.date })),
      ...requests.map(r => ({ id: r.id, requesterName: r.requesterName, type: r.type, location: r.location, time: r.time, status: 'pending', calDate: r.preferredDate })),
      ...completed.map(c => ({ id: c.id, requesterName: c.requesterName, type: c.type, location: c.location, time: c.time, status: 'completed', calDate: c.date })),
    ].filter(item => item.calDate);
  }

  function renderCalendar() {
    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    calMonthLabel.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const items = calendarItems();

    let cellsHtml = '';
    for (let i = 0; i < startWeekday; i++) cellsHtml += `<div class="calendar-cell empty"></div>`;

    // Shown directly on the cell, no hover/click needed — up to
    // MAX_VISIBLE entries per day, with a "+N more" hint when there
    // isn't room. Clicking anywhere on the cell still opens the full
    // Day Plan modal for every blessing that day.
    const MAX_VISIBLE = 2;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(year, month, day);
      const dayItems = items.filter(item => item.calDate === iso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const isToday = iso === todayISO;
      const isSelected = iso === selectedDateIso;

      const visible = dayItems.slice(0, MAX_VISIBLE);
      const remaining = dayItems.length - visible.length;

      const itemsHtml = visible.map(item => `
        <div class="calendar-cell-booking ${item.status}">
          <span class="calendar-cell-booking-time">${escapeHtml(item.time || '—')}</span>
          <span class="calendar-cell-booking-facility">${escapeHtml(item.requesterName)}</span>
        </div>
      `).join('') + (remaining > 0 ? `<div class="calendar-cell-more">+${remaining} more</div>` : '');

      cellsHtml += `
        <div class="calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${iso}">
          <span class="calendar-date-num">${day}</span>
          <div class="calendar-cell-bookings">${itemsHtml}</div>
        </div>
      `;
    }

    calGrid.innerHTML = cellsHtml;
    calGrid.querySelectorAll('.calendar-cell:not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const iso = cell.dataset.date;
        selectedDateIso = iso;
        renderCalendar();
        openDayPlanModal(iso);
      });
    });
  }

  /* Full "Day Plan" preview — every blessing on the selected date,
     laid out as a timeline so the admin can see the whole day at a
     glance instead of just one entry at a time. */
  function openDayPlanModal(iso) {
    const dayItems = calendarItems().filter(item => item.calDate === iso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const label = new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    dayPlanTitle.textContent = label;

    if (dayItems.length === 0) {
      dayPlanList.innerHTML = '';
      dayPlanList.classList.add('hidden');
      dayPlanEmpty.classList.remove('hidden');
    } else {
      dayPlanList.innerHTML = dayItems.map(item => `
        <div class="day-plan-item">
          <span class="day-plan-item-time">${escapeHtml(item.time || '—')}</span>
          <div class="day-plan-item-body">
            <p class="day-plan-item-facility">${escapeHtml(item.requesterName)}</p>
            <p class="day-plan-item-purpose">${escapeHtml(item.type)}${item.location ? ` · ${escapeHtml(item.location)}` : ''}</p>
          </div>
          <span class="badge ${calBadgeClass[item.status] || 'badge-gray'}">${calStatusLabel[item.status] || item.status}</span>
        </div>
      `).join('');
      dayPlanList.classList.remove('hidden');
      dayPlanEmpty.classList.add('hidden');
    }

    openModal(dayPlanModal);
  }

  document.getElementById('cal-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });


  /* --- View toggle: list panels vs. calendar --- */
  const listViewPanel      = document.getElementById('list-view-panel');
  const calendarViewPanel  = document.getElementById('calendar-view-panel');
  const calendarToggleBtn  = document.getElementById('btn-calendar-view');
  const calendarToggleLabel = document.getElementById('calendar-toggle-label');

  let showingCalendar = false;

  calendarToggleBtn.addEventListener('click', () => {
    showingCalendar = !showingCalendar;
    calendarToggleBtn.setAttribute('aria-pressed', String(showingCalendar));
    calendarToggleLabel.textContent = showingCalendar ? 'List View' : 'Calendar View';
    listViewPanel.classList.toggle('hidden', showingCalendar);
    calendarViewPanel.classList.toggle('hidden', !showingCalendar);
    if (showingCalendar) renderCalendar();
  });


  searchInput.addEventListener('input', () => {
    upcomingPage = 1; requestsPage = 1; completedPage = 1;
    renderUpcoming(); renderRequests(); renderCompleted();
  });
  typeFilter.addEventListener('change', () => {
    upcomingPage = 1; requestsPage = 1; completedPage = 1;
    renderUpcoming(); renderRequests(); renderCompleted();
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    upcomingPage = 1; requestsPage = 1; completedPage = 1;
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
      closeModal(dayPlanModal);
    });
  });

  [scheduleModal, declineModal, detailsModal, dayPlanModal].forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(scheduleModal); closeModal(declineModal); closeModal(detailsModal); closeModal(dayPlanModal); }
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