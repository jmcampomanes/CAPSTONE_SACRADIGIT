/* ============================================
   SacraDigit Admin — Facility Booking Scripts (AWS Amplify)
   Backed by the FacilityBooking model.
   facilityName/purpose/date/startTime/status map
   directly; "Cancel" deletes the record (matching
   the original splice-out behavior) rather than
   using the 'declined' status, since declined is
   meant for requests never approved in the first place.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  const facilities = [
    'Parish Hall',
    'Adoration Chapel',
    'Catechetical Room A',
    'Catechetical Room B',
    'Multi-Purpose Hall',
  ];

  let bookings = []; // kept in sync via observeQuery, each has .id

  const tbody          = document.getElementById('bookings-tbody');
  const bookingsEmpty   = document.getElementById('bookings-empty');
  const bookingsCount   = document.getElementById('bookings-count');

  const badgeClass = { pending: 'badge-amber', approved: 'badge-green' };
  const statusLabel = { pending: 'Pending', approved: 'Approved' };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Bookings created before end time was added won't have one — fall
  // back to just the start time rather than showing "9:00 AM – ".
  function formatTimeRange(b) {
    if (!b.startTime) return '—';
    return b.endTime ? `${b.startTime} – ${b.endTime}` : b.startTime;
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

  // Auto-scroll helpers for the New Booking wizard — once a question is
  // answered, bring the next one into view so the admin doesn't have to
  // scroll the modal manually. block:'start' is relative to the modal
  // card itself, since that's the nearest scrollable ancestor.
  function scrollToQuestion(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToBookingFooter() {
    const footer = bookingModal.querySelector('.modal-footer');
    if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }


  /* --- Live data --- */
  client.models.FacilityBooking.observeQuery().subscribe({
    next: ({ items }) => {
      bookings = items;
      renderAll();
    },
    error: (err) => {
      console.error('Failed to load bookings:', err);
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 text-sm py-8">Couldn't load bookings.</td></tr>`;
    },
  });


  function renderStats() {
    const weekStart = new Date(todayISO + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const thisWeekCount = bookings.filter(b => {
      const d = new Date(b.date + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    }).length;

    document.getElementById('stat-total-week').textContent = thisWeekCount;
    document.getElementById('stat-facilities').textContent = facilities.length;
    document.getElementById('stat-pending').textContent = bookings.filter(b => b.status === 'pending').length;
  }


  function renderTable() {
    const sorted = bookings.slice().sort((a, b) => new Date(a.date + ' ' + a.startTime) - new Date(b.date + ' ' + b.startTime));

    bookingsCount.textContent = `${sorted.length} booking${sorted.length === 1 ? '' : 's'}`;

    if (sorted.length === 0) {
      tbody.innerHTML = '';
      bookingsEmpty.classList.remove('hidden');
      return;
    }
    bookingsEmpty.classList.add('hidden');

    tbody.innerHTML = sorted.map((b) => {
      let actionsHtml = '';
      if (b.status === 'pending') {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-approve" data-id="${b.id}">Approve</button>
            <button type="button" class="row-reject" data-id="${b.id}">Cancel</button>
            <button type="button" class="row-view" data-id="${b.id}">View</button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-reject" data-id="${b.id}">Cancel</button>
            <button type="button" class="row-view" data-id="${b.id}">View</button>
          </div>`;
      }

      return `
        <tr>
          <td class="font-medium text-gray-900">${escapeHtml(b.facilityName)}</td>
          <td>${formatShortDate(b.date)}</td>
          <td>${escapeHtml(formatTimeRange(b))}</td>
          <td><span class="badge ${badgeClass[b.status] || 'badge-gray'}">${statusLabel[b.status] || b.status}</span></td>
          <td class="text-right">${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  }

  tbody.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('.row-approve');
    const cancelBtn  = e.target.closest('.row-reject');
    const viewBtn    = e.target.closest('.row-view');

    if (approveBtn) {
      const b = bookings.find(x => x.id === approveBtn.dataset.id);
      try {
        const result = await client.models.FacilityBooking.update({ id: approveBtn.dataset.id, status: 'approved' });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`Booking for ${b ? b.facilityName : 'facility'} approved.`);
      } catch (err) {
        console.error('Failed to approve:', err);
        showToast(err.message || "Couldn't approve booking.", true);
      }
    }

    if (cancelBtn) openCancelModal(cancelBtn.dataset.id);
    if (viewBtn) openDetailsModal(viewBtn.dataset.id);
  });


  /* --- Cancel confirmation modal --- */
  const cancelModal      = document.getElementById('cancel-modal');
  const cancelTargetName  = document.getElementById('cancel-target-name');
  let cancelTargetId = null;

  function openCancelModal(id) {
    cancelTargetId = id;
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    cancelTargetName.textContent = `${b.facilityName} — ${formatShortDate(b.date)}, ${b.startTime}`;
    openModal(cancelModal);
  }

  document.getElementById('cancel-confirm-submit').addEventListener('click', async () => {
    if (cancelTargetId === null) return;
    const removed = bookings.find(x => x.id === cancelTargetId);
    try {
      const result = await client.models.FacilityBooking.delete({ id: cancelTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(cancelModal);
      showToast(`Booking for ${removed ? removed.facilityName : 'facility'} cancelled.`);
      cancelTargetId = null;
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      showToast(err.message || "Couldn't cancel booking.", true);
    }
  });


  /* --- Booking details modal --- */
  const detailsModal        = document.getElementById('details-modal');
  const detailsFacility     = document.getElementById('details-facility');
  const detailsStatusBadge  = document.getElementById('details-status-badge');
  const detailsDate         = document.getElementById('details-date');
  const detailsTime         = document.getElementById('details-time');
  const detailsPurpose      = document.getElementById('details-purpose');

  function openDetailsModal(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;

    detailsFacility.textContent = b.facilityName;
    detailsDate.textContent = formatShortDate(b.date);
    detailsTime.textContent = formatTimeRange(b);
    detailsPurpose.textContent = b.purpose || '—';

    detailsStatusBadge.textContent = statusLabel[b.status] || b.status;
    detailsStatusBadge.className = `badge ${badgeClass[b.status] || 'badge-gray'}`;

    openModal(detailsModal);
  }


  /* --- Calendar view --- */
  let calendarDate = new Date(todayISO + 'T00:00:00');
  let selectedDateIso = null;

  const calMonthLabel  = document.getElementById('cal-month-label');
  const calGrid         = document.getElementById('calendar-grid');

  const dayPlanModal  = document.getElementById('day-plan-modal');
  const dayPlanTitle    = document.getElementById('day-plan-title');
  const dayPlanList       = document.getElementById('day-plan-list');
  const dayPlanEmpty        = document.getElementById('day-plan-empty');

  function isoFromParts(y, m, d) {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
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

    // Shown directly on the cell, no hover/click needed — up to
    // MAX_VISIBLE bookings per day, chronological, with a "+N more"
    // hint when there isn't room. Clicking anywhere on the cell still
    // opens the full Day Plan modal for every booking that day.
    const MAX_VISIBLE = 2;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(year, month, day);
      const dayBookings = bookings.filter(b => b.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime));
      const isToday = iso === todayISO;
      const isSelected = iso === selectedDateIso;

      const visible = dayBookings.slice(0, MAX_VISIBLE);
      const remaining = dayBookings.length - visible.length;

      const bookingsHtml = visible.map(b => `
        <div class="calendar-cell-booking ${b.status === 'pending' ? 'pending' : ''}">
          <span class="calendar-cell-booking-time">${escapeHtml(formatTimeRange(b))}</span>
          <span class="calendar-cell-booking-facility">${escapeHtml(b.facilityName)}</span>
        </div>
      `).join('') + (remaining > 0 ? `<div class="calendar-cell-more">+${remaining} more</div>` : '');

      cellsHtml += `
        <div class="calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${iso}">
          <span class="calendar-date-num">${day}</span>
          <div class="calendar-cell-bookings">${bookingsHtml}</div>
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

  /* Full "Day Plan" preview — every booking on the selected date,
     laid out as a chronological timeline so the admin can see the
     whole day at a glance instead of just one booking at a time. */
  function openDayPlanModal(iso) {
    const dayBookings = bookings.filter(b => b.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const label = new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    dayPlanTitle.textContent = label;

    if (dayBookings.length === 0) {
      dayPlanList.innerHTML = '';
      dayPlanList.classList.add('hidden');
      dayPlanEmpty.classList.remove('hidden');
    } else {
      dayPlanList.innerHTML = dayBookings.map(b => `
        <div class="day-plan-item">
          <span class="day-plan-item-time">${escapeHtml(formatTimeRange(b))}</span>
          <div class="day-plan-item-body">
            <p class="day-plan-item-facility">${escapeHtml(b.facilityName)}</p>
            <p class="day-plan-item-purpose">${escapeHtml(b.purpose)}</p>
          </div>
          <span class="badge ${badgeClass[b.status] || 'badge-gray'}">${statusLabel[b.status] || b.status}</span>
        </div>
      `).join('');
      dayPlanList.classList.remove('hidden');
      dayPlanEmpty.classList.add('hidden');
    }

    openModal(dayPlanModal);
  }

  document.getElementById('cal-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });


  /* --- View toggle --- */
  const tableViewPanel    = document.getElementById('table-view-panel');
  const calendarViewPanel  = document.getElementById('calendar-view-panel');
  const calendarToggleBtn  = document.getElementById('btn-calendar-view');
  const calendarToggleLabel = document.getElementById('calendar-toggle-label');

  let showingCalendar = false;

  calendarToggleBtn.addEventListener('click', () => {
    showingCalendar = !showingCalendar;
    calendarToggleBtn.setAttribute('aria-pressed', String(showingCalendar));
    calendarToggleLabel.textContent = showingCalendar ? 'Table View' : 'Calendar View';
    tableViewPanel.classList.toggle('hidden', showingCalendar);
    calendarViewPanel.classList.toggle('hidden', !showingCalendar);
    if (showingCalendar) renderCalendar();
  });


  function renderAll() {
    renderStats();
    renderTable();
    if (showingCalendar) renderCalendar();
    // Keep an open Day Plan modal in sync with live updates (e.g. another
    // admin approving/cancelling a booking while it's on screen).
    if (selectedDateIso && !dayPlanModal.classList.contains('hidden')) openDayPlanModal(selectedDateIso);
    // Same for an open New Booking modal — another admin's booking could
    // change which hours/days are still available while this one is open.
    if (!bookingModal.classList.contains('hidden')) { renderBkCalendar(); renderBkTimeSlots(); }
  }


  /* --- New booking modal --- */
  const bookingModal       = document.getElementById('booking-modal');
  const bookingFacilitySelect = document.getElementById('booking-facility');

  bookingFacilitySelect.innerHTML = facilities.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');

  const bookingPurposeInput = document.getElementById('booking-purpose');

  /* --- Booking date + time picker ---
     Facilities are booked in whole-hour blocks between 8:00 AM and
     7:00 PM, for 1–5 hours at a time. The calendar marks a day "Fully
     Booked" (for the currently-selected facility) once every hour in
     that window is already covered by an existing booking; otherwise
     it's "Available". Picking a date shows which hourly slots are
     still open, and duration options are limited to whatever fits
     without hitting 7:00 PM or an already-booked hour. */
  const BOOKING_DAY_START = 8;  // 8:00 AM
  const BOOKING_DAY_END   = 19; // 7:00 PM
  const BOOKING_MIN_HOURS = 1;
  const BOOKING_MAX_HOURS = 5;

  function parseTimeToMinutes(time12) {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time12 || '').trim());
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    const mer = m[3].toUpperCase();
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60 + mins;
  }

  function formatHourLabel(hour) {
    const h = ((hour + 11) % 12) + 1;
    const mer = hour < 12 ? 'AM' : 'PM';
    return `${h}:00 ${mer}`;
  }

  // Every hour in [BOOKING_DAY_START, BOOKING_DAY_END) already touched
  // by an existing booking for this facility on this date. Bookings
  // made before hourly slots existed may fall mid-hour — those still
  // block the whole hour(s) they overlap.
  function getBookedHours(facility, iso) {
    const blocked = new Set();
    bookings.filter(b => b.facilityName === facility && b.date === iso).forEach(b => {
      const startMin = parseTimeToMinutes(b.startTime);
      if (startMin === null) return;
      const endMin = b.endTime ? parseTimeToMinutes(b.endTime) : startMin + 60;
      const startHour = Math.floor(startMin / 60);
      const endHourExclusive = Math.ceil(endMin / 60);
      for (let h = startHour; h < endHourExclusive; h++) blocked.add(h);
    });
    return blocked;
  }

  function isDayFullyBooked(facility, iso) {
    const blocked = getBookedHours(facility, iso);
    for (let h = BOOKING_DAY_START; h < BOOKING_DAY_END; h++) {
      if (!blocked.has(h)) return false;
    }
    return true;
  }

  function isoFromPartsBk(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  let bkCalDate          = new Date(todayISO + 'T00:00:00');
  let bkSelectedDateIso   = null;
  let bkSelectedStartHour  = null;

  const bkCalGrid        = document.getElementById('bkcal-grid');
  const bkCalMonthLabel   = document.getElementById('bkcal-month-label');
  const bkTimeSlots         = document.getElementById('bktime-slots');
  const bkTimeHint            = document.getElementById('bktime-hint');
  const bkDurationSelect         = document.getElementById('booking-duration');

  // Duration is picked before start time — the range of valid start
  // times (and which of them are actually free) depends on how long
  // the booking runs, so asking for duration first keeps the time
  // list from changing shape underneath the admin as they pick.
  bkDurationSelect.innerHTML = Array.from({ length: BOOKING_MAX_HOURS - BOOKING_MIN_HOURS + 1 }, (_, i) => BOOKING_MIN_HOURS + i)
    .map(dur => `<option value="${dur}">${dur} hour${dur === 1 ? '' : 's'}</option>`).join('');
  bkDurationSelect.value = String(BOOKING_MIN_HOURS);

  function renderBkCalendar() {
    const year  = bkCalDate.getFullYear();
    const month = bkCalDate.getMonth();
    bkCalMonthLabel.textContent = bkCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const facility = bookingFacilitySelect.value;

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += `<span class="bkcal-day empty"></span>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromPartsBk(year, month, day);
      const isPast = iso < todayISO;
      const isToday = iso === todayISO;
      const isSelected = iso === bkSelectedDateIso;
      const full = facility ? isDayFullyBooked(facility, iso) : false;

      html += `
        <button type="button" class="bkcal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${facility ? (full ? 'full' : 'available') : ''}" data-date="${iso}" ${isPast ? 'disabled' : ''}>${day}</button>
      `;
    }

    bkCalGrid.innerHTML = html;
    bkCalGrid.querySelectorAll('.bkcal-day[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        bkSelectedDateIso = cell.dataset.date;
        bkSelectedStartHour = null;
        document.getElementById('bkcal-wrap').classList.remove('has-error');
        renderBkCalendar();
        renderBkTimeSlots();
        // Date is the last question on this step — bring the footer's
        // Next button into view rather than a nonexistent "next" field.
        scrollToBookingFooter();
      });
    });
  }

  function renderBkTimeSlots() {
    const facility = bookingFacilitySelect.value;

    if (!facility || !bkSelectedDateIso) {
      bkTimeSlots.innerHTML = '';
      bkTimeHint.textContent = 'Select a facility and date to see available times.';
      bkTimeHint.classList.remove('hidden');
      return;
    }

    bkTimeHint.classList.add('hidden');
    const duration = parseInt(bkDurationSelect.value, 10);
    const blocked = getBookedHours(facility, bkSelectedDateIso);
    const lastStart = BOOKING_DAY_END - duration; // last hour a booking of this length can still start

    let html = '';
    for (let h = BOOKING_DAY_START; h <= lastStart; h++) {
      let isBooked = false;
      for (let k = h; k < h + duration; k++) {
        if (blocked.has(k)) { isBooked = true; break; }
      }
      const isSelected = h === bkSelectedStartHour;
      html += `
        <button type="button" class="bktime-slot ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}" data-hour="${h}" ${isBooked ? 'disabled' : ''}>
          <span class="bktime-slot-label">${formatHourLabel(h)}–${formatHourLabel(h + duration)}</span>
          <span class="bktime-slot-status">${isBooked ? 'Booked' : 'Available'}</span>
        </button>
      `;
    }

    bkTimeSlots.innerHTML = html || `<p class="bkcal-hint">No ${duration}-hour slot is free on this date. Try a shorter duration or another date.</p>`;

    bkTimeSlots.querySelectorAll('.bktime-slot[data-hour]:not(.booked)').forEach(btn => {
      btn.addEventListener('click', () => {
        bkSelectedStartHour = parseInt(btn.dataset.hour, 10);
        bkTimeSlots.classList.remove('has-error');
        renderBkTimeSlots();
        scrollToQuestion('q-purpose');
      });
    });
  }

  document.getElementById('bkcal-prev').addEventListener('click', () => { bkCalDate.setMonth(bkCalDate.getMonth() - 1); renderBkCalendar(); });
  document.getElementById('bkcal-next').addEventListener('click', () => { bkCalDate.setMonth(bkCalDate.getMonth() + 1); renderBkCalendar(); });

  bookingFacilitySelect.addEventListener('change', () => {
    bkSelectedStartHour = null;
    renderBkCalendar();
    renderBkTimeSlots();
    scrollToQuestion('q-date');
  });

  bkDurationSelect.addEventListener('change', () => {
    bkSelectedStartHour = null;
    renderBkTimeSlots();
    scrollToQuestion('q-time');
  });

  /* --- New Booking wizard: 3 steps (Facility & Date → Details → Confirm) --- */
  let bookingStep = 1;
  const bookingSteps           = document.querySelectorAll('.booking-step');
  const bookingStepIndicators    = document.querySelectorAll('.booking-step-item');
  const bookingBackBtn              = document.getElementById('booking-back');
  const bookingNextBtn                 = document.getElementById('booking-next');
  const bookingConfirmGrid                = document.getElementById('booking-confirm-grid');

  function goToStep(step) {
    bookingStep = step;
    bookingSteps.forEach(el => el.classList.toggle('hidden', parseInt(el.dataset.step, 10) !== step));
    bookingStepIndicators.forEach(el => {
      const s = parseInt(el.dataset.stepIndicator, 10);
      el.classList.toggle('active', s === step);
      el.classList.toggle('done', s < step);
    });
    bookingBackBtn.textContent = step === 1 ? 'Cancel' : 'Back';
    bookingNextBtn.textContent = step === 3 ? 'Save Booking' : 'Next';
    if (step === 3) renderBookingConfirmation();
    // Start each step scrolled to the top, so the first question of the
    // new step is visible instead of wherever the previous step left off.
    const card = bookingModal.querySelector('.modal-card');
    if (card) card.scrollTop = 0;
  }

  function renderBookingConfirmation() {
    const facility     = bookingFacilitySelect.value;
    const purpose        = bookingPurposeInput.value.trim();
    const duration          = parseInt(bkDurationSelect.value, 10);
    const startTime24          = `${String(bkSelectedStartHour).padStart(2, '0')}:00`;
    const endTime24                = `${String(bkSelectedStartHour + duration).padStart(2, '0')}:00`;

    bookingConfirmGrid.innerHTML = `
      <div><p class="so-detail-label">Facility</p><p class="so-detail-value">${escapeHtml(facility)}</p></div>
      <div><p class="so-detail-label">Date</p><p class="so-detail-value">${formatShortDate(bkSelectedDateIso)}</p></div>
      <div><p class="so-detail-label">Time</p><p class="so-detail-value">${escapeHtml(formatTime12(startTime24))} – ${escapeHtml(formatTime12(endTime24))}</p></div>
      <div><p class="so-detail-label">Duration</p><p class="so-detail-value">${duration} hour${duration === 1 ? '' : 's'}</p></div>
      <div style="grid-column: 1 / -1;"><p class="so-detail-label">Purpose</p><p class="so-detail-value">${escapeHtml(purpose)}</p></div>
    `;
  }

  document.getElementById('btn-new-booking').addEventListener('click', () => {
    [bookingFacilitySelect, bookingPurposeInput].forEach(clearFieldError);
    document.getElementById('bkcal-wrap').classList.remove('has-error');
    bkTimeSlots.classList.remove('has-error');
    bkCalDate = new Date(todayISO + 'T00:00:00');
    bkSelectedDateIso = todayISO;
    bkSelectedStartHour = null;
    bkDurationSelect.value = String(BOOKING_MIN_HOURS);
    bookingPurposeInput.value = '';
    renderBkCalendar();
    renderBkTimeSlots();
    goToStep(1);
    openModal(bookingModal);
  });

  bookingBackBtn.addEventListener('click', () => {
    if (bookingStep === 1) { closeModal(bookingModal); return; }
    goToStep(bookingStep - 1);
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(bookingModal); closeModal(cancelModal); closeModal(detailsModal); closeModal(dayPlanModal); });
  });

  [bookingModal, cancelModal, detailsModal, dayPlanModal].forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(bookingModal); closeModal(cancelModal); closeModal(detailsModal); closeModal(dayPlanModal); } });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

  [bookingFacilitySelect, bookingPurposeInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
    input.addEventListener('change', () => clearFieldError(input));
  });

  // Purpose is the last question on step 2 — once it's filled in, bring
  // the footer's Next button into view instead of a nonexistent field.
  bookingPurposeInput.addEventListener('blur', () => {
    if (bookingPurposeInput.value.trim()) scrollToBookingFooter();
  });

  bookingNextBtn.addEventListener('click', async () => {
    if (bookingStep === 1) {
      clearFieldError(bookingFacilitySelect);
      const bkcalWrap = document.getElementById('bkcal-wrap');
      bkcalWrap.classList.remove('has-error');
      let valid = true;
      if (!bookingFacilitySelect.value) { setFieldError(bookingFacilitySelect, 'Please select a facility.'); valid = false; }
      if (!bkSelectedDateIso) { bkcalWrap.classList.add('has-error'); valid = false; }
      if (!valid) { showToast('Please fix the highlighted fields.', true); return; }
      goToStep(2);
      return;
    }

    if (bookingStep === 2) {
      clearFieldError(bookingPurposeInput);
      bkTimeSlots.classList.remove('has-error');
      const purpose = bookingPurposeInput.value.trim();
      let valid = true;
      if (!purpose) { setFieldError(bookingPurposeInput, 'Purpose is required.'); valid = false; }
      if (bkSelectedStartHour === null) { bkTimeSlots.classList.add('has-error'); valid = false; }
      if (!valid) { showToast('Please fix the highlighted fields.', true); return; }
      goToStep(3);
      return;
    }

    // Step 3 — confirm & save
    const facility = bookingFacilitySelect.value;
    const purpose   = bookingPurposeInput.value.trim();
    const duration     = parseInt(bkDurationSelect.value, 10);
    const startTime24    = `${String(bkSelectedStartHour).padStart(2, '0')}:00`;
    const endTime24         = `${String(bkSelectedStartHour + duration).padStart(2, '0')}:00`;

    // Guard against a race — another admin could have booked this exact
    // slot while this modal was open (the selection above can go stale
    // if that happens right at submit time, before the live re-render).
    const blockedNow = getBookedHours(facility, bkSelectedDateIso);
    for (let h = bkSelectedStartHour; h < bkSelectedStartHour + duration; h++) {
      if (blockedNow.has(h)) {
        showToast('That time was just booked by someone else — please pick another slot.', true);
        bkSelectedStartHour = null;
        goToStep(2);
        renderBkTimeSlots();
        return;
      }
    }

    bookingNextBtn.disabled = true;
    try {
      const result = await client.models.FacilityBooking.create({
        facilityName: facility,
        purpose,
        date: bkSelectedDateIso,
        startTime: formatTime12(startTime24),
        endTime: formatTime12(endTime24),
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(bookingModal);
      showToast(`Booking request submitted for ${facility} on ${formatShortDate(bkSelectedDateIso)}.`);
      bookingPurposeInput.value = '';
      bkSelectedStartHour = null;
    } catch (err) {
      console.error('Failed to submit booking:', err);
      showToast(err.message || "Couldn't submit booking.", true);
    } finally {
      bookingNextBtn.disabled = false;
    }
  });

  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
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