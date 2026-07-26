/* ============================================
   SacraDigit Admin — Facility Booking Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" fixed to match the rest of the app.
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  const facilities = [
    'Parish Hall',
    'Adoration Chapel',
    'Catechetical Room A',
    'Catechetical Room B',
    'Multi-Purpose Hall',
  ];

  let bookings = [
    { facility: 'Parish Hall',           purpose: 'Reyes Family — Wedding Reception', date: '2026-06-20', time: '02:00 PM', status: 'Approved' },
    { facility: 'Adoration Chapel',      purpose: 'Couples for Christ — Prayer Meeting', date: '2026-06-21', time: '07:00 PM', status: 'Approved' },
    { facility: 'Catechetical Room A',   purpose: 'Catechism Teachers Training',       date: '2026-06-22', time: '09:00 AM', status: 'Pending'  },
    { facility: 'Multi-Purpose Hall',    purpose: 'Youth Ministry Retreat',             date: '2026-06-24', time: '08:00 AM', status: 'Pending'  },
    { facility: 'Parish Hall',           purpose: 'Bautista Family — Baptismal Reception', date: '2026-06-27', time: '11:00 AM', status: 'Approved' },
    { facility: 'Catechetical Room B',   purpose: 'Lectors & Commentators Meeting', date: '2026-06-30', time: '06:00 PM', status: 'Pending'  },
  ];

  const tbody          = document.getElementById('bookings-tbody');
  const bookingsEmpty   = document.getElementById('bookings-empty');
  const bookingsCount   = document.getElementById('bookings-count');

  const badgeClass = {
    'Pending':  'badge-amber',
    'Approved': 'badge-green',
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    const weekStart = new Date(TODAY_ISO + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const thisWeekCount = bookings.filter(b => {
      const d = new Date(b.date + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    }).length;

    document.getElementById('stat-total-week').textContent = thisWeekCount;
    document.getElementById('stat-facilities').textContent = facilities.length;
    document.getElementById('stat-pending').textContent = bookings.filter(b => b.status === 'Pending').length;
  }


  /* ------------------------------------------
     2. RENDER — Table view
  ------------------------------------------ */
  function renderTable() {
    const sorted = bookings.slice().sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));

    bookingsCount.textContent = `${sorted.length} booking${sorted.length === 1 ? '' : 's'}`;

    if (sorted.length === 0) {
      tbody.innerHTML = '';
      bookingsEmpty.classList.remove('hidden');
      return;
    }
    bookingsEmpty.classList.add('hidden');

    tbody.innerHTML = sorted.map((b) => {
      const realIndex = bookings.indexOf(b);
      let actionsHtml = '';

      if (b.status === 'Pending') {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-approve" data-index="${realIndex}">Approve</button>
            <button type="button" class="row-reject" data-index="${realIndex}">Cancel</button>
          </div>`;
      } else {
        actionsHtml = `<div class="row-actions"><button type="button" class="row-reject" data-index="${realIndex}">Cancel</button></div>`;
      }

      return `
        <tr>
          <td class="font-medium text-gray-900">${escapeHtml(b.facility)}</td>
          <td>${formatShortDate(b.date)}</td>
          <td>${escapeHtml(b.time)}</td>
          <td><span class="badge ${badgeClass[b.status] || 'badge-gray'}">${escapeHtml(b.status)}</span></td>
          <td class="text-right">${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  }

  tbody.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('.row-approve');
    const cancelBtn  = e.target.closest('.row-reject');

    if (approveBtn) {
      const idx = parseInt(approveBtn.dataset.index, 10);
      bookings[idx].status = 'Approved';
      renderAll();
      showToast(`Booking for ${bookings[idx].facility} approved.`);
    }

    if (cancelBtn) {
      const idx = parseInt(cancelBtn.dataset.index, 10);
      const removed = bookings[idx];
      bookings.splice(idx, 1);
      renderAll();
      showToast(`Booking for ${removed.facility} on ${formatShortDate(removed.date)} cancelled.`);
    }
  });


  /* ------------------------------------------
     3. RENDER — Calendar view
  ------------------------------------------ */
  let calendarDate = new Date(TODAY_ISO + 'T00:00:00'); // tracks which month is shown
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
    const startWeekday = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cellsHtml = '';

    // Leading empty cells
    for (let i = 0; i < startWeekday; i++) {
      cellsHtml += `<div class="calendar-cell empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(year, month, day);
      const dayBookings = bookings.filter(b => b.date === iso);

      const isToday = iso === TODAY_ISO;
      const isSelected = iso === selectedDateIso;

      const dotsHtml = dayBookings.slice(0, 4).map(b =>
        `<span class="calendar-dot ${b.status === 'Pending' ? 'pending' : ''}"></span>`
      ).join('');

      cellsHtml += `
        <div class="calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${iso}">
          <span class="calendar-date-num">${day}</span>
          <div class="calendar-dots">${dotsHtml}</div>
        </div>
      `;
    }

    calGrid.innerHTML = cellsHtml;

    // Wire up cell clicks
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

    const dayBookings = bookings
      .filter(b => b.date === selectedDateIso)
      .sort((a, b) => a.time.localeCompare(b.time));

    const label = new Date(selectedDateIso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

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
            <span class="time">${escapeHtml(b.time)}</span>
            <span class="facility">${escapeHtml(b.facility)} — ${escapeHtml(b.purpose)}</span>
            <span class="badge ${badgeClass[b.status] || 'badge-gray'}">${escapeHtml(b.status)}</span>
          </div>
        `).join('')}
      `;
    }

    calDayDetail.classList.remove('hidden');
  }

  document.getElementById('cal-prev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });


  /* ------------------------------------------
     4. VIEW TOGGLE — Table vs Calendar
  ------------------------------------------ */
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

    if (showingCalendar) {
      renderCalendar();
      renderDayDetail();
    }
  });


  /* ------------------------------------------
     5. RENDER ALL (shared refresh helper)
  ------------------------------------------ */
  function renderAll() {
    renderStats();
    renderTable();
    if (showingCalendar) {
      renderCalendar();
      renderDayDetail();
    }
  }

  renderAll();


  /* ------------------------------------------
     6. NEW BOOKING MODAL
  ------------------------------------------ */
  const bookingModal       = document.getElementById('booking-modal');
  const bookingFacilitySelect = document.getElementById('booking-facility');

  bookingFacilitySelect.innerHTML = facilities
    .map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`)
    .join('');

  document.getElementById('btn-new-booking').addEventListener('click', () => {
    document.getElementById('booking-date').value = TODAY_ISO;
    openModal(bookingModal);
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(bookingModal));
  });

  bookingModal.addEventListener('click', (e) => {
    if (e.target === bookingModal) closeModal(bookingModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(bookingModal);
  });

  function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.getElementById('booking-submit').addEventListener('click', () => {
    const facility = bookingFacilitySelect.value;
    const purpose   = document.getElementById('booking-purpose').value.trim();
    const date       = document.getElementById('booking-date').value;
    const time24      = document.getElementById('booking-time').value;

    if (!facility || !purpose || !date || !time24) {
      showToast('Please fill in facility, purpose, date, and time.', true);
      return;
    }

    bookings.push({
      facility,
      purpose,
      date,
      time: formatTime12(time24),
      status: 'Pending',
    });

    renderAll();
    closeModal(bookingModal);
    showToast(`Booking request submitted for ${facility} on ${formatShortDate(date)}.`);

    // Reset form
    document.getElementById('booking-purpose').value = '';
    document.getElementById('booking-time').value = '';
  });

  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* ------------------------------------------
     7. TOAST NOTIFICATIONS
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});