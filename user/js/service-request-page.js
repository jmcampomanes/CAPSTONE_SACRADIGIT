/* ============================================
   SacraDigit — Service request page (shared)
   Each service has its own page (SERVICE_PAGES
   below), and each page's own .js calls
   initServiceRequestPage() with its service id.
   The Request a Service page lists them as cards
   that link here. Backed by the Blessing model.

   Scheduling uses the parish's fixed slots from
   ../../shared/js/service-schedule.js: the parishioner picks an
   open slot. Sacraments and special Masses are saved
   straight away as 'scheduled'; blessings are saved as
   'pending' (holding the slot) until the parish office
   approves or declines them on the admin Blessings
   page — see needsApproval() in ../../shared/js/service-catalog.js.
   ============================================ */

import { client } from '../../shared/js/amplify-init.js';
import { watchTakenSlots, fetchTakenSlots } from '../../shared/js/public-data.js';
import { currentUserName, currentUser } from '../../shared/js/auth.js';
import { notifyServiceUpdate } from '../../shared/js/email-notify.js';
import { loadPrefs, savePrefs, enableDeviceAlerts } from '../../shared/js/notifications/parish-notifications.js';
import { createSlotPicker, slotHasRoom, locationFor, watchClosures } from '../../shared/js/service-schedule.js';
import { nameFieldsHtml, readNameFields, nameFieldsFilled, isNameEmpty } from '../../shared/js/name-utils.js';
import { createPinMap, formatLatLng, addressFromLatLng } from '../../shared/js/pin-map.js';
import { SERVICE_TYPES, needsApproval } from '../../shared/js/service-catalog.js';
import { isMobile, mobileDigits, MOBILE_HINT } from '../../shared/js/mobile-number.js';

// A pending blessing holds its slot until the office decides, so one person
// can only have this many waiting at once (keeps spam from filling the calendar).
const MAX_PENDING_BLESSINGS = 3;

// Service id (../../shared/js/service-catalog.js) → its own request page.
export const SERVICE_PAGES = {
  // Blessings
  'house-blessing':        'user-service-house-blessing.html',
  'vehicle-blessing':      'user-service-vehicle-item-blessing.html',
  'business-dedication':   'user-service-business-dedication.html',
  'pet-blessing':          'user-service-pet-blessing.html',
  // Sacraments
  'baptism':               'user-service-baptism.html',
  'confirmation':          'user-service-confirmation.html',
  'first-communion':       'user-service-first-communion.html',
  'confession':            'user-service-confession.html',
  'anointing-of-the-sick': 'user-service-anointing-of-the-sick.html',
  'wedding':               'user-service-wedding.html',
  'holy-orders':           'user-service-holy-orders.html',
  // Special Masses
  'funeral':               'user-service-funeral-mass.html',
  'anniversary-mass':      'user-service-anniversary-mass.html',
  'baccalaureate-mass':    'user-service-baccalaureate-mass.html',
  'inurnment':             'user-service-inurnment.html',
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function fmtLongDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function setFieldError(input, message) {
  input.classList.add('has-error');
  let msg = input.parentElement.querySelector('.form-error-msg');
  if (!msg) { msg = document.createElement('p'); msg.className = 'form-error-msg'; input.insertAdjacentElement('afterend', msg); }
  msg.textContent = message;
}

function clearFieldError(input) {
  input.classList.remove('has-error');
  const msg = input.parentElement.querySelector('.form-error-msg');
  if (msg) msg.remove();
}

/* --- Pin location map (House Blessing, Business Dedication) — `place` words the hints --- */
function pinMapFieldHtml(f) {
  return `
    <div class="sm:col-span-2 pin-map-field" id="q-${f.id}">
      <p class="form-label">Pin your location on the map <span class="pin-map-optional">(optional)</span></p>
      <p class="pin-map-why">Helps the priest find your ${f.place === 'business' ? 'business' : 'house'}. You can skip this.</p>
      <div class="pin-map-wrap">
        <div id="${f.id}" class="pin-map" role="application" aria-label="Map — tap to place a pin on your ${f.place || 'house'}"></div>
        <div class="pin-map-actions">
          <button type="button" class="pin-map-btn" data-pin-action="locate">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="7" stroke-width="1.6"/></svg>
            Use my current location
          </button>
          <button type="button" class="pin-map-btn" data-pin-action="find">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
            Find my address
          </button>
          <span id="${f.id}-status" class="pin-map-status">Tap the map to drop a pin on your ${f.place || 'house'}.</span>
        </div>
      </div>
    </div>`;
}

/** Runs one service's request page (call on DOMContentLoaded). */
export function initServiceRequestPage(serviceId) {
  const svc = SERVICE_TYPES.find(s => s.id === serviceId);
  if (!svc) throw new Error(`Unknown service: ${serviceId}`);

  const REQUESTER_NAME = currentUserName(); // the signed-in parishioner (auth.js)

  const formView         = document.getElementById('form-view');
  const svcDynamicFields = document.getElementById('svc-dynamic-fields');
  const slotPickerEl     = document.getElementById('svc-slot-picker');
  const slotSummaryEl    = document.getElementById('svc-slot-summary');
  const svcContactInput  = document.getElementById('svc-contact');
  const svcNotesInput    = document.getElementById('svc-notes');
  const svcSubmitBtn     = document.getElementById('svc-submit');
  const successView      = document.getElementById('svc-success');

  let pinMap = null; // the location map (House Blessing, Business Dedication)
  let allBookings = []; // every booked slot parish-wide (no names — see public-data.js)
  let closures = [];    // "No Services (Parish Closed)" special schedules block those dates

  function renderSlotSummary(value) {
    slotPickerEl.classList.remove('has-error');
    if (!value) { slotSummaryEl.classList.add('hidden'); return; }
    slotSummaryEl.textContent = `Selected: ${fmtLongDate(value.date)} at ${value.time}`;
    slotSummaryEl.classList.remove('hidden');
  }

  /* --- The form --- */
  const formViewIcon = document.getElementById('form-view-icon');
  document.getElementById('form-view-title').textContent = `Request — ${svc.name}`;
  document.getElementById('form-view-sub').textContent = svc.desc;
  formViewIcon.style.backgroundColor = svc.iconBg;
  formViewIcon.style.color = svc.iconColor;
  formViewIcon.innerHTML = svc.icon;
  document.getElementById('svc-booking-note').textContent = needsApproval(svc.name)
    ? 'These are the parish\'s fixed schedules. Blessing requests are reviewed by the parish office first — your slot is held for you, and you\'ll be notified once it\'s approved. Track it under "My service bookings."'
    : 'These are the parish\'s fixed schedules. The slot you pick is booked for you as soon as you submit — no waiting for approval. You can cancel it anytime under "My service bookings."';

  const slotPicker = createSlotPicker(slotPickerEl, {
    type: svc.name,
    records: allBookings,
    closures,
    layout: 'calendar',
    onChange: renderSlotSummary,
  });

  watchTakenSlots('blessing', (rows) => {
    allBookings = rows;
    slotPicker.refresh(allBookings);
  });
  watchClosures(client, (next) => {
    closures = next;
    slotPicker.setClosures(closures);
  });

  // "Back" / "Cancel" return to the same group on Request a Service (Blessings, Sacraments, …).
  ['btn-back-to-menu', 'btn-cancel-request'].forEach(id => {
    const link = document.getElementById(id);
    if (link && svc.category) link.href = `user-request-service.html?need=${encodeURIComponent(svc.category)}`;
  });

  // Order on the page: the address and other details first, then the date and
  // time, then the optional map — it goes under the schedule, not above the address.
  svcDynamicFields.innerHTML = svc.fields.map(f => {
    if (f.kind === 'name') return nameFieldsHtml(f.id, escapeHtml(f.label), { required: f.required, spanFull: !!f.span2 });
    if (f.kind === 'map') return '';
    if (f.kind === 'note') return `<p class="svc-field-note sm:col-span-2">${escapeHtml(f.text)}</p>`;
    return `
    <div class="${f.span2 ? 'sm:col-span-2' : ''}">
      <label class="form-label" for="${f.id}">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input type="text" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />
    </div>`;
  }).join('');

  // The form is a full-screen view beside the sidebar that fits in one screen.
  document.body.classList.add('req-screen-open');
  const mapField = svc.fields.find(f => f.kind === 'map');
  formView.classList.toggle('svc-has-map', !!mapField);
  if (mapField) {
    slotSummaryEl.parentElement.insertAdjacentHTML('afterend', pinMapFieldHtml(mapField));
    initPinMap(mapField);
  }
  svcDynamicFields.querySelector('input')?.focus({ preventScroll: true });

  function initPinMap(field) {
    const statusEl = document.getElementById(`${field.id}-status`);
    const setStatus = (text, state = '') => { statusEl.textContent = text; statusEl.dataset.state = state; };
    const addressInput = document.getElementById(field.addressField);

    /* Fill in "Complete Address" from the pin (Use my current location,
       tapping the map, or dragging the pin). Only an empty box — or one we
       filled ourselves — is filled; an address the parishioner typed is
       never overwritten, they get a "Use this address" button instead. */
    let autoFilled = '';      // the address we last put in the box
    let lookupTimer = null;
    let lookupToken = 0;
    const canAutofill = () => addressInput && (!addressInput.value.trim() || addressInput.value === autoFilled);

    function fillAddress(text) {
      addressInput.value = text;
      autoFilled = text;
      clearFieldError(addressInput);
      addressInput.classList.remove('address-autofilled');
      void addressInput.offsetWidth; // restart the highlight
      addressInput.classList.add('address-autofilled');
    }

    async function lookupAddress(latlng, { fromLocate = false } = {}) {
      const myToken = ++lookupToken;
      if (fromLocate) setStatus('Found you — looking up your address…');
      try {
        const found = await addressFromLatLng(latlng);
        if (myToken !== lookupToken || !pinMap) return; // the pin moved again meanwhile
        if (!found) {
          setStatus(`Pinned: ${formatLatLng(latlng)}. We couldn't read a street address here — please type it below.`, 'ok');
          return;
        }
        if (canAutofill()) {
          fillAddress(found);
          setStatus(`Address filled in from your pin — please check it and add the ${field.place === 'business' ? 'building/unit' : 'house/unit'} number if it’s missing.`, 'ok');
        } else {
          statusEl.dataset.state = 'ok';
          statusEl.innerHTML = `Pinned near <strong>${escapeHtml(found)}</strong>. <button type="button" class="pin-map-use-address">Use this address</button>`;
          statusEl.querySelector('.pin-map-use-address').addEventListener('click', () => {
            fillAddress(found);
            setStatus('Address updated from your pin — please check it.', 'ok');
          });
        }
      } catch (err) {
        if (myToken === lookupToken) setStatus(`Pinned: ${formatLatLng(latlng)}. ${err.message}`, 'ok');
      }
    }

    pinMap = createPinMap(document.getElementById(field.id), {
      onChange: (latlng) => {
        if (!latlng) return;
        setStatus(`Pinned: ${formatLatLng(latlng)} — drag the pin to adjust.`, 'ok');
        // Keep the address in step with the pin (debounced — the free geocoder allows ~1 lookup a second)
        clearTimeout(lookupTimer);
        lookupTimer = setTimeout(() => lookupAddress(latlng), 700);
      },
    });
    // The screen slides in; re-measure once it has settled so tiles fill the box
    setTimeout(() => pinMap?.resize(), 300);

    document.getElementById(`q-${field.id}`).addEventListener('click', async (e) => {
      const action = e.target.closest('[data-pin-action]')?.dataset.pinAction;
      if (!action || !pinMap) return;
      const btn = e.target.closest('[data-pin-action]');
      btn.disabled = true;
      try {
        if (action === 'locate') {
          setStatus('Getting your location…');
          const at = await pinMap.locateMe();
          clearTimeout(lookupTimer); // look it up now rather than after the drag delay
          await lookupAddress(at, { fromLocate: true });
        } else {
          const address = document.getElementById(field.addressField)?.value.trim();
          if (!address) { setStatus(`Type the ${field.place === 'business' ? 'Business Address' : 'Complete Address'} first, then tap "Find my address."`, 'error'); return; }
          setStatus('Looking up your address…');
          await pinMap.findAddress(address);
        }
      } catch (err) {
        setStatus(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* --- Confirmation after submitting: replaces the form with what was
     booked and a button to track it. --- */
  /* How to be reminded the day before. Saved on the booking (details), so the
     parish office's day-before email (Sacradigit/blessings.js) knows whether
     to send it. Text messages need an SMS sender the parish doesn't have yet. */
  const REMINDER_FIELD = 'Day-before reminder';
  const REMINDER_CHOICES = [
    { value: 'Email', label: 'Email' },
    { value: 'This phone', label: 'This phone' },
    { value: 'No reminder', label: 'No reminder' },
  ];
  function reminderChooserHtml(bookingId) {
    return `
      <fieldset class="svc-reminder" data-booking="${escapeHtml(bookingId)}">
        <legend class="svc-reminder-title">Remind me the day before by:</legend>
        <div class="svc-reminder-options">
          ${REMINDER_CHOICES.map((c, i) => `
          <label class="svc-reminder-option"><input type="radio" name="svc-reminder" value="${c.value}" ${i === 0 ? 'checked' : ''} /> ${c.label}</label>`).join('')}
        </div>
        <p class="svc-reminder-note" role="status"></p>
      </fieldset>`;
  }
  async function saveReminderChoice(fieldset, value) {
    const note = fieldset.querySelector('.svc-reminder-note');
    if (value === 'This phone') {
      const allowed = await enableDeviceAlerts();
      if (allowed) savePrefs({ ...loadPrefs(), device: true, 'service-status': true });
      else note.textContent = 'This phone didn’t allow notifications. Turn them on in your browser settings, or choose Email.';
    }
    try {
      const { data } = await client.models.Blessing.get({ id: fieldset.dataset.booking });
      const details = data?.details ? (typeof data.details === 'string' ? JSON.parse(data.details) : data.details) : {};
      details[REMINDER_FIELD] = value;
      const res = await client.models.Blessing.update({ id: fieldset.dataset.booking, details: JSON.stringify(details) });
      if (res.errors?.length) throw new Error(res.errors[0].message);
      if (value !== 'This phone' || note.textContent === '') {
        note.textContent = value === 'No reminder' ? 'Okay — no reminder.' : `Saved. We’ll remind you by ${value === 'Email' ? 'email' : 'a notification on this phone'} the day before.`;
      }
    } catch (err) {
      console.error('Could not save the reminder choice:', err);
      note.textContent = 'Couldn’t save that choice. Please try again.';
    }
  }

  function showServiceSuccess({ slot, approval, location, bookingId }) {
    document.body.classList.remove('req-screen-open');
    formView.classList.add('hidden');
    if (pinMap) { pinMap.destroy(); pinMap = null; }

    document.getElementById('svc-success-title').textContent = approval ? 'Request Sent!' : 'Request Submitted!';
    document.getElementById('svc-success-desc').textContent = approval
      ? `Your ${svc.name} request is waiting for the parish office to approve it — your slot is held for you, and you'll be notified once it's approved.`
      : `Your ${svc.name} is booked — please arrive 15 minutes early. You can reschedule or cancel it anytime under My service bookings.`;
    const row = (label, value) => value ? `<div><p class="modal-detail-item-label">${escapeHtml(label)}</p><p class="modal-detail-item-value">${escapeHtml(value)}</p></div>` : '';
    document.getElementById('svc-success-details').innerHTML = [
      row('Service', svc.name),
      row(approval ? 'Requested Slot' : 'Schedule', `${fmtLongDate(slot.date)} at ${slot.time}`),
      row('Location', location),
      row('Status', approval ? 'Awaiting Approval' : 'Scheduled'),
    ].join('');
    const detailsEl = document.getElementById('svc-success-details');
    detailsEl.parentElement.querySelector('.svc-reminder')?.remove();
    if (bookingId) {
      detailsEl.insertAdjacentHTML('afterend', reminderChooserHtml(bookingId));
      const fieldset = detailsEl.parentElement.querySelector('.svc-reminder');
      fieldset.addEventListener('change', (e) => { if (e.target.name === 'svc-reminder') saveReminderChoice(fieldset, e.target.value); });
    }
    // Blessings open Requested Services on the Blessings filter
    document.getElementById('svc-success-track').href = approval ? 'user-requested-services.html?filter=blessing' : 'user-requested-services.html';
    successView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('svc-success-title').focus({ preventScroll: true });
  }

  svcContactInput.addEventListener('input', () => clearFieldError(svcContactInput));

  svcSubmitBtn.addEventListener('click', async () => {
    const missing = []; // [label, element] in page order, for the summary and scrolling
    const ask = (label) => `Please enter the ${label.replace(/\s*\(.*?\)/g, '').toLowerCase()}.`;
    svc.fields.filter(f => f.required && f.kind !== 'map').forEach(f => {
      if (f.kind === 'name') {
        const firstEl = document.getElementById(`${f.id}-first`);
        const lastEl = document.getElementById(`${f.id}-last`);
        [firstEl, lastEl].forEach(clearFieldError);
        if (!nameFieldsFilled(f.id)) {
          setFieldError(lastEl, ask(f.label));
          missing.push([f.label, lastEl]);
        }
        return;
      }
      const el = document.getElementById(f.id);
      clearFieldError(el);
      if (!el.value.trim()) { setFieldError(el, ask(f.label)); missing.push([f.label, el]); }
    });

    clearFieldError(svcContactInput);
    if (!svcContactInput.value.trim()) { setFieldError(svcContactInput, 'Please enter a contact number.'); missing.push(['Contact Number', svcContactInput]); }
    else if (!isMobile(svcContactInput.value)) { setFieldError(svcContactInput, MOBILE_HINT); missing.push(['Contact Number', svcContactInput]); }

    // The schedule's own message ("Please pick a date and time.") is written
    // under the calendar by field-messages.js when it turns red.
    const slot = slotPicker.getValue();
    if (!slot) { slotPickerEl.classList.add('has-error'); missing.push(['date and time', slotPickerEl]); }

    if (missing.length) {
      // Say exactly what's missing, then bring the first one into view.
      const names = missing.map(([label]) => label === 'date and time' ? 'a date and time' : label.replace(/\s*\(.*?\)/g, ''));
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
      window.showToast(`Still needed: ${list}. See the red notes on the form.`, true);
      const first = missing[0][1];
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (first.matches('input, textarea, select')) first.focus({ preventScroll: true });
      return;
    }

    const details = {};
    svc.fields.forEach(f => {
      if (f.kind === 'note') return;
      if (f.kind === 'map') {
        const pin = pinMap?.getValue();
        if (pin) details[f.label] = formatLatLng(pin);
        return;
      }
      if (f.kind === 'name') {
        const nameVal = readNameFields(f.id);
        if (!isNameEmpty(nameVal)) details[f.label] = nameVal;
        return;
      }
      const val = document.getElementById(f.id).value.trim();
      if (val) details[f.label] = val;
    });

    svcSubmitBtn.disabled = true;
    const approval = needsApproval(svc.name);
    const status = approval ? 'pending' : 'scheduled';

    try {
      if (approval) {
        const { data: mine } = await client.models.Blessing.list({
          filter: { requesterName: { eq: REQUESTER_NAME }, status: { eq: 'pending' } }, limit: 1000,
        });
        const waiting = (mine || []).filter(r => needsApproval(r.type)).length;
        if (waiting >= MAX_PENDING_BLESSINGS) {
          throw new Error(`You already have ${waiting} blessing requests waiting for approval. Please wait for the parish office to review them first.`);
        }
      }

      // Last check against the freshest data so two people can't grab
      // the final place in a slot at the same moment.
      const latest = await fetchTakenSlots('blessing');
      if (!slotHasRoom(svc.name, latest || allBookings, slot.date, slot.time, { closures })) {
        slotPicker.refresh(latest || allBookings);
        throw new Error('Sorry, that slot was just taken. Please pick another time.');
      }

      const result = await client.models.Blessing.create({
        requesterName: REQUESTER_NAME,
        type: svc.name,
        email: currentUser()?.email || undefined, // where approval/decline emails go
        contact: mobileDigits(svcContactInput.value),
        notes: svcNotesInput.value.trim() || undefined,
        details: JSON.stringify({ ...details, [REMINDER_FIELD]: 'Email' }),
        location: locationFor(svc.name, details),
        preferredDate: slot.date,
        date: slot.date,
        time: slot.time,
        status,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      // Blessings get their email once the office approves (or declines) them.
      if (!approval) {
        notifyServiceUpdate({
          to: currentUser()?.email, name: REQUESTER_NAME, serviceType: svc.name, status: 'scheduled',
          date: slot.date, time: slot.time, location: locationFor(svc.name, details),
        });
      }

      showServiceSuccess({ slot, approval, location: locationFor(svc.name, details), bookingId: result.data?.id });
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      svcSubmitBtn.disabled = false;
    }
  });
}
