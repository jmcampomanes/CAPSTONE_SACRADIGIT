/* ============================================
   SacraDigit Admin — Masses (Special Masses) Scripts (AWS Amplify)
   Backed by the Mass model.
   Weekly Schedule table stays static reference data —
   it represents a recurring pattern, not individual
   Mass records, so it isn't wired to the database.
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

  let allMasses = []; // kept in sync via observeQuery, each has .id
  let currentDateMasses = []; // sorted masses for the currently selected date

  const weeklySchedule = [
    { day: 'Monday',    times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Tuesday',   times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Wednesday', times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Thursday',  times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Friday',    times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Saturday',  times: ['7:00 AM', '5:30 PM'],            type: 'Anticipated Mass' },
    { day: 'Sunday',    times: ['6:00 AM', '8:00 AM', '10:00 AM', '5:00 PM'], type: 'Sunday Mass' },
  ];

  const datePicker          = document.getElementById('date-picker');
  const scheduleDateLabel     = document.getElementById('schedule-date-label');
  const dateScheduleList      = document.getElementById('date-schedule-list');
  const dateScheduleEmpty     = document.getElementById('date-schedule-empty');
  const specialMassesList      = document.getElementById('special-masses-list');
  const weeklyTbody            = document.getElementById('weekly-tbody');

  datePicker.value = todayISO;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function to24h(timeStr) {
    const [time, meridiem] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  function formatLongDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }


  /* --- Live data --- */
  client.models.Mass.observeQuery().subscribe({
    next: ({ items }) => {
      allMasses = items;
      renderDateSchedule();
      renderSpecialMasses();
      renderStats();
      if (showingCalendar) renderCalendar();
      // Keep an open Day Plan modal in sync with live updates.
      if (selectedDateIso && !dayPlanModal.classList.contains('hidden')) openDayPlanModal(selectedDateIso);
    },
    error: (err) => {
      console.error('Failed to load masses:', err);
      dateScheduleList.innerHTML = `<li class="text-sm text-red-500 py-4">Couldn't load masses.</li>`;
    },
  });


  /* --- Date's Schedule --- */
  function renderDateSchedule() {
    const iso = datePicker.value;
    const masses = allMasses.filter(m => m.date === iso);

    scheduleDateLabel.textContent = formatLongDate(iso);
    dateScheduleList.innerHTML = '';

    if (masses.length === 0) {
      currentDateMasses = [];
      dateScheduleEmpty.classList.remove('hidden');
      return;
    }
    dateScheduleEmpty.classList.add('hidden');

    currentDateMasses = masses.slice().sort((a, b) => to24h(a.time) - to24h(b.time));

    currentDateMasses.forEach((m, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="schedule-row">
          <span class="schedule-time">${escapeHtml(m.time)}</span>
          <div class="schedule-info">
            <p class="schedule-type">${escapeHtml(m.title || m.type)}</p>
            ${m.note ? `<p class="schedule-note">${escapeHtml(m.note)}</p>` : ''}
          </div>
          ${m.isSpecial ? '<span class="schedule-special-tag">Special</span>' : ''}
          <button type="button" class="schedule-details-btn" data-index="${idx}">See Full Details ›</button>
        </div>
      `;
      dateScheduleList.appendChild(li);
    });
  }

  datePicker.addEventListener('change', renderDateSchedule);

  dateScheduleList.addEventListener('click', (e) => {
    const btn = e.target.closest('.schedule-details-btn');
    if (!btn) return;
    openMassDetailsModal(parseInt(btn.dataset.index, 10));
  });


  /* --- Upcoming Special Masses --- */
  function renderSpecialMasses() {
    const today = new Date(todayISO + 'T00:00:00');

    const upcoming = allMasses
      .filter(m => m.isSpecial && new Date(m.date + 'T00:00:00') >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    specialMassesList.innerHTML = upcoming.map(m => `
      <li>
        <div class="special-row">
          <div class="special-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
          </div>
          <div class="special-info">
            <p class="special-name">${escapeHtml(m.title || m.note)}</p>
            <p class="special-date">${formatLongDate(m.date)}</p>
          </div>
        </div>
      </li>
    `).join('');
  }


  /* --- Stat cards (this week's totals) --- */
  const statMassesWeekEl  = document.getElementById('stat-masses-week');
  const statSpecialWeekEl = document.getElementById('stat-special-week');

  function renderStats() {
    const weekStart = new Date(todayISO + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndISO = toLocalISODate(weekEnd);

    const thisWeek = allMasses.filter(m => m.date >= todayISO && m.date < weekEndISO);

    statMassesWeekEl.textContent = thisWeek.length;
    statSpecialWeekEl.textContent = thisWeek.filter(m => m.isSpecial === true).length;
  }

  const statSpecialCard = statSpecialWeekEl.closest('.stat-card');
  statSpecialCard.classList.add('stat-card-clickable');
  statSpecialCard.setAttribute('role', 'button');
  statSpecialCard.setAttribute('tabindex', '0');
  statSpecialCard.addEventListener('click', () => {
    window.location.href = 'special-schedules.html';
  });
  statSpecialCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = 'special-schedules.html';
    }
  });


  /* --- Regular Weekly Mass Schedule (static reference) --- */
  function renderWeeklySchedule() {
    weeklyTbody.innerHTML = weeklySchedule.map((w, idx) => `
      <tr>
        <td class="day-cell">${escapeHtml(w.day)}</td>
        <td>${w.times.map(t => `<span class="time-pill">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${escapeHtml(w.type)}</td>
        <td class="text-right"><button type="button" class="row-action" data-day-index="${idx}">Edit ›</button></td>
      </tr>
    `).join('');
  }

  weeklyTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-action');
    if (btn) {
      const idx = parseInt(btn.dataset.dayIndex, 10);
      showToast(`Editing ${weeklySchedule[idx].day}'s schedule… (not yet wired to a form)`);
    }
  });

  renderWeeklySchedule();


  /* ------------------------------------------
     CALENDAR VIEW
     Every Mass record is pinned to its own
     confirmed date/time — regular masses and
     special masses (isSpecial) are styled
     differently so admins can spot feast days
     and novenas at a glance.
  ------------------------------------------ */
  let calendarDate = new Date(todayISO + 'T00:00:00');
  let selectedDateIso = null;

  const calMonthLabel = document.getElementById('cal-month-label');
  const calGrid          = document.getElementById('calendar-grid');

  const dayPlanModal = document.getElementById('day-plan-modal');
  const dayPlanTitle   = document.getElementById('day-plan-title');
  const dayPlanList      = document.getElementById('day-plan-list');
  const dayPlanEmpty       = document.getElementById('day-plan-empty');

  function isoFromParts(y, m, d) {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  function calendarItems() {
    return allMasses.map(m => ({
      id: m.id,
      title: m.title || m.type,
      type: m.type,
      time: m.time,
      note: m.note,
      isSpecial: !!m.isSpecial,
      calDate: m.date,
    })).filter(item => item.calDate);
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
      const dayItems = items.filter(item => item.calDate === iso).sort((a, b) => to24h(a.time) - to24h(b.time));
      const isToday = iso === todayISO;
      const isSelected = iso === selectedDateIso;

      const visible = dayItems.slice(0, MAX_VISIBLE);
      const remaining = dayItems.length - visible.length;

      const itemsHtml = visible.map(item => `
        <div class="calendar-cell-booking ${item.isSpecial ? 'special' : ''}">
          <span class="calendar-cell-booking-time">${escapeHtml(item.time || '—')}</span>
          <span class="calendar-cell-booking-facility">${escapeHtml(item.title)}</span>
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
    const dayItems = calendarItems().filter(item => item.calDate === iso).sort((a, b) => to24h(a.time) - to24h(b.time));
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
            <p class="day-plan-item-facility">${escapeHtml(item.title)}</p>
            <p class="day-plan-item-purpose">${escapeHtml(item.type)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</p>
          </div>
          ${item.isSpecial ? '<span class="badge badge-amber">Special</span>' : ''}
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


  /* --- Print --- */
  document.getElementById('btn-print').addEventListener('click', () => window.print());


  /* --- Schedule Mass Modal --- */
  const scheduleModal = document.getElementById('schedule-modal');

  document.getElementById('btn-schedule-mass').addEventListener('click', () => {
    document.getElementById('schedule-date').value = datePicker.value;
    openModal(scheduleModal);
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { const overlay = btn.closest('.modal-overlay'); if (overlay) closeModal(overlay); });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(closeModal); });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

  document.getElementById('schedule-submit').addEventListener('click', async () => {
    const date    = document.getElementById('schedule-date').value;
    const time24  = document.getElementById('schedule-time').value;
    const type    = document.getElementById('schedule-type').value;
    const note     = document.getElementById('schedule-note').value.trim();
    const isSpecial = document.getElementById('schedule-special').checked;

    if (!date || !time24 || !type) {
      showToast('Please fill in date, time, and mass type.', true);
      return;
    }

    const time12 = formatTime12(time24);

    try {
      const result = await client.models.Mass.create({
        date,
        time: time12,
        type,
        title: isSpecial ? (note || type) : type,
        note: note || undefined,
        isSpecial,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      datePicker.value = date;
      renderDateSchedule();

      closeModal(scheduleModal);
      showToast(`Mass scheduled for ${formatShortDate(date)} at ${time12}.`);

      document.getElementById('schedule-time').value = '';
      document.getElementById('schedule-type').value = '';
      document.getElementById('schedule-note').value = '';
      document.getElementById('schedule-special').checked = false;
    } catch (err) {
      console.error('Failed to schedule mass:', err);
      showToast(err.message || "Couldn't schedule the mass.", true);
    }
  });

  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* --- Mass Details Modal --- */
  const massDetailsModal = document.getElementById('mass-details-modal');
  const massDetailsBody   = document.getElementById('mass-details-body');

  function openMassDetailsModal(idx) {
    const m = currentDateMasses[idx];
    if (!m) return;

    massDetailsBody.innerHTML = `
      <div class="so-detail-grid">
        <div>
          <p class="so-detail-label">Date</p>
          <p class="so-detail-value">${escapeHtml(formatLongDate(datePicker.value))}</p>
        </div>
        <div>
          <p class="so-detail-label">Time</p>
          <p class="so-detail-value">${escapeHtml(m.time)}</p>
        </div>
        <div>
          <p class="so-detail-label">Mass Type</p>
          <p class="so-detail-value">${escapeHtml(m.type)}</p>
        </div>
        <div>
          <p class="so-detail-label">Special Mass</p>
          <p class="so-detail-value">${m.isSpecial ? 'Yes' : 'No'}</p>
        </div>
      </div>
      <div class="mt-3">
        <p class="so-detail-label">Intention / Note</p>
        <p class="so-detail-value">${m.note ? escapeHtml(m.note) : '—'}</p>
      </div>
    `;

    openModal(massDetailsModal);
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