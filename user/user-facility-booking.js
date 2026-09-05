/* ============================================
   SacraDigit — User Facility Booking Scripts (AWS Amplify)
   Runs after user-shell.js.
   "My Bookings" filters client-side by
   requesterName === hardcoded demo name.
   Cancel deletes the booking (no "cancelled"
   status in the FacilityBooking schema).
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = 'Maria P. Santos';

  const facilities = [
    { id: 'parish-hall', name: 'Parish Hall', desc: 'Large multi-purpose hall suitable for receptions, reunions, and parish events.', capacity: 200, availability: 'available', barColor: '#8b8fc7' },
    { id: 'adoration-chapel', name: 'Adoration Chapel', desc: 'Intimate chapel for prayer meetings, novenas, and small group gatherings.', capacity: 40, availability: 'available', barColor: '#c9a84c' },
    { id: 'catechetical-a', name: 'Catechetical Room A', desc: 'Classroom-style room ideal for Bible studies, seminars, and formations.', capacity: 30, availability: 'limited', barColor: '#6c91c2' },
    { id: 'catechetical-b', name: 'Catechetical Room B', desc: 'Smaller discussion room for group meetings and ministry gatherings.', capacity: 20, availability: 'available', barColor: '#9ca3af' },
    { id: 'multi-purpose', name: 'Multi-Purpose Hall', desc: 'Flexible open space for youth activities, concerts, and community events.', capacity: 150, availability: 'available', barColor: '#16a34a' },
  ];

  let myBookings = [];

  const badgeClass = { pending: 'badge-amber', approved: 'badge-green', declined: 'badge-red' };
  const statusLabel = { pending: 'Pending', approved: 'Approved', declined: 'Rejected' };
  const cancelableStatuses = ['pending', 'approved'];

  function renderFacilityGrid() {
    const grid = document.getElementById('facility-grid');
    grid.innerHTML = facilities.map(f => `
      <div class="facility-card">
        <div class="facility-card-bar" style="background-color:${f.barColor};"></div>
        <div class="facility-card-body">
          <p class="facility-name">${f.name}</p>
          <p class="facility-desc">${f.desc}</p>
          <div class="facility-meta">
            <span class="facility-capacity"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-3.5-5.93"/></svg>Up to ${f.capacity} pax</span>
            <span class="facility-avail-badge ${f.availability}">${f.availability === 'available' ? 'Available' : 'Limited Slots'}</span>
          </div>
        </div>
        <div class="facility-card-footer"><button type="button" class="btn-book-this" data-facility-id="${f.id}">Book This Facility</button></div>
      </div>`).join('');

    grid.querySelectorAll('.btn-book-this').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.facilityId)));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function formatShortDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const mer = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`;
  }
  // Bookings created before end time was added won't have one — fall
  // back to just the start time rather than showing "9:00 AM – ".
  function formatTimeRange(b) {
    if (!b.startTime) return '—';
    return b.endTime ? `${b.startTime} – ${b.endTime}` : b.startTime;
  }

  // Auto-scroll helpers for the booking wizard — once a question is
  // answered, bring the next one into view so the parishioner doesn't
  // have to scroll the modal manually. block:'start' is relative to the
  // modal card itself, since that's the nearest scrollable ancestor.
  function scrollToQuestion(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToBookingFooter() {
    const footer = document.getElementById('booking-modal').querySelector('.modal-footer');
    if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  client.models.FacilityBooking.observeQuery({ filter: { requesterName: { eq: REQUESTER_NAME } } }).subscribe({
    next: ({ items }) => { myBookings = items; renderBookings(); },
    error: (err) => {
      console.error('Failed to load bookings:', err);
      document.getElementById('bookings-tbody').innerHTML = `<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn't load bookings.</td></tr>`;
    },
  });

  function renderBookings() {
    const tbody = document.getElementById('bookings-tbody');
    const empty  = document.getElementById('bookings-empty');
    const count   = document.getElementById('bookings-count');

    count.textContent = `${myBookings.length} booking${myBookings.length === 1 ? '' : 's'}`;

    if (myBookings.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    const sorted = myBookings.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

    tbody.innerHTML = sorted.map(b => `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(b.facilityName)}</td>
        <td>${formatShortDate(b.date)}</td>
        <td>${escapeHtml(formatTimeRange(b))}</td>
        <td class="text-gray-500">${escapeHtml(b.purpose)}</td>
        <td><span class="badge ${badgeClass[b.status] || 'badge-gray'}">${statusLabel[b.status] || b.status}</span></td>
        <td><div class="booking-row-actions">
          <button type="button" class="btn-view-booking" data-id="${b.id}">View</button>
          ${cancelableStatuses.includes(b.status) ? `<button type="button" class="btn-cancel-booking" data-id="${b.id}">Cancel</button>` : ''}
        </div></td>
      </tr>`).join('');
  }

  document.getElementById('bookings-tbody').addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.btn-view-booking');
    if (viewBtn) { openDetailModal(viewBtn.dataset.id); return; }
    const cancelBtn = e.target.closest('.btn-cancel-booking');
    if (cancelBtn) openCancelModal(cancelBtn.dataset.id);
  });

  renderFacilityGrid();

  const modal          = document.getElementById('booking-modal');
  const facilitySelect  = document.getElementById('book-facility');
  const purposeInput       = document.getElementById('book-purpose');
  const attendeesInput      = document.getElementById('book-attendees');
  const notesInput           = document.getElementById('book-notes');

  const bookingDetailModal = document.getElementById('booking-detail-modal');
  const cancelModal          = document.getElementById('cancel-modal');
  let cancelTargetId = null;

  facilitySelect.innerHTML = '<option value="">Choose a facility…</option>' +
    facilities.map(f => `<option value="${f.name}">${f.name} (up to ${f.capacity} pax)</option>`).join('');

  /* --- Booking date + time picker ---
     Facilities are booked in whole-hour blocks between 8:00 AM and
     7:00 PM, for 1–5 hours at a time. The calendar marks a day "Fully
     Booked" (for the currently-selected facility) once every hour in
     that window is already covered by an existing booking; otherwise
     it's "Available". Picking a date shows which hourly slots are
     still open, and duration options are limited to whatever fits
     without hitting 7:00 PM or an already-booked hour. Parishioner
     requests also need at least 3 days' notice, per the booking
     policy note below the form. */
  const BOOKING_DAY_START      = 8;  // 8:00 AM
  const BOOKING_DAY_END        = 19; // 7:00 PM
  const BOOKING_MIN_HOURS      = 1;
  const BOOKING_MAX_HOURS      = 5;
  const BOOKING_MIN_ADVANCE_DAYS = 3;

  function toLocalISODate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todayISO = toLocalISODate();
  const earliestBookableIso = (() => {
    const d = new Date(todayISO + 'T00:00:00');
    d.setDate(d.getDate() + BOOKING_MIN_ADVANCE_DAYS);
    return toLocalISODate(d);
  })();

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

  // "Booked" here means booked by anyone parish-wide for this facility,
  // not just this parishioner — myBookings only holds this parishioner's
  // own requests, so a live all-bookings query backs the picker instead.
  let allBookingsForFacility = [];
  let allBookingsSub = null;

  function getBookedHours(iso) {
    const blocked = new Set();
    allBookingsForFacility.filter(b => b.date === iso).forEach(b => {
      const startMin = parseTimeToMinutes(b.startTime);
      if (startMin === null) return;
      const endMin = b.endTime ? parseTimeToMinutes(b.endTime) : startMin + 60;
      const startHour = Math.floor(startMin / 60);
      const endHourExclusive = Math.ceil(endMin / 60);
      for (let h = startHour; h < endHourExclusive; h++) blocked.add(h);
    });
    return blocked;
  }

  function isDayFullyBooked(iso) {
    const blocked = getBookedHours(iso);
    for (let h = BOOKING_DAY_START; h < BOOKING_DAY_END; h++) {
      if (!blocked.has(h)) return false;
    }
    return true;
  }

  function isoFromPartsBk(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  let bkCalDate          = new Date(earliestBookableIso + 'T00:00:00');
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
  // list from changing shape underneath the parishioner as they pick.
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
    const facility = facilitySelect.value;

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += `<span class="bkcal-day empty"></span>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromPartsBk(year, month, day);
      const isTooSoon = iso < earliestBookableIso;
      const isToday = iso === todayISO;
      const isSelected = iso === bkSelectedDateIso;
      const full = facility ? isDayFullyBooked(iso) : false;

      html += `
        <button type="button" class="bkcal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${facility ? (full ? 'full' : 'available') : ''}" data-date="${iso}" ${isTooSoon ? 'disabled' : ''}>${day}</button>
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
    const facility = facilitySelect.value;

    if (!facility || !bkSelectedDateIso) {
      bkTimeSlots.innerHTML = '';
      bkTimeHint.textContent = 'Select a facility and date to see available times.';
      bkTimeHint.classList.remove('hidden');
      return;
    }

    bkTimeHint.classList.add('hidden');
    const duration = parseInt(bkDurationSelect.value, 10);
    const blocked = getBookedHours(bkSelectedDateIso);
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

  // Availability is facility-specific, so re-subscribe to a live,
  // parish-wide query scoped to whichever facility is currently
  // selected — myBookings alone (this parishioner's own requests)
  // isn't enough to know what's already taken.
  function watchFacilityAvailability(facility) {
    if (allBookingsSub) { allBookingsSub.unsubscribe(); allBookingsSub = null; }
    allBookingsForFacility = [];
    if (!facility) { renderBkCalendar(); renderBkTimeSlots(); return; }

    allBookingsSub = client.models.FacilityBooking.observeQuery({ filter: { facilityName: { eq: facility } } }).subscribe({
      next: ({ items }) => {
        allBookingsForFacility = items;
        renderBkCalendar();
        renderBkTimeSlots();
      },
      error: (err) => console.error('Failed to load facility availability:', err),
    });
  }

  document.getElementById('bkcal-prev').addEventListener('click', () => { bkCalDate.setMonth(bkCalDate.getMonth() - 1); renderBkCalendar(); });
  document.getElementById('bkcal-next').addEventListener('click', () => { bkCalDate.setMonth(bkCalDate.getMonth() + 1); renderBkCalendar(); });

  facilitySelect.addEventListener('change', () => {
    bkSelectedStartHour = null;
    watchFacilityAvailability(facilitySelect.value);
    scrollToQuestion('q-date');
  });

  bkDurationSelect.addEventListener('change', () => {
    bkSelectedStartHour = null;
    renderBkTimeSlots();
    scrollToQuestion('q-time');
  });

  /* --- Booking wizard: 3 steps (Facility & Date → Details → Confirm) --- */
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
    bookingNextBtn.textContent = step === 3 ? 'Submit Booking' : 'Next';
    if (step === 3) renderBookingConfirmation();
    // Start each step scrolled to the top, so the first question of the
    // new step is visible instead of wherever the previous step left off.
    const card = modal.querySelector('.modal-card');
    if (card) card.scrollTop = 0;
  }

  function renderBookingConfirmation() {
    const facility     = facilitySelect.value;
    const purpose         = purposeInput.value.trim();
    const attendees          = attendeesInput.value.trim();
    const notes                 = notesInput.value.trim();
    const duration                 = parseInt(bkDurationSelect.value, 10);
    const startTime24                  = `${String(bkSelectedStartHour).padStart(2, '0')}:00`;
    const endTime24                        = `${String(bkSelectedStartHour + duration).padStart(2, '0')}:00`;

    bookingConfirmGrid.innerHTML = `
      <div><p class="modal-detail-item-label">Facility</p><p class="modal-detail-item-value">${escapeHtml(facility)}</p></div>
      <div><p class="modal-detail-item-label">Date</p><p class="modal-detail-item-value">${formatShortDate(bkSelectedDateIso)}</p></div>
      <div><p class="modal-detail-item-label">Time</p><p class="modal-detail-item-value">${escapeHtml(formatTime12(startTime24))} – ${escapeHtml(formatTime12(endTime24))}</p></div>
      <div><p class="modal-detail-item-label">Duration</p><p class="modal-detail-item-value">${duration} hour${duration === 1 ? '' : 's'}</p></div>
      <div style="grid-column: 1 / -1;"><p class="modal-detail-item-label">Purpose</p><p class="modal-detail-item-value">${escapeHtml(purpose)}</p></div>
      ${attendees ? `<div><p class="modal-detail-item-label">Expected Attendees</p><p class="modal-detail-item-value">${escapeHtml(attendees)}</p></div>` : ''}
      ${notes ? `<div style="grid-column: 1 / -1;"><p class="modal-detail-item-label">Notes</p><p class="modal-detail-item-value">${escapeHtml(notes)}</p></div>` : ''}
    `;
  }

  function openModal(preSelectFacilityId = null) {
    facilitySelect.value = '';
    purposeInput.value = '';
    attendeesInput.value = '';
    notesInput.value = '';
    facilitySelect.classList.remove('border-red-400');
    purposeInput.classList.remove('border-red-400');
    document.getElementById('bkcal-wrap').classList.remove('has-error');
    bkTimeSlots.classList.remove('has-error');
    bkCalDate = new Date(earliestBookableIso + 'T00:00:00');
    bkSelectedDateIso = null;
    bkSelectedStartHour = null;
    bkDurationSelect.value = String(BOOKING_MIN_HOURS);
    if (preSelectFacilityId) {
      const f = facilities.find(f => f.id === preSelectFacilityId);
      if (f) facilitySelect.value = f.name;
    }
    watchFacilityAvailability(facilitySelect.value);
    goToStep(1);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    bookingDetailModal.classList.add('hidden');
    cancelModal.classList.add('hidden');
    document.body.style.overflow = '';
    cancelTargetId = null;
    if (allBookingsSub) { allBookingsSub.unsubscribe(); allBookingsSub = null; }
  }

  function openDetailModal(id) {
    const b = myBookings.find(x => x.id === id);
    if (!b) return;
    const statusBadge = document.getElementById('detail-status-badge');
    statusBadge.textContent = statusLabel[b.status] || b.status;
    statusBadge.className = `badge ${badgeClass[b.status] || 'badge-gray'}`;

    document.getElementById('detail-grid').innerHTML = `
      <div><p class="modal-detail-item-label">Facility</p><p class="modal-detail-item-value">${escapeHtml(b.facilityName)}</p></div>
      <div><p class="modal-detail-item-label">Date</p><p class="modal-detail-item-value">${formatShortDate(b.date)}</p></div>
      <div><p class="modal-detail-item-label">Time</p><p class="modal-detail-item-value">${escapeHtml(formatTimeRange(b))}</p></div>
      <div><p class="modal-detail-item-label">Purpose</p><p class="modal-detail-item-value">${escapeHtml(b.purpose)}</p></div>`;

    bookingDetailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function openCancelModal(id) {
    const b = myBookings.find(x => x.id === id);
    if (!b) return;
    cancelTargetId = id;
    document.getElementById('cancel-target-name').textContent = `${b.facilityName} — ${formatShortDate(b.date)}, ${formatTimeRange(b)}`;
    cancelModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  document.getElementById('btn-book').addEventListener('click', () => openModal());
  document.getElementById('btn-empty-book')?.addEventListener('click', () => openModal());

  // Purpose → Attendees → Notes → footer: each optional/required text
  // field chains to the next one once the parishioner has answered it.
  purposeInput.addEventListener('blur', () => {
    if (purposeInput.value.trim()) scrollToQuestion('q-attendees');
  });
  attendeesInput.addEventListener('blur', () => {
    if (attendeesInput.value.trim()) scrollToQuestion('q-notes');
  });
  notesInput.addEventListener('blur', () => {
    if (notesInput.value.trim()) scrollToBookingFooter();
  });

  bookingBackBtn.addEventListener('click', () => {
    if (bookingStep === 1) { closeModal(); return; }
    goToStep(bookingStep - 1);
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
  [modal, bookingDetailModal, cancelModal].forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('cancel-confirm-submit').addEventListener('click', async () => {
    if (!cancelTargetId) return;
    const b = myBookings.find(x => x.id === cancelTargetId);
    try {
      const result = await client.models.FacilityBooking.delete({ id: cancelTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal();
      window.showToast(`Booking for ${b ? b.facilityName : 'facility'} on ${b ? formatShortDate(b.date) : ''} has been cancelled.`);
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      window.showToast(err.message || "Couldn't cancel the booking.", true);
    }
  });

  bookingNextBtn.addEventListener('click', async () => {
    if (bookingStep === 1) {
      const bkcalWrap = document.getElementById('bkcal-wrap');
      bkcalWrap.classList.remove('has-error');
      let valid = true;
      if (!facilitySelect.value) {
        facilitySelect.classList.add('border-red-400');
        facilitySelect.addEventListener('input', () => facilitySelect.classList.remove('border-red-400'), { once: true });
        facilitySelect.addEventListener('change', () => facilitySelect.classList.remove('border-red-400'), { once: true });
        valid = false;
      }
      if (!bkSelectedDateIso) { bkcalWrap.classList.add('has-error'); valid = false; }
      if (!valid) { window.showToast('Please fill in all required fields.', true); return; }
      goToStep(2);
      return;
    }

    if (bookingStep === 2) {
      bkTimeSlots.classList.remove('has-error');
      const purpose = purposeInput.value.trim();
      let valid = true;
      if (!purpose) {
        purposeInput.classList.add('border-red-400');
        purposeInput.addEventListener('input', () => purposeInput.classList.remove('border-red-400'), { once: true });
        valid = false;
      }
      if (bkSelectedStartHour === null) { bkTimeSlots.classList.add('has-error'); valid = false; }
      if (!valid) { window.showToast('Please fill in all required fields.', true); return; }
      goToStep(3);
      return;
    }

    // Step 3 — confirm & submit
    const facility = facilitySelect.value;
    const purpose     = purposeInput.value.trim();
    const duration       = parseInt(bkDurationSelect.value, 10);
    const startTime24      = `${String(bkSelectedStartHour).padStart(2, '0')}:00`;
    const endTime24            = `${String(bkSelectedStartHour + duration).padStart(2, '0')}:00`;

    // Guard against a race — someone else could have booked this exact
    // slot while this modal was open (the selection above can go stale
    // if that happens right at submit time, before the live re-render).
    const blockedNow = getBookedHours(bkSelectedDateIso);
    for (let h = bkSelectedStartHour; h < bkSelectedStartHour + duration; h++) {
      if (blockedNow.has(h)) {
        window.showToast('That time was just booked by someone else — please pick another slot.', true);
        bkSelectedStartHour = null;
        goToStep(2);
        renderBkTimeSlots();
        return;
      }
    }

    bookingNextBtn.disabled = true;
    try {
      const result = await client.models.FacilityBooking.create({
        requesterName: REQUESTER_NAME,
        facilityName: facility,
        date: bkSelectedDateIso,
        startTime: formatTime12(startTime24),
        endTime: formatTime12(endTime24),
        purpose,
        attendees: attendeesInput.value ? parseInt(attendeesInput.value, 10) : undefined,
        notes: notesInput.value.trim() || undefined,
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal();
      window.showToast(`Booking request submitted for ${facility} on ${formatShortDate(bkSelectedDateIso)}.`);
    } catch (err) {
      console.error('Failed to submit booking:', err);
      window.showToast(err.message || "Couldn't submit the booking.", true);
    } finally {
      bookingNextBtn.disabled = false;
    }
  });

});