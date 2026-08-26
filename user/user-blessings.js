/* ============================================
   SacraDigit — User Blessings Scripts (AWS Amplify)
   Runs after user-shell.js.
   Backed by the same Blessing model as the admin
   Blessings page and user-request-service.js /
   user-requested-services.js. Filters client-side
   to blessing-only request types (house, business,
   vehicle) so sacrament/mass requests submitted via
   "Request a Service" don't show up here — those are
   tracked under "Requested Services" instead.
   Read-only: new requests and cancellations happen
   on the Request a Service / Requested Services pages.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = 'Maria P. Santos';
  const todayISO = new Date().toISOString().slice(0, 10);

  // Only these `type` values are "Blessings" — everything else created
  // through the generic Blessing model (Baptism, Wedding, Funeral Mass,
  // First Communion, Anniversary Mass) belongs on Requested Services.
  const BLESSING_TYPES = ['House Blessing', 'Business Dedication', 'Vehicle Blessing', 'Vehicle / Item Blessing', 'Other'];

  let upcoming = [];
  let requests = [];
  let completed = [];
  let declined = [];

  const upcomingList   = document.getElementById('upcoming-list');
  const upcomingEmpty   = document.getElementById('upcoming-empty');
  const upcomingCount   = document.getElementById('upcoming-count');
  const requestsList    = document.getElementById('requests-list');
  const requestsEmpty    = document.getElementById('requests-empty');
  const requestsCount    = document.getElementById('requests-count');
  const completedList    = document.getElementById('completed-list');
  const completedEmpty    = document.getElementById('completed-empty');
  const completedCount    = document.getElementById('completed-count');
  const declinedPanel      = document.getElementById('declined-panel');
  const declinedList         = document.getElementById('declined-list');
  const declinedCount         = document.getElementById('declined-count');

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


  /* --- Live data (own records only) --- */
  client.models.Blessing.observeQuery({ filter: { requesterName: { eq: REQUESTER_NAME } } }).subscribe({
    next: ({ items }) => {
      const mine = items.filter(b => BLESSING_TYPES.includes(b.type));

      upcoming = [];
      requests = [];
      completed = [];
      declined = [];

      mine.forEach(b => {
        if (b.status === 'scheduled') upcoming.push(b);
        else if (b.status === 'pending') requests.push(b);
        else if (b.status === 'completed') completed.push(b);
        else if (b.status === 'declined') declined.push(b);
      });

      renderStats();
      renderUpcoming();
      renderRequests();
      renderCompleted();
      renderDeclined();
      if (showingCalendar) renderCalendar();
      if (selectedDateIso && !dayPlanModal.classList.contains('hidden')) openDayPlanModal(selectedDateIso);
    },
    error: (err) => {
      console.error('Failed to load blessings:', err);
      window.showToast?.("Couldn't load your blessings.", true);
    },
  });


  function renderStats() {
    document.getElementById('stat-scheduled').textContent = upcoming.length;
    document.getElementById('stat-pending').textContent   = requests.length;
    document.getElementById('stat-completed').textContent = completed.length;
  }


  function renderUpcoming() {
    const sorted = upcoming.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    upcomingCount.textContent = `${sorted.length} scheduled`;

    if (sorted.length === 0) {
      upcomingList.innerHTML = '';
      upcomingEmpty.classList.remove('hidden');
      return;
    }
    upcomingEmpty.classList.add('hidden');

    upcomingList.innerHTML = sorted.map(b => `
      <li>
        <div class="blessing-row">
          <div class="blessing-icon">${blessingIconSvg()}</div>
          <div class="blessing-info">
            <p class="blessing-name">${escapeHtml(b.type)}</p>
            <p class="blessing-meta">${escapeHtml(b.location || 'Location to be confirmed')}</p>
          </div>
          <div>
            <div class="blessing-datetime">
              ${formatLongDate(b.date)}<br/>${escapeHtml(b.time || '')}
            </div>
            <button type="button" class="blessing-details-btn" data-section="upcoming" data-id="${b.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join('');
  }


  function renderRequests() {
    requestsCount.textContent = `${requests.length} pending`;

    if (requests.length === 0) {
      requestsList.innerHTML = '';
      requestsEmpty.classList.remove('hidden');
      return;
    }
    requestsEmpty.classList.add('hidden');

    requestsList.innerHTML = requests.map((r) => `
      <li>
        <div class="request-row">
          <div class="request-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="request-info">
            <p class="request-name">${escapeHtml(r.type)}</p>
            <p class="request-meta">Requested for ${formatLongDate(r.preferredDate)}</p>
          </div>
          <button type="button" class="blessing-details-btn" data-section="requests" data-id="${r.id}">Details ›</button>
        </div>
      </li>
    `).join('');
  }


  function renderCompleted() {
    const sorted = completed.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    completedCount.textContent = `${sorted.length} completed`;

    if (sorted.length === 0) {
      completedList.innerHTML = '';
      completedEmpty.classList.remove('hidden');
      return;
    }
    completedEmpty.classList.add('hidden');

    completedList.innerHTML = sorted.map(c => `
      <li>
        <div class="completed-row">
          <div class="completed-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${escapeHtml(c.type)}</p>
            <p class="completed-meta">${escapeHtml(c.location || '')}</p>
          </div>
          <div>
            <div class="completed-date">${formatLongDate(c.date)}</div>
            <button type="button" class="blessing-details-btn" data-section="completed" data-id="${c.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join('');
  }


  function renderDeclined() {
    if (declined.length === 0) {
      declinedPanel.classList.add('hidden');
      declinedList.innerHTML = '';
      return;
    }
    declinedPanel.classList.remove('hidden');
    declinedCount.textContent = `${declined.length} declined`;

    const sorted = declined.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    declinedList.innerHTML = sorted.map(d => `
      <li>
        <div class="completed-row">
          <div class="completed-icon declined">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${escapeHtml(d.type)}</p>
            <p class="completed-meta">${d.declineReason ? escapeHtml(d.declineReason) : 'No reason given'}</p>
          </div>
          <div>
            <button type="button" class="blessing-details-btn" data-section="declined" data-id="${d.id}">Details ›</button>
          </div>
        </div>
      </li>
    `).join('');
  }


  [upcomingList, requestsList, completedList, declinedList].forEach(listEl => {
    listEl.addEventListener('click', (e) => {
      const detailsBtn = e.target.closest('.blessing-details-btn');
      if (!detailsBtn) return;
      openDetailsModal(detailsBtn.dataset.section, detailsBtn.dataset.id);
    });
  });


  /* ------------------------------------------
     CALENDAR VIEW
     Shows this parishioner's scheduled + completed
     blessings on their confirmed date, plus pending
     requests on their preferred date (styled
     differently since that date isn't confirmed yet).
     Declined records are never shown on the calendar.
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

  function calendarItems() {
    return [
      ...upcoming.map(b => ({ id: b.id, type: b.type, location: b.location, time: b.time, status: 'scheduled', calDate: b.date })),
      ...requests.map(r => ({ id: r.id, type: r.type, location: r.location, time: r.time, status: 'pending', calDate: r.preferredDate })),
      ...completed.map(c => ({ id: c.id, type: c.type, location: c.location, time: c.time, status: 'completed', calDate: c.date })),
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
          <span class="calendar-cell-booking-facility">${escapeHtml(item.type)}</span>
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
            <p class="day-plan-item-facility">${escapeHtml(item.type)}</p>
            <p class="day-plan-item-purpose">${escapeHtml(item.location || '')}</p>
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


  /* ------------------------------------------
     BLESSING DETAILS MODAL (read-only)
  ------------------------------------------ */
  const detailsModal = document.getElementById('details-modal');
  const detailsBody   = document.getElementById('details-body');
  const detailsManageLink = document.getElementById('details-manage-link');

  const sectionMeta = {
    upcoming:  { statusLabel: 'Scheduled', dateLabel: 'Date & Time', list: () => upcoming },
    requests:  { statusLabel: 'Pending Approval', dateLabel: 'Preferred Date', list: () => requests },
    completed: { statusLabel: 'Completed', dateLabel: 'Date Completed', list: () => completed },
    declined:  { statusLabel: 'Declined', dateLabel: 'Preferred Date', list: () => declined },
  };

  function openDetailsModal(section, id) {
    const meta = sectionMeta[section];
    if (!meta) return;
    const record = meta.list().find(x => x.id === id);
    if (!record) return;

    let dateValue;
    if (section === 'upcoming') dateValue = `${formatLongDate(record.date)}${record.time ? ` · ${record.time}` : ''}`;
    else if (section === 'completed') dateValue = formatLongDate(record.date);
    else dateValue = formatLongDate(record.preferredDate);

    const extraRows = record.location
      ? `<div><p class="so-detail-label">Location</p><p class="so-detail-value">${escapeHtml(record.location)}</p></div>`
      : '';
    const declineRow = section === 'declined'
      ? `<div class="col-span-2"><p class="so-detail-label">Reason</p><p class="so-detail-value">${escapeHtml(record.declineReason || 'No reason given')}</p></div>`
      : '';

    detailsBody.innerHTML = `
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Blessing Type</p><p class="so-detail-value">${escapeHtml(record.type)}</p></div>
        <div><p class="so-detail-label">Status</p><p class="so-detail-value">${meta.statusLabel}</p></div>
        <div><p class="so-detail-label">${meta.dateLabel}</p><p class="so-detail-value">${dateValue}</p></div>
        ${extraRows}
        ${declineRow}
      </div>
    `;
    // Only a pending request can still be managed (cancelled) elsewhere —
    // scheduled/completed/declined records have nothing left to manage.
    detailsManageLink.classList.toggle('hidden', section !== 'requests');

    openModal(detailsModal);
  }


  /* --- Modal helpers --- */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(detailsModal); closeModal(dayPlanModal); });
  });

  [detailsModal, dayPlanModal].forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(detailsModal); closeModal(dayPlanModal); }
  });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

});