/* ============================================
   SacraDigit — User Requested Services Scripts (AWS Amplify)
   Runs after user-shell.js.
   The tracking log for service/blessing requests —
   split out of user-request-service.js, which now
   only handles browsing services and submitting a
   new request. Backed by the same Blessing model.
   This is also where blessings are tracked (the old
   separate Blessings page was folded in) — the chips
   above the list filter by category.
   New requests book a fixed slot (see ../service-schedule.js):
   sacraments/special Masses are 'scheduled' right away,
   blessings wait as 'pending' for the parish office.
   Status mapping: scheduled -> Scheduled, completed ->
   Completed, declined -> Cancelled / Not Approved (by the
   parish, or cancelled by the parishioner — declineReason
   says which), pending -> Awaiting Approval.
   Filters client-side by requesterName === hardcoded
   demo name (matches user-request-service.js).
   ============================================ */

import { client } from '../amplify-init.js';
import { watchTakenSlots, fetchTakenSlots } from '../public-data.js';
import { currentUserName } from '../auth.js';
import { isPrepKey, checklistHtml, progressChipHtml } from '../sacrament-prep.js';
import { formatFullName, isNameEmpty } from '../name-utils.js';
import { SERVICE_TYPES, needsApproval } from '../service-catalog.js';
import { downloadBookingIcs, MAP_PIN_LABEL, googleMapsUrl, createSlotPicker, slotHasRoom, watchClosures, RESCHEDULE_REASON_LABEL, APPROVED_LABEL, detailsWithRescheduleReason, createReasonField, canReschedule, isPastSchedule } from '../service-schedule.js';

document.addEventListener('DOMContentLoaded', () => {

  function isNameShaped(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v) &&
      ('firstName' in v || 'middleName' in v || 'lastName' in v || 'extension' in v);
  }

  // This page's `details` blob is keyed by field LABEL (not id), and most
  // values are plain strings — except name fields, stored as
  // {firstName, middleName, lastName, extension} objects (see
  // name-utils.js). Returns null to skip a row entirely (an untouched,
  // still-blank optional name field).
  function formatDetailValue(value) {
    if (isNameShaped(value)) return isNameEmpty(value) ? null : formatFullName(value);
    return value === null || value === undefined || value === '' ? null : String(value);
  }

  const REQUESTER_NAME = currentUserName(); // the signed-in parishioner (auth.js)

  // Every service's name, icon and category comes from the shared catalog.
  // Older records may say 'Vehicle Blessing' (renamed 'Vehicle / Item Blessing').
  const serviceByName = name => SERVICE_TYPES.find(s => s.name === name)
    || (name === 'Vehicle Blessing' ? SERVICE_TYPES.find(s => s.id === 'vehicle-blessing') : null);
  const categoryOf = (r) => serviceByName(r.type)?.category || (needsApproval(r.type) ? 'blessing' : 'other');

  const badgeClass  = { pending: 'badge-amber', scheduled: 'badge-green', declined: 'badge-red', completed: 'badge-blue' };
  const statusLabel = { pending: 'Waiting for approval', scheduled: 'Scheduled', declined: 'Cancelled', completed: 'Completed' };

  // A declined request that the parish never approved reads "Not Approved", not "Cancelled".
  // (The admin Blessings page notes APPROVED_LABEL in `details` when it approves one.)
  const notApproved = (r) => r.status === 'declined' && needsApproval(r.type) && !/by the parishioner/i.test(r.declineReason || '') && !detailsWasApproved(r);
  function detailsWasApproved(r) {
    try { return !!JSON.parse(r.details || '{}')[APPROVED_LABEL]; } catch { return false; }
  }
  const labelFor = (r) => notApproved(r) ? 'Not Approved' : (statusLabel[effectiveStatus(r)] || effectiveStatus(r));

  // Category chips above the list ('' = all)
  let categoryFilter = new URLSearchParams(location.search).get('filter') || '';

  // A scheduled request whose date has passed already happened — nothing ever
  // flips it to 'completed' in the database, so it's shown as Completed here
  // instead of sitting as "Scheduled" forever.
  const effectiveStatus = (r) => isPastSchedule(r) ? 'completed' : r.status;

  let myRequests = [];

  const requestsList  = document.getElementById('requests-list');
  const requestsEmpty  = document.getElementById('requests-empty');
  const requestsCount   = document.getElementById('requests-count');

  const detailModal    = document.getElementById('detail-modal');
  const modalStatusBadge  = document.getElementById('modal-status-badge');
  const modalSubmittedDate = document.getElementById('modal-submitted-date');
  const modalDetails          = document.getElementById('modal-details');
  const modalScheduleWrap        = document.getElementById('modal-schedule-wrap');
  const modalScheduleValue          = document.getElementById('modal-schedule-value');
  const modalRejectionWrap             = document.getElementById('modal-rejection-wrap');
  const modalRejection                    = document.getElementById('modal-rejection');
  const modalNotesWrap                       = document.getElementById('modal-notes-wrap');
  const modalNotes                              = document.getElementById('modal-notes');

  const modalCancelBtn    = document.getElementById('modal-cancel-request');
  const modalCalendarBtn  = document.getElementById('modal-add-calendar');
  const cancelRequestModal = document.getElementById('cancel-request-modal');
  const cancelRequestTypeEl = document.getElementById('cancel-request-type');
  const cancelRequestConfirm = document.getElementById('cancel-request-confirm');
  const modalRescheduleBtn = document.getElementById('modal-reschedule');
  const rescheduleScreen   = document.getElementById('reschedule-screen');

  let currentDetailId = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function fmtDate(input) {
    if (!input) return '—';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  // "Tue Oct 28, 9:00 AM" — the year only when it isn't this year.
  function fmtWhen(iso, time) {
    if (!iso) return '';
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    const opts = { weekday: 'short', month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    const date = d.toLocaleDateString('en-US', opts).replace(/^(\w+),/, '$1'); // "Tue, Oct 28" -> "Tue Oct 28"
    return time ? `${date}, ${String(time).replace(/^0(\d)/, '$1')}` : date;
  }
  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }
  function getDetails(r) {
    if (!r.details) return {};
    try { return JSON.parse(r.details); } catch { return {}; }
  }

  client.models.Blessing.observeQuery({ filter: { requesterName: { eq: REQUESTER_NAME } } }).subscribe({
    next: ({ items }) => { myRequests = items; renderStats(); renderList(); },
    error: (err) => {
      console.error('Failed to load requests:', err);
      requestsList.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load requests.</p>`;
    },
  });

  function renderStats() {
    document.getElementById('stat-total').textContent     = myRequests.length;
    document.getElementById('stat-pending').textContent   = myRequests.filter(r => r.status === 'pending').length;
    document.getElementById('stat-approved').textContent  = myRequests.filter(r => effectiveStatus(r) === 'scheduled').length;
    document.getElementById('stat-completed').textContent = myRequests.filter(r => effectiveStatus(r) === 'completed').length;
  }

  const filterBar = document.getElementById('requests-filter');
  const emptyText = requestsEmpty.querySelector('p');
  function paintFilter() {
    filterBar.querySelectorAll('.svc-filter-chip').forEach(chip => {
      const on = chip.dataset.cat === categoryFilter;
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  }
  filterBar.addEventListener('click', (e) => {
    const chip = e.target.closest('.svc-filter-chip');
    if (!chip) return;
    categoryFilter = chip.dataset.cat;
    paintFilter();
    renderList();
  });
  paintFilter();

  function renderList() {
    const shown = categoryFilter ? myRequests.filter(r => categoryOf(r) === categoryFilter) : myRequests;
    requestsCount.textContent = `${shown.length} request${shown.length === 1 ? '' : 's'}`;

    if (shown.length === 0) {
      requestsList.innerHTML = '';
      emptyText.textContent = myRequests.length ? 'Nothing here for this category' : 'No service requests yet';
      requestsEmpty.classList.remove('hidden');
      return;
    }
    requestsEmpty.classList.add('hidden');

    const sorted = shown.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    requestsList.innerHTML = sorted.map((r) => {
      const svc = serviceByName(r.type) || { name: r.type, iconBg: '#eee', iconColor: '#888', icon: '' };
      const when = r.date || r.preferredDate;
      // Big status word + the date: "House Blessing / Waiting for approval / Tue Oct 28, 9:00 AM"
      const tone = notApproved(r) ? 'declined' : effectiveStatus(r);
      const prep = r.status === 'declined' ? '' : progressChipHtml(r);

      return `<div class="svc-row" data-id="${r.id}">
        <div class="svc-row-icon" style="background-color:${svc.iconBg};color:${svc.iconColor};">${svc.icon}</div>
        <div class="svc-row-body">
          <p class="svc-row-title">${escapeHtml(svc.name)}</p>
          <p class="svc-row-status tone-${tone}">${labelFor(r)}</p>
          ${when ? `<p class="svc-row-when">${fmtWhen(when, r.time)}</p>` : ''}
          ${prep ? `<div>${prep}</div>` : ''}
          <p class="svc-row-meta">Submitted ${fmtDate(r.createdAt)}</p>
        </div>
        <div class="svc-row-actions">
          <button type="button" class="btn-view-details" data-id="${r.id}">View details ›</button>
        </div>
      </div>`;
    }).join('');
  }

  // Tapping anywhere on a row opens it (the button is just the obvious target).
  requestsList.addEventListener('click', (e) => {
    if (e.target.closest('a')) return; // e.g. a link inside the prep chip
    const row = e.target.closest('.svc-row');
    if (row) openDetailModal(row.dataset.id);
  });

  function openDetailModal(id) {
    const r = myRequests.find(x => x.id === id);
    if (!r) return;
    const svc = serviceByName(r.type) || { name: r.type };
    const details = getDetails(r);

    currentDetailId = id;
    // Pending requests, and booked slots that haven't happened yet, can
    // be cancelled — status 'declined' frees the slot for someone else and
    // keeps the record, so the parish office still sees it was cancelled.
    const todayISO = new Date().toLocaleDateString('en-CA');
    const cancellable = r.status === 'pending' || (r.status === 'scheduled' && (r.date || '') >= todayISO);
    modalCancelBtn.classList.toggle('hidden', !cancellable);
    modalCalendarBtn.classList.toggle('hidden', !(r.status === 'scheduled' && r.date && r.time && r.date >= todayISO));
    // Rescheduling closes a day earlier than cancelling: only up to the day before the booking.
    modalRescheduleBtn.classList.toggle('hidden', !(r.status === 'pending' || canReschedule(r)));

    document.getElementById('detail-modal-title').textContent = `${svc.name} Request`;
    modalStatusBadge.textContent = labelFor(r);
    modalStatusBadge.className = `badge ${notApproved(r) ? 'badge-red' : (badgeClass[effectiveStatus(r)] || 'badge-gray')}`;
    modalSubmittedDate.textContent = `Submitted ${fmtDate(r.createdAt)}`;

    modalDetails.innerHTML = Object.entries(details)
      .filter(([label]) => !isPrepKey(label))
      .map(([label, value]) => [label, formatDetailValue(value)])
      .filter(([, value]) => value)
      .map(([label, value]) => label === MAP_PIN_LABEL
        ? `
        <div><p class="modal-detail-item-label">Pinned Location</p><p class="modal-detail-item-value"><a href="${escapeHtml(googleMapsUrl(value))}" target="_blank" rel="noopener" class="map-pin-link">Open in Google Maps ↗</a></p></div>`
        : label === RESCHEDULE_REASON_LABEL
        ? `
        <div style="grid-column: 1 / -1;"><p class="modal-detail-item-label">Rescheduled</p><p class="modal-detail-item-value">${escapeHtml(value)}</p></div>`
        : `
        <div><p class="modal-detail-item-label">${escapeHtml(label)}</p><p class="modal-detail-item-value">${escapeHtml(value)}</p></div>`).join('') + `
      ${r.status === 'pending'
        ? `<div style="grid-column: 1 / -1;"><p class="modal-detail-item-label">Requested Slot</p><p class="modal-detail-item-value">${fmtDate(r.preferredDate || r.date)}${r.time ? ` at ${escapeHtml(r.time)}` : ''} — waiting for the parish office to approve</p></div>`
        : r.date ? '' : `<div><p class="modal-detail-item-label">Preferred Date</p><p class="modal-detail-item-value">${fmtDate(r.preferredDate)}</p></div>`}
      <div><p class="modal-detail-item-label">Contact</p><p class="modal-detail-item-value">${escapeHtml(r.contact)}</p></div>`;

    // What's still needed for Baptism / Confirmation / First Communion / Wedding
    document.getElementById('modal-checklist').innerHTML = r.status === 'declined' ? '' : checklistHtml(r);

    if (r.date && r.status !== 'pending') {
      modalScheduleValue.textContent = `${fmtDate(r.date)}${r.time ? ` at ${r.time}` : ''}`;
      modalScheduleWrap.classList.remove('hidden');
    } else modalScheduleWrap.classList.add('hidden');

    if (r.status === 'declined' && r.declineReason) {
      modalRejection.textContent = r.declineReason;
      modalRejectionWrap.classList.remove('hidden');
    } else modalRejectionWrap.classList.add('hidden');

    if (r.status !== 'declined' && r.notes) {
      modalNotes.textContent = r.notes;
      modalNotesWrap.classList.remove('hidden');
    } else modalNotesWrap.classList.add('hidden');

    openModal(detailModal);
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(detailModal); closeModal(cancelRequestModal); });
  });
  [detailModal, cancelRequestModal].forEach(m => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // A dialog open on top closes first; with none open, leave the Reschedule screen.
    const dialogs = [detailModal, cancelRequestModal].filter(m => !m.classList.contains('hidden'));
    if (dialogs.length) dialogs.forEach(closeModal);
    else closeRescheduleScreen();
  });

  /* --- Reschedule screen ---
     Moves a pending or upcoming booking to another open fixed slot, on a
     full-screen view beside the sidebar (current booking on the left, the
     same calendar picker as Request a Service on the right). Saving books
     it ('scheduled') at the new date/time and frees the old slot. The
     picker needs every parish booking — not just this parishioner's — to
     know which slots are full, so that's watched here too, along with
     parish closures. */
  const reschedulePickerEl  = document.getElementById('reschedule-slot-picker');
  const rescheduleSummary   = document.getElementById('reschedule-summary');
  const rescheduleSubmitBtn = document.getElementById('reschedule-submit');
  let allBookings = [];
  let closures = [];
  let reschedulePicker = null;
  let rescheduleTargetId = null;
  const rescheduleReason = createReasonField(document.getElementById('reschedule-reason-wrap'));

  // Every booked slot parish-wide (no names — see public-data.js).
  watchTakenSlots('blessing', (rows) => { allBookings = rows; if (reschedulePicker) reschedulePicker.refresh(allBookings); });

  /** Taken slots without the one this request itself holds (it's moving away from it). */
  function withoutOwnSlot(rows, r) {
    const i = rows.findIndex(x => x.type === r.type && x.date === (r.date || r.preferredDate) && x.time === r.time);
    return i < 0 ? rows : rows.filter((_, j) => j !== i);
  }
  watchClosures(client, (next) => { closures = next; if (reschedulePicker) reschedulePicker.setClosures(closures); });

  function fmtLongDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  modalRescheduleBtn.addEventListener('click', () => {
    const r = myRequests.find(x => x.id === currentDetailId);
    if (!r) return;
    rescheduleTargetId = r.id;
    const svcName = serviceByName(r.type)?.name || r.type;
    const booked = r.status === 'scheduled';
    document.getElementById('reschedule-title').textContent = `Reschedule — ${svcName}`;
    document.getElementById('reschedule-sub').textContent = booked
      ? 'Pick any open date and time; your booking moves there as soon as you save.'
      : 'Pick any open date and time; your request moves there and still waits for the parish office to approve it.';
    document.getElementById('reschedule-current-label').textContent = booked ? 'Currently booked' : 'Requested (awaiting approval)';
    document.getElementById('reschedule-current').textContent = booked
      ? `${fmtLongDate(r.date)} at ${r.time}`
      : `${fmtLongDate(r.preferredDate || r.date)}${r.time ? ` at ${r.time}` : ''}`;
    // Same label/value rows as the View window, plus contact and location
    const fact = (label, valueHtml) => `<div><p class="svc-screen-fact-label">${escapeHtml(label)}</p><p class="svc-screen-fact-value">${valueHtml}</p></div>`;
    document.getElementById('reschedule-facts').innerHTML = [
      ...Object.entries(getDetails(r))
        .filter(([label]) => !isPrepKey(label))
        .map(([label, value]) => [label, formatDetailValue(value)])
        .filter(([, value]) => value)
        .map(([label, value]) => label === MAP_PIN_LABEL
          ? fact('Pinned Location', `<a href="${escapeHtml(googleMapsUrl(value))}" target="_blank" rel="noopener" class="map-pin-link">Open in Google Maps ↗</a>`)
          : fact(label === RESCHEDULE_REASON_LABEL ? 'Last Rescheduled' : label, escapeHtml(value))),
      ...(r.location ? [fact('Location', escapeHtml(r.location))] : []),
      ...(r.contact ? [fact('Contact', escapeHtml(r.contact))] : []),
    ].join('');
    rescheduleReason.reset();
    rescheduleSummary.classList.add('hidden');
    reschedulePickerEl.classList.remove('has-error');
    reschedulePicker = createSlotPicker(reschedulePickerEl, {
      type: r.type,
      records: allBookings,
      closures,
      excludeId: r.id,
      layout: 'calendar',
      onChange: (slot) => {
        reschedulePickerEl.classList.remove('has-error');
        rescheduleSummary.classList.toggle('hidden', !slot);
        if (slot) rescheduleSummary.textContent = `New schedule: ${fmtLongDate(slot.date)} at ${slot.time}`;
      },
    });
    closeModal(detailModal);
    rescheduleScreen.classList.remove('hidden', 'is-closing');
    document.body.classList.add('svc-screen-open');
    document.getElementById('reschedule-body').scrollTop = 0;
  });

  function closeRescheduleScreen() {
    if (rescheduleScreen.classList.contains('hidden')) return;
    reschedulePicker = null;
    rescheduleTargetId = null;
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
    const r = myRequests.find(x => x.id === rescheduleTargetId);
    const slot = reschedulePicker && reschedulePicker.getValue();
    const reason = rescheduleReason.value();
    if (!r) return;
    if (r.status === 'scheduled' && !canReschedule(r)) {
      window.showToast('Bookings can only be rescheduled up to the day before. Please contact the parish office.', true);
      return;
    }
    if (!reason) { rescheduleReason.showError(); window.showToast('Please tell the parish why you need to reschedule.', true); return; }
    if (!slot) { reschedulePickerEl.classList.add('has-error'); window.showToast('Please pick a new date and time.', true); return; }
    if (r.status === 'scheduled' && slot.date === r.date && slot.time === r.time) {
      window.showToast('That is your current schedule — pick a different slot.', true);
      return;
    }

    rescheduleSubmitBtn.disabled = true;
    try {
      // Last check against the freshest data so two people can't grab the
      // final place in a slot at the same moment.
      const latest = withoutOwnSlot(await fetchTakenSlots('blessing'), r);
      if (!slotHasRoom(r.type, latest || allBookings, slot.date, slot.time, { excludeId: r.id, closures })) {
        reschedulePicker.refresh(latest || allBookings);
        throw new Error('Sorry, that slot was just taken. Please pick another time.');
      }
      const result = await client.models.Blessing.update({
        id: r.id,
        // A blessing still waiting for approval keeps waiting — moving it mustn't skip the office.
        status: r.status === 'pending' && needsApproval(r.type) ? 'pending' : 'scheduled',
        preferredDate: slot.date,
        date: slot.date,
        time: slot.time,
        details: detailsWithRescheduleReason(r.details, reason, r.requesterName || 'Parishioner'),
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeRescheduleScreen();
      reschedulePicker = null;
      rescheduleTargetId = null;
      window.showToast(`${serviceByName(r.type)?.name || r.type} moved to ${fmtLongDate(slot.date)} at ${slot.time}.`);
    } catch (err) {
      console.error('Failed to reschedule:', err);
      window.showToast(err.message || "Couldn't reschedule.", true);
    } finally {
      rescheduleSubmitBtn.disabled = false;
    }
  });

  modalCalendarBtn.addEventListener('click', () => {
    const r = myRequests.find(x => x.id === currentDetailId);
    if (!r || !r.date || !r.time) return;
    const name = serviceByName(r.type)?.name || r.type;
    downloadBookingIcs({
      uid: r.id,
      title: name + ' - Our Lady of Fatima Parish',
      date: r.date,
      time: r.time,
      location: r.location || '',
      description: 'Your ' + name + ' booking with the parish. Please arrive 15 minutes early.',
    });
  });

  modalCancelBtn.addEventListener('click', () => {
    if (!currentDetailId) return;
    const r = myRequests.find(x => x.id === currentDetailId);
    if (!r) return;
    cancelRequestTypeEl.textContent = serviceByName(r.type)?.name || r.type;
    openModal(cancelRequestModal);
  });

  cancelRequestConfirm.addEventListener('click', async () => {
    if (!currentDetailId) return;
    const removed = myRequests.find(x => x.id === currentDetailId);
    try {
      const result = await client.models.Blessing.update({
        id: currentDetailId,
        status: 'declined',
        declineReason: 'Cancelled by the parishioner.',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      currentDetailId = null;
      closeModal(detailModal);
      closeModal(cancelRequestModal);
      window.showToast(`${removed ? serviceByName(removed.type)?.name || removed.type : 'Request'} cancelled.`);
    } catch (err) {
      console.error('Failed to cancel request:', err);
      window.showToast(err.message || "Couldn't cancel the request.", true);
    }
  });

});