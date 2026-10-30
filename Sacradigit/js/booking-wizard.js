/* ============================================
   SacraDigit Admin — New Facility Booking wizard
   The full-screen, 3-step booking screen (Facility &
   Date → Details → Confirm), shared by Facility
   Booking and Ministry Bookings so both book rooms the
   same way: whole hours between 8:00 AM and 7:00 PM,
   1–5 hours at a time, booked hours and parish closure
   days greyed out, and a last check for a clash right
   before saving.

   createBookingWizard({ … }) adds the screen to the
   page and returns { open(), refresh(), close(), isOpen() }.
   Call refresh() whenever the bookings change.
   Same steps, labels and fields as the parishioner's
   own Book a Facility (user/user-facility-booking.html),
   plus "Booked For" — the office books for someone.
   Page-specific parts are passed in:
     askRequester      false when the page already knows who it's for
     banner()          HTML shown above every step (who it's for)
     confirmRows()     extra rows on the Confirm step
     buildRecord(base) the FacilityBooking to save (add fields)
     savedMessage(rec) the toast after saving
   Styles: Sacradigit/css/facility-booking.css.
   ============================================ */

import { watchClosures, closureOn } from '../../shared/js/service-schedule.js';

const BOOKING_DAY_START = 8;  // 8:00 AM
const BOOKING_DAY_END = 19;   // 7:00 PM
const BOOKING_MIN_HOURS = 1;
const BOOKING_MAX_HOURS = 5;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const localToday = () => { const d = new Date(); return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); };
export const formatShortDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "13:00" → "01:00 PM" (how booking times are stored). */
export function formatTime12(time24) {
  let [h, m] = time24.split(':').map(Number);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad2(h)}:${pad2(m)} ${meridiem}`;
}

function parseTimeToMinutes(time12) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time12 || '').trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mer = m[3].toUpperCase();
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + parseInt(m[2], 10);
}

const formatHourLabel = (hour) => `${((hour + 11) % 12) + 1}:00 ${hour < 12 ? 'AM' : 'PM'}`;

const ICON_BACK = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
const ICON_NEXT = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';

const markup = ({ title, sub, purposeLabel, purposePlaceholder, askRequester }) => `
  <section id="booking-modal" class="booking-fullscreen hidden" role="dialog" aria-modal="true" aria-labelledby="booking-page-title">
    <header class="booking-fullscreen-bar">
      <button type="button" id="booking-page-back" class="booking-page-back">${ICON_BACK} Back</button>
      <div class="booking-fullscreen-heading">
        <h2 id="booking-page-title" class="booking-page-title">${esc(title)}</h2>
        <p class="booking-page-sub">${esc(sub)}</p>
      </div>
      <div class="booking-steps">
        <div class="booking-step-item" data-step-indicator="1"><span class="booking-step-num">1</span><span class="booking-step-label">Facility &amp; Date</span></div>
        <div class="booking-step-connector"></div>
        <div class="booking-step-item" data-step-indicator="2"><span class="booking-step-num">2</span><span class="booking-step-label">Time &amp; Details</span></div>
        <div class="booking-step-connector"></div>
        <div class="booking-step-item" data-step-indicator="3"><span class="booking-step-num">3</span><span class="booking-step-label">Confirm</span></div>
      </div>
    </header>

    <div class="booking-fullscreen-body" id="booking-fullscreen-body">
      <div id="booking-context" class="booking-context hidden"></div>

      <!-- Step 1: Facility (left) + Date (right) -->
      <div class="booking-step booking-step-cols" data-step="1">
        <div class="booking-col" id="q-facility">
          <label class="form-label" for="booking-facility">Facility <span class="text-red-500">*</span></label>
          <select id="booking-facility" class="form-input"></select>
          <p class="bkcal-hint">Availability on the calendar is for the facility selected here.</p>
        </div>
        <div class="booking-col" id="q-date">
          <p class="form-label">Date <span class="text-red-500">*</span></p>
          <p class="bkcal-hint" style="margin-top:0;margin-bottom:0.5rem;">The office can book any open day from today on.</p>
          <div class="bkcal" id="bkcal-wrap">
            <div class="bkcal-nav">
              <button type="button" id="bkcal-prev" class="calendar-nav-btn" aria-label="Previous month">${ICON_BACK}</button>
              <span id="bkcal-month-label" class="calendar-month-label"></span>
              <button type="button" id="bkcal-next" class="calendar-nav-btn" aria-label="Next month">${ICON_NEXT}</button>
            </div>
            <div class="bkcal-weekdays"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
            <div id="bkcal-grid" class="bkcal-grid"></div>
            <div class="bkcal-legend">
              <span class="bkcal-legend-item"><span class="bkcal-dot available"></span>Available</span>
              <span class="bkcal-legend-item"><span class="bkcal-dot full"></span>Fully Booked</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Duration + Start Time (left) · Purpose (right) -->
      <div class="booking-step booking-step-cols hidden" data-step="2">
        <div class="booking-col space-y-4">
          <div id="q-duration">
            <label class="form-label" for="booking-duration">Duration <span class="text-red-500">*</span></label>
            <select id="booking-duration" class="form-input"></select>
            <p class="bkcal-hint">Minimum 1 hour, maximum 5 hours. Bookings run between 8:00 AM and 7:00 PM.</p>
          </div>
          <div id="q-time">
            <p class="form-label">Start Time <span class="text-red-500">*</span></p>
            <p id="bktime-hint" class="bkcal-hint">Select a facility and date to see available times.</p>
            <div id="bktime-slots" class="bktime-slots"></div>
          </div>
        </div>
        <div class="booking-col space-y-4">
          ${askRequester ? `<div id="q-requester">
            <label class="form-label" for="booking-requester">Booked For <span class="text-red-500">*</span></label>
            <input type="text" id="booking-requester" class="form-input" placeholder="e.g. Juan Dela Cruz, or the Youth Ministry" />
          </div>` : ''}
          <div id="q-purpose">
            <label class="form-label" for="booking-purpose">${esc(purposeLabel)} <span class="text-red-500">*</span></label>
            <input type="text" id="booking-purpose" class="form-input" placeholder="${esc(purposePlaceholder)}" />
          </div>
          <div id="q-attendees">
            <label class="form-label" for="booking-attendees">Expected Attendees</label>
            <input type="number" id="booking-attendees" class="form-input" placeholder="e.g. 40" min="1" />
          </div>
          <div id="q-notes">
            <label class="form-label" for="booking-notes">Additional Notes (optional)</label>
            <textarea id="booking-notes" class="form-input" rows="3" placeholder="Setup requirements, special requests…"></textarea>
          </div>
        </div>
      </div>

      <!-- Step 3: Confirmation -->
      <div class="booking-step booking-step-confirm hidden" data-step="3">
        <p class="bkcal-hint" style="margin-bottom: 0.75rem;">Please review before saving.</p>
        <div id="booking-confirm-grid" class="so-detail-grid"></div>
        <div class="booking-policy-note">
          <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p class="text-xs text-gray-600 leading-relaxed">Open slots are confirmed as soon as you save — no waiting for approval. Booked hours can’t be double-booked.</p>
        </div>
      </div>
    </div>

    <footer class="booking-fullscreen-footer">
      <button type="button" id="booking-back" class="btn-secondary">Cancel</button>
      <button type="button" id="booking-next" class="btn-lavender">Next</button>
    </footer>
  </section>`;

export function createBookingWizard({
  client,
  facilities,
  getBookings,
  showToast,
  title = 'New Facility Booking',
  sub = 'Pick a facility and date, add the booking details, then save.',
  purposeLabel = 'Purpose / Event Name',
  purposePlaceholder = 'e.g. Family Reunion, Bible Study',
  askRequester = true,
  banner = () => '',
  confirmRows = () => '',
  buildRecord = (base) => base,
  savedMessage = (rec) => `${rec.facilityName} booked for ${formatShortDate(rec.date)}.`,
  onSaved = () => {},
}) {
  document.body.insertAdjacentHTML('beforeend', markup({ title, sub, purposeLabel, purposePlaceholder, askRequester }));
  const $ = (id) => document.getElementById(id);
  const bookingModal = $('booking-modal');
  const facilitySelect = $('booking-facility');
  const purposeInput = $('booking-purpose');
  const requesterInput = $('booking-requester'); // null when askRequester is false
  const attendeesInput = $('booking-attendees');
  const notesInput = $('booking-notes');
  const durationSelect = $('booking-duration');
  const calGrid = $('bkcal-grid');
  const calMonthLabel = $('bkcal-month-label');
  const timeSlots = $('bktime-slots');
  const timeHint = $('bktime-hint');
  const contextBox = $('booking-context');
  const backBtn = $('booking-back');
  const nextBtn = $('booking-next');
  const confirmGrid = $('booking-confirm-grid');
  const stepEls = bookingModal.querySelectorAll('.booking-step');
  const stepIndicators = bookingModal.querySelectorAll('.booking-step-item');

  facilitySelect.innerHTML = '<option value="">Choose a facility…</option>' + facilities.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  durationSelect.innerHTML = Array.from({ length: BOOKING_MAX_HOURS - BOOKING_MIN_HOURS + 1 }, (_, i) => BOOKING_MIN_HOURS + i)
    .map(dur => `<option value="${dur}">${dur} hour${dur === 1 ? '' : 's'}</option>`).join('');

  let todayISO = localToday();
  let calDate = new Date(todayISO + 'T00:00:00');
  let selectedDateIso = null;
  let selectedStartHour = null;
  let step = 1;
  let closures = [];
  watchClosures(client, (next) => { closures = next; renderCalendar(); renderTimeSlots(); });

  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) { msg = document.createElement('p'); msg.className = 'form-error-msg'; input.insertAdjacentElement('afterend', msg); }
    msg.textContent = message;
  }
  function clearFieldError(input) {
    input.classList.remove('has-error');
    input.parentElement.querySelector('.form-error-msg')?.remove();
  }
  // Once a question is answered, bring the next one into view.
  const scrollToQuestion = (id) => $(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollToFooter = () => bookingModal.querySelector('.booking-fullscreen-footer')?.scrollIntoView({ behavior: 'smooth', block: 'end' });

  /* Every hour already touched by a booking of this facility on this date.
     Bookings made before hourly slots existed may fall mid-hour — those
     still block the whole hour(s) they overlap. */
  function getBookedHours(facility, iso) {
    const blocked = new Set();
    getBookings().filter(b => b.facilityName === facility && b.date === iso && b.status !== 'declined').forEach(b => {
      const startMin = parseTimeToMinutes(b.startTime);
      if (startMin === null) return;
      const endMin = b.endTime ? parseTimeToMinutes(b.endTime) : startMin + 60;
      for (let h = Math.floor(startMin / 60); h < Math.ceil(endMin / 60); h++) blocked.add(h);
    });
    return blocked;
  }

  function isDayFullyBooked(facility, iso) {
    if (closureOn(iso, closures)) return true;
    const blocked = getBookedHours(facility, iso);
    for (let h = BOOKING_DAY_START; h < BOOKING_DAY_END; h++) if (!blocked.has(h)) return false;
    return true;
  }

  function renderCalendar() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    calMonthLabel.textContent = calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const facility = facilitySelect.value;

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += '<span class="bkcal-day empty"></span>';
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoOf(year, month, day);
      const closure = closureOn(iso, closures);
      const full = facility ? isDayFullyBooked(facility, iso) : false;
      html += `<button type="button" class="bkcal-day ${iso === todayISO ? 'today' : ''} ${iso === selectedDateIso ? 'selected' : ''} ${facility ? (full ? 'full' : 'available') : ''}" data-date="${iso}" ${iso < todayISO || closure ? 'disabled' : ''}${closure ? ` title="Parish closed: ${esc(closure.name)}"` : ''}>${day}</button>`;
    }
    calGrid.innerHTML = html;
  }

  function renderTimeSlots() {
    const facility = facilitySelect.value;
    if (!facility || !selectedDateIso) {
      timeSlots.innerHTML = '';
      timeHint.textContent = 'Select a facility and date to see available times.';
      timeHint.classList.remove('hidden');
      return;
    }
    const closure = closureOn(selectedDateIso, closures);
    if (closure) {
      timeSlots.innerHTML = '';
      timeHint.textContent = `The parish is closed on this date (${closure.name}).`;
      timeHint.classList.remove('hidden');
      return;
    }
    timeHint.classList.add('hidden');
    const duration = parseInt(durationSelect.value, 10);
    const blocked = getBookedHours(facility, selectedDateIso);
    let html = '';
    for (let h = BOOKING_DAY_START; h <= BOOKING_DAY_END - duration; h++) {
      let isBooked = false;
      for (let k = h; k < h + duration; k++) if (blocked.has(k)) { isBooked = true; break; }
      html += `
        <button type="button" class="bktime-slot ${isBooked ? 'booked' : ''} ${h === selectedStartHour ? 'selected' : ''}" data-hour="${h}" ${isBooked ? 'disabled' : ''} aria-pressed="${h === selectedStartHour}">
          <span class="bktime-slot-label">${formatHourLabel(h)}–${formatHourLabel(h + duration)}</span>
          <span class="bktime-slot-status">${isBooked ? 'Booked' : 'Available'}</span>
        </button>`;
    }
    timeSlots.innerHTML = html || `<p class="bkcal-hint">No ${duration}-hour slot is free on this date. Try a shorter duration or another date.</p>`;
  }

  calGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.bkcal-day[data-date]');
    if (!cell || cell.disabled) return;
    selectedDateIso = cell.dataset.date;
    selectedStartHour = null;
    $('bkcal-wrap').classList.remove('has-error');
    renderCalendar();
    renderTimeSlots();
    scrollToFooter(); // the date is the last question on this step
  });
  timeSlots.addEventListener('click', (e) => {
    const btn = e.target.closest('.bktime-slot[data-hour]:not(.booked)');
    if (!btn) return;
    selectedStartHour = parseInt(btn.dataset.hour, 10);
    timeSlots.classList.remove('has-error');
    renderTimeSlots();
    scrollToQuestion('q-purpose');
  });
  $('bkcal-prev').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); });
  $('bkcal-next').addEventListener('click', () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); });
  facilitySelect.addEventListener('change', () => { clearFieldError(facilitySelect); selectedStartHour = null; renderCalendar(); renderTimeSlots(); scrollToQuestion('q-date'); });
  durationSelect.addEventListener('change', () => { selectedStartHour = null; renderTimeSlots(); scrollToQuestion('q-time'); });
  [purposeInput, requesterInput].filter(Boolean).forEach(el => el.addEventListener('input', () => clearFieldError(el)));

  const times = () => {
    const duration = parseInt(durationSelect.value, 10);
    return {
      duration,
      start: formatTime12(`${pad2(selectedStartHour)}:00`),
      end: formatTime12(`${pad2(selectedStartHour + duration)}:00`),
    };
  };

  function goToStep(next) {
    step = next;
    stepEls.forEach(el => el.classList.toggle('hidden', parseInt(el.dataset.step, 10) !== step));
    stepIndicators.forEach(el => {
      const s = parseInt(el.dataset.stepIndicator, 10);
      el.classList.toggle('active', s === step);
      el.classList.toggle('done', s < step);
    });
    backBtn.textContent = step === 1 ? 'Cancel' : 'Back';
    nextBtn.textContent = step === 3 ? 'Save Booking' : 'Next';
    if (step === 3) {
      const { duration, start, end } = times();
      confirmGrid.innerHTML = `
        <div><p class="so-detail-label">Facility</p><p class="so-detail-value">${esc(facilitySelect.value)}</p></div>
        <div><p class="so-detail-label">Date</p><p class="so-detail-value">${formatShortDate(selectedDateIso)}</p></div>
        <div><p class="so-detail-label">Time</p><p class="so-detail-value">${esc(start)} – ${esc(end)}</p></div>
        <div><p class="so-detail-label">Duration</p><p class="so-detail-value">${duration} hour${duration === 1 ? '' : 's'}</p></div>
        ${requesterInput ? `<div><p class="so-detail-label">Booked For</p><p class="so-detail-value">${esc(requesterInput.value.trim())}</p></div>` : ''}
        <div style="grid-column: 1 / -1;"><p class="so-detail-label">${esc(purposeLabel)}</p><p class="so-detail-value">${esc(purposeInput.value.trim())}</p></div>
        ${attendeesInput.value ? `<div><p class="so-detail-label">Expected Attendees</p><p class="so-detail-value">${esc(attendeesInput.value)}</p></div>` : ''}
        ${notesInput.value.trim() ? `<div style="grid-column: 1 / -1;"><p class="so-detail-label">Notes</p><p class="so-detail-value">${esc(notesInput.value.trim())}</p></div>` : ''}
        ${confirmRows()}`;
    }
    $('booking-fullscreen-body').scrollTop = 0; // on small screens the middle scrolls
  }

  const isOpen = () => !bookingModal.classList.contains('hidden');

  function open() {
    todayISO = localToday();
    [facilitySelect, purposeInput, requesterInput].filter(Boolean).forEach(clearFieldError);
    $('bkcal-wrap').classList.remove('has-error');
    timeSlots.classList.remove('has-error');
    calDate = new Date(todayISO + 'T00:00:00');
    selectedDateIso = todayISO;
    selectedStartHour = null;
    durationSelect.value = String(BOOKING_MIN_HOURS);
    [purposeInput, requesterInput, attendeesInput, notesInput].filter(Boolean).forEach(el => { el.value = ''; });
    facilitySelect.value = '';
    const context = banner();
    contextBox.innerHTML = context;
    contextBox.classList.toggle('hidden', !context);
    renderCalendar();
    renderTimeSlots();
    goToStep(1);
    // Full-screen beside the sidebar (not a modal): fits one screen, locks the page behind it.
    bookingModal.classList.remove('hidden', 'is-closing');
    document.body.classList.add('booking-screen-open');
    facilitySelect.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    document.body.classList.remove('booking-screen-open');
    const finish = () => bookingModal.classList.add('hidden');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    bookingModal.classList.add('is-closing');
    bookingModal.addEventListener('animationend', () => {
      bookingModal.classList.remove('is-closing');
      if (!document.body.classList.contains('booking-screen-open')) finish(); // reopened mid-animation: keep it open
    }, { once: true });
  }

  $('booking-page-back').addEventListener('click', close);
  backBtn.addEventListener('click', () => (step === 1 ? close() : goToStep(step - 1)));
  // Escape leaves the booking screen, unless a dialog on top of the page is open.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen() && !document.querySelector('.modal-overlay:not(.hidden)')) close();
  });

  nextBtn.addEventListener('click', async () => {
    if (step === 1) {
      clearFieldError(facilitySelect);
      $('bkcal-wrap').classList.remove('has-error');
      let valid = true;
      if (!facilitySelect.value) { setFieldError(facilitySelect, 'Please select a facility.'); valid = false; }
      if (!selectedDateIso) { $('bkcal-wrap').classList.add('has-error'); valid = false; }
      if (!valid) { showToast('Please fix the highlighted fields.', true); return; }
      goToStep(2);
      return;
    }
    if (step === 2) {
      [purposeInput, requesterInput].filter(Boolean).forEach(clearFieldError);
      timeSlots.classList.remove('has-error');
      let valid = true;
      if (requesterInput && !requesterInput.value.trim()) { setFieldError(requesterInput, 'Who is this booking for?'); valid = false; }
      if (!purposeInput.value.trim()) { setFieldError(purposeInput, 'Please give the purpose or event name.'); valid = false; }
      if (selectedStartHour === null) { timeSlots.classList.add('has-error'); valid = false; }
      if (!valid) { showToast('Please fix the highlighted fields.', true); return; }
      goToStep(3);
      return;
    }

    // Step 3 — confirm & save. Another admin could have booked this exact
    // slot while the screen was open, so check once more right before saving.
    const facility = facilitySelect.value;
    const { duration, start, end } = times();
    const blockedNow = getBookedHours(facility, selectedDateIso);
    for (let h = selectedStartHour; h < selectedStartHour + duration; h++) {
      if (blockedNow.has(h)) {
        showToast('That time was just booked by someone else — please pick another slot.', true);
        selectedStartHour = null;
        goToStep(2);
        renderTimeSlots();
        return;
      }
    }

    nextBtn.disabled = true;
    try {
      const attendees = parseInt(attendeesInput.value, 10);
      const record = buildRecord({
        facilityName: facility,
        ...(requesterInput ? { requesterName: requesterInput.value.trim() } : {}),
        ...(attendees > 0 ? { attendees } : {}),
        ...(notesInput.value.trim() ? { notes: notesInput.value.trim() } : {}),
        purpose: purposeInput.value.trim(),
        date: selectedDateIso,
        startTime: start,
        endTime: end,
        status: 'approved', // confirmed instantly — the slot picker already rules out conflicts
      });
      const result = await client.models.FacilityBooking.create(record);
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      close();
      showToast(savedMessage(record));
      onSaved(result.data || record);
    } catch (err) {
      console.error('Failed to save booking:', err);
      showToast(err.message || "Couldn't save the booking.", true);
    } finally {
      nextBtn.disabled = false;
    }
  });

  return {
    open,
    close,
    isOpen,
    /** Bookings changed (another admin booked): re-check what's still free. */
    refresh() { if (isOpen()) { renderCalendar(); renderTimeSlots(); } },
  };
}
