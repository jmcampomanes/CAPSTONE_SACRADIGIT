/* ============================================
   SacraDigit Admin — Schedule Offers Scripts (AWS Amplify)
   Runs after dashboard.js.

   Backed by the same Blessing model as Sacradigit/blessings.js and
   user/user-request-service.js — despite the model's name, it's used
   as the general parishioner service-request record for everything in
   user-request-service.js's catalog (sacraments, special masses, and
   literal blessings alike), so this page reviews all of it, not just
   blessings. Status mapping matches user-requested-services.js exactly:
   scheduled -> Scheduled, completed -> Completed, declined -> Cancelled,
   pending -> Pending.

   Parishioners now book fixed slots (../service-schedule.js), so new
   records arrive already 'scheduled'. Reschedule only shows for older
   'pending' rows (it books them at a new date/time with a reason);
   upcoming bookings get a Cancel action instead.
   ============================================ */

import { client } from '../amplify-init.js';
import { logBookingAction, createReasonField, detailsWithRescheduleReason, createSlotPicker, slotHasRoom, locationFor, watchClosures, RESCHEDULE_REASON_LABEL, MAP_PIN_LABEL, googleMapsUrl } from '../service-schedule.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  let offers = []; // kept in sync via observeQuery, each has .id
  let closures = []; // 'No Services (Parish Closed)' date ranges from Special Schedules

  watchClosures(client, (next) => {
    closures = next;
    if (reschedulePicker) reschedulePicker.setClosures(closures);
  });

  const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', declined: 'Cancelled', completed: 'Completed' };
  const badgeClass = { Pending: 'badge-amber', Scheduled: 'badge-green', Cancelled: 'badge-red', Completed: 'badge-blue' };

  const tbody       = document.getElementById('offers-tbody');
  const offersEmpty  = document.getElementById('offers-empty');
  const resultsCount  = document.getElementById('results-count');
  const searchInput   = document.getElementById('search-input');
  const typeFilter     = document.getElementById('type-filter');
  const statusFilter    = document.getElementById('status-filter');

  function escapeHtml(str) {
    const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // record.details is stored as an AWSJSON string (see
  // user-request-service.js's create() call) — parse it defensively,
  // since a malformed or missing value shouldn't break the row/modal.
  function parseDetails(record) {
    if (!record.details) return {};
    if (typeof record.details !== 'string') return record.details;
    try {
      const parsed = JSON.parse(record.details);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // A detail value can be a plain string, or a { firstName, middleName,
  // lastName, extension } name object (see name-utils.js) for any
  // name-kind field in the request form.
  function formatDetailValue(value) {
    if (value && typeof value === 'object') {
      return [value.firstName, value.middleName, value.lastName].filter(Boolean).join(' ') +
        (value.extension ? ` ${value.extension}` : '');
    }
    return value;
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
  client.models.Blessing.observeQuery().subscribe({
    next: ({ items }) => {
      offers = items;
      renderTypeFilterOptions();
      renderStats();
      renderTable();
      if (reschedulePicker) reschedulePicker.refresh(offers);
    },
    error: (err) => {
      console.error('Failed to load schedule requests:', err);
      tbody.innerHTML = '';
      offersEmpty.classList.remove('hidden');
      offersEmpty.querySelector('p').textContent = "Couldn't load schedule requests from the database.";
    },
  });

  // Built from whatever service types actually exist in the live data
  // (rather than a hardcoded list) so it can never drift out of sync
  // with user-request-service.js's catalog of requestable services.
  let lastTypeOptions = null;
  function renderTypeFilterOptions() {
    const types = [...new Set(offers.map(o => o.type).filter(Boolean))].sort();
    const key = types.join('|');
    if (key === lastTypeOptions) return; // avoid clobbering an open selection on every live update
    lastTypeOptions = key;

    const current = typeFilter.value;
    typeFilter.innerHTML = `<option value="">All Services</option>` +
      types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if (types.includes(current)) typeFilter.value = current;
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    const weekStart = new Date(todayISO + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekCount = offers.filter(o => {
      if (!o.date) return false;
      const d = new Date(o.date + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    }).length;

    document.getElementById('stat-total').textContent    = offers.length;
    document.getElementById('stat-pending').textContent  = offers.filter(o => o.status === 'pending').length;
    document.getElementById('stat-approved').textContent = offers.filter(o => o.status === 'scheduled').length;
    document.getElementById('stat-week').textContent     = weekCount;

    updateActiveStatCard();
  }

  /* ------------------------------------------
     1b. STAT CARDS AS QUICK FILTERS
     Total clears the status filter; Pending /
     Approved set it and jump straight to the
     matching rows. "This Week" isn't a status,
     so it stays informational only.
  ------------------------------------------ */
  const statCardTotal    = document.getElementById('stat-total').closest('.stat-card');
  const statCardPending  = document.getElementById('stat-pending').closest('.stat-card');
  const statCardApproved = document.getElementById('stat-approved').closest('.stat-card');

  const statCardsByStatus = [
    { card: statCardTotal,    status: '' },
    { card: statCardPending,  status: 'Pending' },
    { card: statCardApproved, status: 'Scheduled' },
  ];

  statCardsByStatus.forEach(({ card, status }) => {
    card.classList.add('stat-card-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => {
      statusFilter.value = status;
      renderTable();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        statusFilter.value = status;
        renderTable();
      }
    });
  });

  function updateActiveStatCard() {
    statCardsByStatus.forEach(({ card, status }) => {
      card.classList.toggle('stat-card-active', statusFilter.value === status);
    });
  }


  /* ------------------------------------------
     2. RENDER TABLE
  ------------------------------------------ */
  function renderTable() {
    const query     = searchInput.value.trim().toLowerCase();
    const typeVal    = typeFilter.value;
    const statusVal   = statusFilter.value;

    updateActiveStatCard();

    const filtered = offers.filter(o => {
      const label = statusLabel[o.status] || o.status;
      const matchQuery  = !query || (o.requesterName || '').toLowerCase().includes(query) || (o.type || '').toLowerCase().includes(query);
      const matchType    = !typeVal   || o.type === typeVal;
      const matchStatus  = !statusVal || label  === statusVal;
      return matchQuery && matchType && matchStatus;
    });

    const sorted = filtered.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    resultsCount.textContent = `${sorted.length} request${sorted.length === 1 ? '' : 's'}`;

    if (sorted.length === 0) {
      tbody.innerHTML = '';
      offersEmpty.querySelector('p').textContent = 'No requests match your filters';
      offersEmpty.classList.remove('hidden');
      return;
    }
    offersEmpty.classList.add('hidden');

    tbody.innerHTML = sorted.map(o => {
      const label = statusLabel[o.status] || o.status;

      let actionsHtml = '';
      if (o.status === 'pending') {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-view" data-id="${o.id}">View ›</button>
            <button type="button" class="row-reschedule" data-id="${o.id}">Reschedule</button>
          </div>`;
      } else if (o.status === 'scheduled' && (o.date || '') >= todayISO) {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-view" data-id="${o.id}">View ›</button>
            <button type="button" class="row-reject row-cancel" data-id="${o.id}">Cancel</button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-view" data-id="${o.id}">View ›</button>
          </div>`;
      }

      return `
        <tr>
          <td class="font-medium text-gray-900">${escapeHtml(o.requesterName)}</td>
          <td>
            <span class="service-type-tag">${escapeHtml(o.type)}</span>
          </td>
          <td>
            ${o.date
              ? `${fmtDate(o.date)}${o.time ? `<span class="text-gray-400"> · ${escapeHtml(o.time)}</span>` : ''}`
              : `${fmtDate(o.preferredDate)} <span class="text-gray-400">(preferred)</span>`}
          </td>
          <td class="text-gray-400">${fmtDateTime(o.createdAt)}</td>
          <td><span class="badge ${badgeClass[label] || 'badge-gray'}">${escapeHtml(label)}</span></td>
          <td class="text-right">${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  }

  // Wire filters
  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);
  statusFilter.addEventListener('change', renderTable);
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value   = '';
    statusFilter.value  = '';
    renderTable();
  });

  // Delegate row actions
  tbody.addEventListener('click', e => {
    const rescheduleBtn = e.target.closest('.row-reschedule');
    const rejectBtn   = e.target.closest('.row-reject');
    const viewBtn      = e.target.closest('.row-view');

    if (rescheduleBtn) openRescheduleScreen(rescheduleBtn.dataset.id);
    if (rejectBtn)  openRejectModal(rejectBtn.dataset.id, { cancelBooking: rejectBtn.classList.contains('row-cancel') });
    if (viewBtn)    openViewModal(viewBtn.dataset.id);
  });


  /* ------------------------------------------
     3. RESCHEDULE SCREEN
     Books a pending request at another fixed
     slot, on a full-screen view beside the
     sidebar (request on the left, calendar on
     the right) — same as the Blessings page.
     The office isn't bound by the parishioner
     lead-time rule (ignoreLead).
  ------------------------------------------ */
  const rescheduleScreen    = document.getElementById('reschedule-screen');
  const reschedulePickerEl  = document.getElementById('reschedule-slot-picker');
  const rescheduleSummary   = document.getElementById('reschedule-summary');
  const rescheduleSubmitBtn = document.getElementById('reschedule-submit');
  const rescheduleReason    = createReasonField(document.getElementById('reschedule-reason-wrap'));

  let rescheduleTargetId = null;
  let reschedulePicker = null;

  function rescheduleFactsHtml(o) {
    const fact = (label, value) => `<div><p class="svc-screen-fact-label">${escapeHtml(label)}</p><p class="svc-screen-fact-value">${escapeHtml(value)}</p></div>`;
    const extra = Object.entries(parseDetails(o))
      .map(([k, v]) => [k === RESCHEDULE_REASON_LABEL ? 'Last Rescheduled' : k, formatDetailValue(v)])
      .filter(([, v]) => v)
      .map(([k, v]) => fact(k, v));
    return [
      fact('Requester', o.requesterName),
      fact('Location', o.location || locationFor(o.type, parseDetails(o))),
      ...(o.contact ? [fact('Contact', o.contact)] : []),
      fact('Submitted', fmtDateTime(o.createdAt)),
      ...extra,
    ].join('');
  }

  function openRescheduleScreen(id) {
    const o = offers.find(x => x.id === id);
    if (!o) return;
    rescheduleTargetId = id;

    document.getElementById('reschedule-title').textContent = `Reschedule — ${o.type}`;
    document.getElementById('reschedule-sub').textContent = `For ${o.requesterName}`;
    document.getElementById('reschedule-current').textContent =
      `${fmtDate(o.preferredDate || o.date)}${o.time ? ` at ${o.time}` : ''}`;
    document.getElementById('reschedule-facts').innerHTML = rescheduleFactsHtml(o);

    rescheduleReason.reset();
    rescheduleSummary.classList.add('hidden');
    reschedulePickerEl.classList.remove('has-error');
    reschedulePicker = createSlotPicker(reschedulePickerEl, {
      type: o.type,
      records: offers,
      closures,
      excludeId: id,
      ignoreLead: true,
      layout: 'calendar',
      onChange: (slot) => {
        reschedulePickerEl.classList.remove('has-error');
        rescheduleSummary.classList.toggle('hidden', !slot);
        if (slot) rescheduleSummary.textContent = `New schedule: ${fmtDate(slot.date)} at ${slot.time}`;
      },
    });

    rescheduleScreen.classList.remove('hidden', 'is-closing');
    document.body.classList.add('svc-screen-open');
    document.getElementById('reschedule-body').scrollTop = 0;
  }

  function closeRescheduleScreen() {
    if (rescheduleScreen.classList.contains('hidden')) return;
    rescheduleTargetId = null;
    reschedulePicker = null;
    document.body.classList.remove('svc-screen-open');
    const finish = () => rescheduleScreen.classList.add('hidden');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    rescheduleScreen.classList.add('is-closing');
    rescheduleScreen.addEventListener('animationend', () => {
      rescheduleScreen.classList.remove('is-closing');
      if (!document.body.classList.contains('svc-screen-open')) finish(); // reopened mid-animation
    }, { once: true });
  }

  document.getElementById('reschedule-back').addEventListener('click', closeRescheduleScreen);
  document.getElementById('reschedule-cancel').addEventListener('click', closeRescheduleScreen);

  rescheduleSubmitBtn.addEventListener('click', async () => {
    const o = offers.find(x => x.id === rescheduleTargetId);
    const slot = reschedulePicker && reschedulePicker.getValue();
    const reason = rescheduleReason.value();
    if (!o) return;
    if (!reason) { rescheduleReason.showError(); showToast('Please give a reason for rescheduling.', true); return; }
    if (!slot) { reschedulePickerEl.classList.add('has-error'); showToast('Please pick a new date and time.', true); return; }
    if (!slotHasRoom(o.type, offers, slot.date, slot.time, { excludeId: o.id, closures })) {
      showToast('That slot was just taken. Please pick another.', true);
      reschedulePicker.refresh(offers);
      return;
    }

    rescheduleSubmitBtn.disabled = true;
    try {
      const result = await client.models.Blessing.update({
        id: o.id,
        status: 'scheduled',
        date: slot.date,
        time: slot.time,
        location: o.location || locationFor(o.type, parseDetails(o)),
        details: detailsWithRescheduleReason(o.details, reason, 'Parish Office'),
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      logBookingAction(client, { action: 'Reschedule', record: { ...o, date: slot.date, time: slot.time }, reason: `${reason} (from pending request)` });
      closeRescheduleScreen();
      showToast(`${o.type} for ${o.requesterName} rescheduled to ${fmtDate(slot.date)} at ${slot.time}.`);
    } catch (err) {
      console.error('Failed to reschedule request:', err);
      showToast(err.message || "Couldn't reschedule request.", true);
    } finally {
      rescheduleSubmitBtn.disabled = false;
    }
  });


  /* ------------------------------------------
     4. REJECT MODAL
  ------------------------------------------ */
  const rejectModal  = document.getElementById('reject-modal');
  const rejectName    = document.getElementById('reject-name');
  const rejectReason   = document.getElementById('reject-reason');
  const rejectTitle    = document.getElementById('reject-title');
  const rejectVerb     = document.getElementById('reject-verb');
  const rejectSubmitBtn = document.getElementById('reject-submit');
  let rejectTargetId = null;
  let rejectIsCancel = false;

  // Also used to cancel a booked slot — status 'declined' frees the
  // slot and shows the reason to the parishioner.
  function openRejectModal(id, { cancelBooking = false } = {}) {
    const o = offers.find(x => x.id === id);
    if (!o) return;
    rejectTargetId = id;
    rejectIsCancel = cancelBooking;
    rejectTitle.textContent = cancelBooking ? 'Cancel Booking' : 'Decline Request';
    rejectVerb.textContent = cancelBooking
      ? `Cancelling the ${o.type} booking on ${fmtDate(o.date)}${o.time ? ` at ${o.time}` : ''} for`
      : 'Declining request from';
    rejectSubmitBtn.textContent = cancelBooking ? 'Cancel Booking' : 'Decline Request';
    rejectName.textContent = o.requesterName;
    rejectReason.value      = '';
    clearFieldError(rejectReason);
    openModal(rejectModal);
  }

  rejectReason.addEventListener('input', () => clearFieldError(rejectReason));

  document.getElementById('reject-submit').addEventListener('click', async () => {
    if (rejectTargetId === null) return;
    const reason = rejectReason.value.trim();
    if (!reason) {
      setFieldError(rejectReason, rejectIsCancel ? 'Please tell the parishioner why it was cancelled.' : 'Please provide a reason for declining.');
      showToast('Please fix the highlighted fields.', true);
      return;
    }
    clearFieldError(rejectReason);

    const o = offers.find(x => x.id === rejectTargetId);
    const submitBtn = document.getElementById('reject-submit');
    submitBtn.disabled = true;

    try {
      const result = await client.models.Blessing.update({
        id: rejectTargetId,
        status: 'declined',
        declineReason: reason,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal(rejectModal);
      logBookingAction(client, { action: rejectIsCancel ? 'Cancel' : 'Decline', record: o, reason });
      showToast(rejectIsCancel
        ? `Booking for ${o ? o.requesterName : 'requester'} cancelled — the slot is open again.`
        : `Request from ${o ? o.requesterName : 'requester'} declined.`);
      rejectTargetId = null;
    } catch (err) {
      console.error('Failed to decline request:', err);
      showToast(err.message || "Couldn't decline request.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });


  /* ------------------------------------------
     5. VIEW DETAILS MODAL
     One label/value table, grouped into
     Schedule, Requester, Request Information,
     and Reasons & Notes (each group only when
     it has rows). The footer offers the same
     action as the row (Reschedule for pending,
     Cancel Booking for upcoming).
  ------------------------------------------ */
  const viewModal            = document.getElementById('view-modal');
  const viewType              = document.getElementById('view-type');
  const viewName              = document.getElementById('view-name');
  const viewStatusBadge       = document.getElementById('view-status-badge');
  const viewTable             = document.getElementById('view-table');
  const viewRescheduleBtn     = document.getElementById('view-reschedule');
  const viewCancelBookingBtn  = document.getElementById('view-cancel-booking');
  let viewTargetId = null;

  const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';

  /** One <tbody> per group: a header row, then label/value rows.
      rows: [label, valueHtml, extraClass?] — valueHtml must already be escaped. */
  function tableGroupHtml(title, rows) {
    if (!rows.length) return '';
    return `
      <tbody>
        <tr class="vd-group"><th colspan="2" scope="colgroup">${escapeHtml(title)}</th></tr>
        ${rows.map(([label, valueHtml, cls]) => `
          <tr${cls ? ` class="${cls}"` : ''}>
            <th scope="row">${escapeHtml(label)}</th>
            <td>${valueHtml}</td>
          </tr>`).join('')}
      </tbody>`;
  }

  function openViewModal(id) {
    const o = offers.find(x => x.id === id);
    if (!o) return;
    viewTargetId = id;

    const label = statusLabel[o.status] || o.status;
    const details = parseDetails(o);

    viewType.textContent = o.type || 'Service Request';
    viewName.textContent = o.requesterName || '—';
    viewStatusBadge.textContent = label;
    viewStatusBadge.className = `badge ${badgeClass[label] || 'badge-gray'}`;

    const longDate = (iso) => new Date(iso + 'T00:00:00')
      .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const scheduleRows = [];
    if (o.date) {
      scheduleRows.push([o.status === 'declined' ? 'Was Scheduled For' : 'Confirmed Date', escapeHtml(longDate(o.date))]);
    }
    if (o.time) scheduleRows.push(['Time', escapeHtml(o.time)]);
    if (o.preferredDate && o.preferredDate !== o.date) {
      scheduleRows.push([o.date ? 'Originally Preferred' : 'Preferred Date (not yet booked)', escapeHtml(longDate(o.preferredDate))]);
    }
    const location = o.location || (o.date ? locationFor(o.type, details) : '');
    if (location) scheduleRows.push(['Location', escapeHtml(location)]);
    if (!scheduleRows.length) scheduleRows.push(['Date', 'No date yet']);

    const requesterRows = [
      ['Name', escapeHtml(o.requesterName) || '—'],
      ['Contact', escapeHtml(o.contact) || '—'],
      ['Submitted', fmtDateTime(o.createdAt)],
    ];

    const infoRows = Object.entries(details)
      .filter(([k]) => k !== RESCHEDULE_REASON_LABEL && k !== MAP_PIN_LABEL)
      .map(([k, v]) => [k, formatDetailValue(v)])
      .filter(([, v]) => hasValue(v))
      .map(([k, v]) => [k, escapeHtml(v)]);
    const pin = details[MAP_PIN_LABEL];
    if (pin) {
      infoRows.push(['Pinned Location',
        `<a href="${escapeHtml(googleMapsUrl(pin))}" target="_blank" rel="noopener" class="map-pin-link">Open in Google Maps ↗</a>`]);
    }

    const noteRows = [];
    if (o.status === 'declined') noteRows.push(['Cancellation Reason', escapeHtml(o.declineReason || 'No reason given'), 'vd-row-red']);
    const rescheduled = formatDetailValue(details[RESCHEDULE_REASON_LABEL]);
    if (hasValue(rescheduled)) noteRows.push(['Last Rescheduled', escapeHtml(rescheduled), 'vd-row-lavender']);
    if (hasValue(o.notes)) noteRows.push(['Notes', escapeHtml(o.notes)]);

    viewTable.innerHTML =
      tableGroupHtml('Schedule', scheduleRows) +
      tableGroupHtml('Requester', requesterRows) +
      tableGroupHtml('Request Information', infoRows) +
      tableGroupHtml('Reasons & Notes', noteRows);

    viewRescheduleBtn.classList.toggle('hidden', o.status !== 'pending');
    viewCancelBookingBtn.classList.toggle('hidden', !(o.status === 'scheduled' && (o.date || '') >= todayISO));

    openModal(viewModal);
  }

  viewRescheduleBtn.addEventListener('click', () => {
    if (!viewTargetId) return;
    closeModal(viewModal);
    openRescheduleScreen(viewTargetId);
  });

  viewCancelBookingBtn.addEventListener('click', () => {
    if (!viewTargetId) return;
    closeModal(viewModal);
    openRejectModal(viewTargetId, { cancelBooking: true });
  });


  /* ------------------------------------------
     6. MODAL HELPERS
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(rejectModal);
      closeModal(viewModal);
    });
  });

  [rejectModal, viewModal].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal(rejectModal);
      closeModal(viewModal);
      closeRescheduleScreen();
    }
  });

  function openModal(m) {
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(m) {
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
  }


  /* ------------------------------------------
     7. TOAST
  ------------------------------------------ */
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