/* ============================================
   SacraDigit Admin — Special Schedules Scripts (AWS Amplify)
   Backed by the SpecialSchedule model.
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

  let schedules = []; // kept in sync via observeQuery, each has .id

  const grid           = document.getElementById('schedules-grid');
  const schedulesEmpty  = document.getElementById('schedules-empty');
  const schedulesCount  = document.getElementById('schedules-count');

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

  const typeClassMap = {
    'Liturgical Season': 'liturgical',
    'Novena':            'novena',
    'Feast Day Series':  'feast',
    'Special Event':     'special',
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
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

  function parseDate(iso) {
    return new Date(iso + 'T00:00:00');
  }

  function formatDisplayDate(iso) {
    return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function progressPercent(startIso, endIso) {
    const today  = parseDate(todayISO).getTime();
    const start  = parseDate(startIso).getTime();
    const end    = parseDate(endIso).getTime();
    if (today <= start) return 0;
    if (today >= end)   return 100;
    return Math.round(((today - start) / (end - start)) * 100);
  }

  function durationLabel(startIso, endIso) {
    const start = parseDate(startIso);
    const end   = parseDate(endIso);
    const today = parseDate(todayISO);
    const totalDays = Math.round((end - start) / 86400000) + 1;

    if (today < start) {
      const daysUntil = Math.round((start - today) / 86400000);
      return `Starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    }
    if (today > end) return 'Completed';
    const daysPassed = Math.round((today - start) / 86400000) + 1;
    return `Day ${daysPassed} of ${totalDays}`;
  }


  /* --- Live data --- */
  if (!client.models.SpecialSchedule) {
    console.error('SpecialSchedule model is missing from the deployed backend schema (amplify_outputs.json). Special Schedules cannot load, save, or delete until this model is added to the backend.');

    schedulesCount.textContent = '';
    grid.innerHTML = '';
    schedulesEmpty.innerHTML = `
      <svg class="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      <p class="text-sm font-medium text-gray-600">Special Schedules isn't connected to a database table yet</p>
      <p class="text-xs text-gray-400 mt-1">The SpecialSchedule model is missing from the backend schema — check with the developer before this feature can be used.</p>
    `;
    schedulesEmpty.classList.remove('hidden');

    const addBtn = document.getElementById('btn-add-schedule');
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.classList.add('opacity-50', 'cursor-not-allowed');
      addBtn.title = "Special Schedules isn't connected to a database table yet.";
    }
    calendarToggleBtn.disabled = true;
    calendarToggleBtn.classList.add('opacity-50', 'cursor-not-allowed');
    calendarToggleBtn.title = "Special Schedules isn't connected to a database table yet.";

    return;
  }

  client.models.SpecialSchedule.observeQuery().subscribe({
    next: ({ items }) => {
      schedules = items;
      renderGrid();
      if (showingCalendar) renderCalendar();
      if (selectedDateIso && !dayPlanModal.classList.contains('hidden')) openDayPlanModal(selectedDateIso);
    },
    error: (err) => {
      console.error('Failed to load schedules:', err);
      grid.innerHTML = '';
      schedulesEmpty.classList.remove('hidden');
    },
  });


  function renderGrid() {
    const sorted = schedules.slice().sort((a, b) => {
      if (a.status === 'Ongoing' && b.status !== 'Ongoing') return -1;
      if (b.status === 'Ongoing' && a.status !== 'Ongoing') return 1;
      return parseDate(a.startDate) - parseDate(b.startDate);
    });

    schedulesCount.textContent = `${sorted.length} schedule${sorted.length === 1 ? '' : 's'}`;

    if (sorted.length === 0) {
      grid.innerHTML = '';
      schedulesEmpty.classList.remove('hidden');
      return;
    }
    schedulesEmpty.classList.add('hidden');

    grid.innerHTML = sorted.map((s) => {
      const typeClass = typeClassMap[s.type] || 'special';
      const progress   = progressPercent(s.startDate, s.endDate);
      const durLabel    = durationLabel(s.startDate, s.endDate);

      return `
        <div class="schedule-card ${typeClass}">
          <div class="schedule-card-body">
            <div class="schedule-card-top">
              <p class="schedule-name">${escapeHtml(s.name)}</p>
              <span class="status-tag ${(s.status || '').toLowerCase()}">${escapeHtml(s.status)}</span>
            </div>
            <div>
              <span class="type-tag ${typeClass}">${escapeHtml(s.type)}</span>
            </div>
            <div class="schedule-date-bar">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${formatDisplayDate(s.startDate)} – ${formatDisplayDate(s.endDate)}
            </div>
            <p class="schedule-note">${escapeHtml(s.note)}</p>
          </div>
          <div class="schedule-card-footer">
            <div class="duration-bar-wrap">
              <p class="duration-bar-label">${durLabel}</p>
              <div class="duration-bar-track">
                <div class="duration-bar-fill" style="width: ${progress}%"></div>
              </div>
            </div>
            <div class="schedule-actions">
              <button type="button" class="sched-edit" data-id="${s.id}">Edit</button>
              <button type="button" class="sched-delete" data-id="${s.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  grid.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.sched-edit');
    const deleteBtn  = e.target.closest('.sched-delete');

    if (editBtn) openEditModal(editBtn.dataset.id);
    if (deleteBtn) openDeleteModal(deleteBtn.dataset.id);
  });


  /* ------------------------------------------
     CALENDAR VIEW
     Each schedule spans a date range (start–end),
     unlike the single-date events on other
     calendars in the app — so instead of pinning
     one item to one day, a schedule shows up on
     every day within its range (per the chosen
     display style), styled by its type just like
     the card grid above.
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

  // Date strings compare correctly lexicographically (YYYY-MM-DD), so
  // this containment check doesn't need to parse into Date objects.
  function schedulesActiveOn(iso) {
    return schedules.filter(s => s.startDate <= iso && s.endDate >= iso);
  }

  function renderCalendar() {
    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    calMonthLabel.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cellsHtml = '';
    for (let i = 0; i < startWeekday; i++) cellsHtml += `<div class="calendar-cell empty"></div>`;

    const MAX_VISIBLE = 2;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(year, month, day);
      const dayItems = schedulesActiveOn(iso).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const isToday = iso === todayISO;
      const isSelected = iso === selectedDateIso;

      const visible = dayItems.slice(0, MAX_VISIBLE);
      const remaining = dayItems.length - visible.length;

      const itemsHtml = visible.map(s => `
        <div class="calendar-cell-booking ${typeClassMap[s.type] || 'special'}">
          <span class="calendar-cell-booking-facility">${escapeHtml(s.name)}</span>
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
    const dayItems = schedulesActiveOn(iso).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const label = new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    dayPlanTitle.textContent = label;

    if (dayItems.length === 0) {
      dayPlanList.innerHTML = '';
      dayPlanList.classList.add('hidden');
      dayPlanEmpty.classList.remove('hidden');
    } else {
      dayPlanList.innerHTML = dayItems.map(s => `
        <div class="day-plan-item">
          <span class="day-plan-item-time">${durationLabel(s.startDate, s.endDate)}</span>
          <div class="day-plan-item-body">
            <p class="day-plan-item-facility">${escapeHtml(s.name)}</p>
            <p class="day-plan-item-purpose">${escapeHtml(s.type)} · ${formatDisplayDate(s.startDate)} – ${formatDisplayDate(s.endDate)}</p>
          </div>
          <span class="status-tag ${(s.status || '').toLowerCase()}">${escapeHtml(s.status)}</span>
        </div>
      `).join('');
      dayPlanList.classList.remove('hidden');
      dayPlanEmpty.classList.add('hidden');
    }

    openModal(dayPlanModal);
  }

  document.getElementById('cal-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });


  /* --- Add/Edit Schedule Modal --- */
  const modal       = document.getElementById('schedule-modal');
  const modalTitle   = document.getElementById('schedule-modal-title');
  const submitBtn     = document.getElementById('sched-submit');
  const nameInput      = document.getElementById('sched-name');
  const typeSelect      = document.getElementById('sched-type');
  const statusSelect    = document.getElementById('sched-status');
  const startInput       = document.getElementById('sched-start');
  const endInput         = document.getElementById('sched-end');
  const noteInput         = document.getElementById('sched-note');

  let editTargetId = null;

  document.getElementById('btn-add-schedule').addEventListener('click', () => {
    editTargetId = null;
    modalTitle.textContent = 'Add Special Schedule';
    submitBtn.textContent = 'Save Schedule';
    nameInput.value = '';
    typeSelect.value = 'Liturgical Season';
    statusSelect.value = 'Upcoming';
    startInput.value = '';
    endInput.value = '';
    noteInput.value = '';
    [nameInput, startInput, endInput].forEach(clearFieldError);
    openModal(modal);
  });

  function openEditModal(id) {
    const s = schedules.find(x => x.id === id);
    if (!s) return;
    editTargetId = id;
    modalTitle.textContent = 'Edit Special Schedule';
    submitBtn.textContent = 'Save Changes';
    nameInput.value = s.name;
    typeSelect.value = s.type;
    statusSelect.value = s.status;
    startInput.value = s.startDate;
    endInput.value = s.endDate;
    noteInput.value = s.note;
    [nameInput, startInput, endInput].forEach(clearFieldError);
    openModal(modal);
  }

  [nameInput, startInput, endInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  submitBtn.addEventListener('click', async () => {
    const name   = nameInput.value.trim();
    const type    = typeSelect.value;
    const status   = statusSelect.value;
    const start    = startInput.value;
    const end      = endInput.value;
    const note     = noteInput.value.trim();

    [nameInput, startInput, endInput].forEach(clearFieldError);

    let hasError = false;
    if (!name)  { setFieldError(nameInput, 'Event or season name is required.'); hasError = true; }
    if (!start) { setFieldError(startInput, 'Start date is required.'); hasError = true; }
    if (!end)   { setFieldError(endInput, 'End date is required.'); hasError = true; }

    if (!hasError && parseDate(start) > parseDate(end)) {
      setFieldError(endInput, 'End date must be on or after the start date.');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    try {
      if (editTargetId !== null) {
        const result = await client.models.SpecialSchedule.update({
          id: editTargetId, name, type, status, startDate: start, endDate: end, note,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${name}" updated.`);
      } else {
        const result = await client.models.SpecialSchedule.create({
          name, type, status, startDate: start, endDate: end, note,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${name}" added.`);
      }
      closeModal(modal);
    } catch (err) {
      console.error('Failed to save schedule:', err);
      showToast(err.message || "Couldn't save the schedule.", true);
    }
  });


  /* --- Delete Confirmation Modal --- */
  const deleteModal      = document.getElementById('delete-modal');
  const deleteTargetName  = document.getElementById('delete-target-name');
  let deleteTargetId = null;

  function openDeleteModal(id) {
    const s = schedules.find(x => x.id === id);
    if (!s) return;
    deleteTargetId = id;
    deleteTargetName.textContent = s.name;
    openModal(deleteModal);
  }

  document.getElementById('delete-confirm-submit').addEventListener('click', async () => {
    if (deleteTargetId === null) return;
    const s = schedules.find(x => x.id === deleteTargetId);

    try {
      const result = await client.models.SpecialSchedule.delete({ id: deleteTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(deleteModal);
      showToast(`"${s ? s.name : 'Schedule'}" removed.`);
      deleteTargetId = null;
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      showToast(err.message || "Couldn't delete the schedule.", true);
    }
  });


  /* --- Modal helpers --- */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(modal); closeModal(deleteModal); closeModal(dayPlanModal); });
  });

  [modal, deleteModal, dayPlanModal].forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(modal); closeModal(deleteModal); closeModal(dayPlanModal); }
  });

  function openModal(m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) { if (m.classList.contains('hidden')) return; m.classList.add('hidden'); document.body.style.overflow = ''; }


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