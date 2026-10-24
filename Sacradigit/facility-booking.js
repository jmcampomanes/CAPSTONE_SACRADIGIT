/* ============================================
   SacraDigit Admin — Facility Booking Scripts (AWS Amplify)
   Backed by the FacilityBooking model.
   facilityName/purpose/date/startTime/status map
   directly; "Cancel" deletes the record (matching
   the original splice-out behavior) rather than
   using the 'declined' status, since declined is
   meant for requests never approved in the first place.

   Bookings are confirmed instantly ('approved') on
   both the parishioner and admin side — the hourly
   slot picker prevents conflicts, so Approve only
   remains for older 'pending' bookings. Parish
   closures block dates, and cancellations are
   written to the AccessLog audit trail.
   ============================================ */

import { client } from '../amplify-init.js';
import { logBookingAction } from '../service-schedule.js';
import { createBookingWizard } from './booking-wizard.js';
import { readMinistry } from './ministry-booking.js';
import { showToast, reportEmail } from './admin-ui.js';
import { trackArrivals, isFresh } from '../motion.js'; // new rows arrive gold (motion-guide.html)
import { notifyServiceUpdate } from '../email-notify.js';

document.addEventListener('DOMContentLoaded', () => {

  function toLocalISODate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todayISO = toLocalISODate();

  // The parish's two bookable facilities — keep in step with
  // user/user-facility-booking.js. (Older bookings may still name a
  // facility that was removed; they keep showing under that name.)
  const facilities = [
    'Multi-Purpose Hall',
    '3rd Floor Hall',
  ];

  let bookings = []; // kept in sync via observeQuery, each has .id

  const tbody          = document.getElementById('bookings-tbody');
  const bookingsEmpty   = document.getElementById('bookings-empty');
  const bookingsCount   = document.getElementById('bookings-count');

  const badgeClass = { pending: 'badge-amber', approved: 'badge-green' };
  const statusLabel = { pending: 'Pending', approved: 'Confirmed', declined: 'Cancelled' };

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
  // Where a booking's emails go (saved when the parishioner booked) and how it reads in them.
  function bookingEmailFields(b) {
    return {
      to: b.email || '', name: b.requesterName, serviceType: `${b.facilityName} booking`,
      date: new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      time: b.startTime ? formatTimeRange(b) : '', location: b.facilityName,
    };
  }

  function formatTimeRange(b) {
    if (!b.startTime) return '—';
    return b.endTime ? `${b.startTime} – ${b.endTime}` : b.startTime;
  }


  /* --- Live data --- */
  client.models.FacilityBooking.observeQuery().subscribe({
    next: ({ items, isSynced }) => {
      bookings = items;
      trackArrivals('bookings', items.map(b => b.id), isSynced);
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
    document.getElementById('stat-pending').textContent = bookings.filter(b => b.status === 'pending' && !readMinistry(b)?.waiting).length; // waiting ministry bookings are verified on Ministry Bookings
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
      const ministry = readMinistry(b); // no-fee booking for someone who serves the parish
      let actionsHtml = '';
      if (ministry?.waiting) {
        // Verified on Ministry Bookings (Head Admin), never approved from here.
        actionsHtml = `
          <div class="row-actions">
            <a class="act-btn" href="ministry-bookings.html">Verify in Ministry Bookings</a>
            <button type="button" class="act-btn row-view" data-id="${b.id}">View</button>
          </div>`;
      } else if (b.status === 'pending') {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="act-btn act-approve row-approve" data-id="${b.id}">Approve</button>
            <button type="button" class="act-btn row-view" data-id="${b.id}">View</button>
            <button type="button" class="act-btn act-danger row-reject" data-id="${b.id}">Cancel…</button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="act-btn row-view" data-id="${b.id}">View</button>
            <button type="button" class="act-btn act-danger row-reject" data-id="${b.id}">Cancel…</button>
          </div>`;
      }

      return `
        <tr${isFresh('bookings', b.id) ? ' class="sd-row-new"' : ''}>
          <td class="font-medium text-gray-900">${escapeHtml(b.facilityName)}${ministry ? ` <span class="mb-fee">Ministry · No fee</span>` : ''}${b.requesterName ? `<span class="mb-sub">${escapeHtml(b.requesterName)}</span>` : ''}</td>
          <td>${formatShortDate(b.date)}</td>
          <td>${escapeHtml(formatTimeRange(b))}</td>
          <td>${ministry?.waiting ? '<span class="badge badge-amber">Waiting to verify</span>' : `<span class="badge ${badgeClass[b.status] || 'badge-gray'}" data-sd-status="s-${b.id}:${b.status}">${statusLabel[b.status] || b.status}</span>`}</td>
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
        const doneMsg = `Booking for ${b ? b.facilityName : 'facility'} approved.`;
        if (b) {
          reportEmail(notifyServiceUpdate({
            ...bookingEmailFields(b), status: 'approved',
            detailsLines: [b.purpose && `Purpose: ${b.purpose}`, b.attendees && `Attendees: ${b.attendees}`].filter(Boolean),
          }), b.requesterName, doneMsg);
        } else showToast(doneMsg);
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
      if (removed) {
        logBookingAction(client, {
          action: 'Cancel',
          record: { type: removed.facilityName, requesterName: removed.requesterName || 'Parish office', date: removed.date, time: removed.startTime },
        });
      }
      closeModal(cancelModal);
      const doneMsg = `Booking for ${removed ? removed.facilityName : 'facility'} cancelled.`;
      // Office-made bookings (no requester email) just get the toast.
      if (removed?.email) {
        reportEmail(notifyServiceUpdate({ ...bookingEmailFields(removed), status: 'cancelled' }), removed.requesterName, doneMsg);
      } else showToast(doneMsg);
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
    const ministry = readMinistry(b);
    if (ministry) detailsFacility.insertAdjacentHTML('beforeend', ` <span class="mb-fee">Ministry · No fee</span>`);
    detailsDate.textContent = formatShortDate(b.date);
    detailsTime.textContent = formatTimeRange(b);
    detailsPurpose.textContent = [b.purpose || '—', ministry && `For ${b.requesterName} (${ministry.group}) — see Ministry Bookings.`].filter(Boolean).join(' · ');

    // Who it's for, attendees and notes (same details the parishioner's booking form asks for).
    const grid = detailsPurpose.closest('.so-detail-grid');
    grid.querySelectorAll('.fb-extra').forEach(el => el.remove());
    const extra = (label, value, wide) => value ? grid.insertAdjacentHTML('beforeend', `<div class="fb-extra"${wide ? ' style="grid-column: 1 / -1;"' : ''}><p class="so-detail-label">${label}</p><p class="so-detail-value">${escapeHtml(String(value))}</p></div>`) : null;
    extra('Booked For', b.requesterName);
    extra('Expected Attendees', b.attendees);
    extra('Notes', ministry ? ministry.note : b.notes, true);

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
    bookingWizard.refresh();
  }


  /* --- New booking screen (shared with Ministry Bookings: booking-wizard.js) --- */
  const bookingWizard = createBookingWizard({
    client,
    facilities,
    getBookings: () => bookings,
    showToast,
  });
  document.getElementById('btn-new-booking').addEventListener('click', () => bookingWizard.open());

  const dialogModals = [cancelModal, detailsModal, dayPlanModal];

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => dialogModals.forEach(closeModal));
  });

  dialogModals.forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  // Escape closes an open dialog (the booking screen handles its own Escape when no dialog is open).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openDialogs = dialogModals.filter(m => !m.classList.contains('hidden'));
    if (openDialogs.length) openDialogs.forEach(closeModal);
  });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

});