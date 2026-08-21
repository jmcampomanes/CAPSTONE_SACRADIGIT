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
          <td>${escapeHtml(b.startTime)}</td>
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
    detailsTime.textContent = b.startTime;
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
  const calDayDetail     = document.getElementById('calendar-day-detail');

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

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(year, month, day);
      const dayBookings = bookings.filter(b => b.date === iso);
      const isToday = iso === todayISO;
      const isSelected = iso === selectedDateIso;

      const dotsHtml = dayBookings.slice(0, 4).map(b =>
        `<span class="calendar-dot ${b.status === 'pending' ? 'pending' : ''}"></span>`
      ).join('');

      cellsHtml += `
        <div class="calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${iso}">
          <span class="calendar-date-num">${day}</span>
          <div class="calendar-dots">${dotsHtml}</div>
        </div>
      `;
    }

    calGrid.innerHTML = cellsHtml;
    calGrid.querySelectorAll('.calendar-cell:not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const iso = cell.dataset.date;
        selectedDateIso = (selectedDateIso === iso) ? null : iso;
        renderCalendar();
        renderDayDetail();
      });
    });
  }

  function renderDayDetail() {
    if (!selectedDateIso) {
      calDayDetail.classList.add('hidden');
      calDayDetail.innerHTML = '';
      return;
    }

    const dayBookings = bookings.filter(b => b.date === selectedDateIso).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const label = new Date(selectedDateIso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    if (dayBookings.length === 0) {
      calDayDetail.innerHTML = `
        <p class="calendar-day-detail-title">${label}</p>
        <p class="text-sm text-gray-400">No bookings on this date.</p>
      `;
    } else {
      calDayDetail.innerHTML = `
        <p class="calendar-day-detail-title">${label}</p>
        ${dayBookings.map(b => `
          <div class="calendar-day-booking">
            <span class="time">${escapeHtml(b.startTime)}</span>
            <span class="facility">${escapeHtml(b.facilityName)} — ${escapeHtml(b.purpose)}</span>
            <span class="badge ${badgeClass[b.status] || 'badge-gray'}">${statusLabel[b.status] || b.status}</span>
          </div>
        `).join('')}
      `;
    }

    calDayDetail.classList.remove('hidden');
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
    if (showingCalendar) { renderCalendar(); renderDayDetail(); }
  });


  function renderAll() {
    renderStats();
    renderTable();
    if (showingCalendar) { renderCalendar(); renderDayDetail(); }
  }


  /* --- New booking modal --- */
  const bookingModal       = document.getElementById('booking-modal');
  const bookingFacilitySelect = document.getElementById('booking-facility');

  bookingFacilitySelect.innerHTML = facilities.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');

  const bookingPurposeInput = document.getElementById('booking-purpose');
  const bookingDateInput     = document.getElementById('booking-date');
  const bookingTimeInput       = document.getElementById('booking-time');

  document.getElementById('btn-new-booking').addEventListener('click', () => {
    document.getElementById('booking-date').value = todayISO;
    [bookingFacilitySelect, bookingPurposeInput, bookingDateInput, bookingTimeInput].forEach(clearFieldError);
    openModal(bookingModal);
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(bookingModal); closeModal(cancelModal); closeModal(detailsModal); });
  });

  [bookingModal, cancelModal, detailsModal].forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(bookingModal); closeModal(cancelModal); closeModal(detailsModal); } });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

  [bookingFacilitySelect, bookingPurposeInput, bookingDateInput, bookingTimeInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
    input.addEventListener('change', () => clearFieldError(input));
  });

  document.getElementById('booking-submit').addEventListener('click', async () => {
    const facility = bookingFacilitySelect.value;
    const purpose   = bookingPurposeInput.value.trim();
    const date       = bookingDateInput.value;
    const time24      = bookingTimeInput.value;

    [bookingFacilitySelect, bookingPurposeInput, bookingDateInput, bookingTimeInput].forEach(clearFieldError);

    let hasError = false;
    if (!facility) { setFieldError(bookingFacilitySelect, 'Please select a facility.'); hasError = true; }
    if (!purpose)  { setFieldError(bookingPurposeInput, 'Purpose is required.'); hasError = true; }
    if (!date)     { setFieldError(bookingDateInput, 'Date is required.'); hasError = true; }
    if (!time24)   { setFieldError(bookingTimeInput, 'Time is required.'); hasError = true; }

    if (hasError) { showToast('Please fix the highlighted fields.', true); return; }

    try {
      const result = await client.models.FacilityBooking.create({
        facilityName: facility,
        purpose,
        date,
        startTime: formatTime12(time24),
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(bookingModal);
      showToast(`Booking request submitted for ${facility} on ${formatShortDate(date)}.`);
      bookingPurposeInput.value = '';
      bookingTimeInput.value = '';
    } catch (err) {
      console.error('Failed to submit booking:', err);
      showToast(err.message || "Couldn't submit booking.", true);
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