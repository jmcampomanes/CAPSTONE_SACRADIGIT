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
import { loadParishRules } from '../../shared/js/parish-rules.js';
import { createServiceRequest, changeMyRequest } from '../../shared/js/secure-actions.js';
import { feeFor, parishRules, peso } from '../../shared/js/parish-rules.js';
import { paymentsReady } from '../../shared/js/payments.js';
import { cancellationTerms, distanceCharge, OFFERED_KEY, DISTANCE_KEY, DISTANCE_FEE_KEY, DISTANCE_CHECK_KEY } from '../../shared/js/request-status.js';
import { requirementsBeforeFormHtml, hasChecklist, UPLOADS_KEY } from '../../shared/js/sacrament-prep.js';
import { uploadsReady, uploadProblem, uploadRequirement } from '../../shared/js/requirement-uploads.js';
import {
  checkCouple, accountIsInCouple, AGE_DOCS_KEY, GROOM_EMAIL, BRIDE_EMAIL,
} from '../../shared/js/wedding-rules.js';
import { myDetails, prefill, rememberHtml, rememberDetails } from '../../shared/js/profile-details.js';
import {
  BAPTISM_TYPE_KEY, BAPTISM_TYPE_LABELS, PUBLIC_DATE_KEY, typeChooserHtml, dateListHtml, watchDates, holdRows,
  dateState, serviceLabel,
} from '../../shared/js/public-baptism.js';

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
  let takenLoaded = false;

  /* Baptism only: Private uses the slot picker, Public the announced dates (public-baptism.js). */
  const isBaptism = svc.id === 'baptism';
  let baptismType = '';   // 'private' | 'public'
  let publicDates = [];
  let publicDateId = '';
  const pickerRows = () => [...allBookings, ...holdRows(publicDates)];

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
    takenLoaded = true;
    slotPicker.refresh(pickerRows());
    renderPublicDates();
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

  function renderPublicDates() {
    const box = document.getElementById('svc-public-dates');
    if (!box) return;
    box.innerHTML = dateListHtml('svc', publicDates, takenLoaded ? allBookings : null, {
      selectedId: publicDateId,
      officeNote: 'You can choose Private Baptism instead, or ask the parish office.',
    });
  }

  function setBaptismType(type) {
    baptismType = type;
    publicDateId = '';
    document.getElementById('svc-baptism-chooser').classList.remove('has-error');
    slotPickerEl.parentElement.classList.toggle('hidden', type !== 'private');
    document.getElementById('svc-public-dates').classList.toggle('hidden', type !== 'public');
    document.getElementById('svc-baptism-hint').classList.add('hidden');
    renderPublicDates();
    renderFee();
    if (usesPayments) return;
    document.getElementById('svc-booking-note').textContent = type === 'public'
      ? 'Pick one of the dates the parish announced. Your family is registered as soon as you submit, and you can cancel anytime under "My service bookings."'
      : 'These are the parish\'s fixed schedules. The slot you pick is booked for you as soon as you submit — no waiting for approval. You can cancel it anytime under "My service bookings."';
  }

  // Order on the page: the address and other details first, then the date and
  // time, then the optional map — it goes under the schedule, not above the address.
  svcDynamicFields.innerHTML = svc.fields.map(f => {
    if (f.kind === 'name') return nameFieldsHtml(f.id, escapeHtml(f.label), { required: f.required, spanFull: !!f.span2 });
    if (f.kind === 'map') return '';
    if (f.kind === 'note') return `<p class="svc-field-note sm:col-span-2">${escapeHtml(f.text)}</p>`;
    return `
    <div class="${f.span2 ? 'sm:col-span-2' : ''}">
      <label class="form-label" for="${f.id}">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input type="${f.type || 'text'}" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />
    </div>`;
  }).join('');

  if (isBaptism) {
    svcDynamicFields.insertAdjacentHTML('afterbegin', typeChooserHtml('svc'));
    slotPickerEl.parentElement.classList.add('hidden');
    slotPickerEl.parentElement.insertAdjacentHTML('afterend', '<div id="svc-public-dates" class="hidden"></div><p id="svc-baptism-hint" class="bt-empty">Choose Private Baptism or Public Baptism first.</p>');
    svcDynamicFields.addEventListener('change', (e) => { if (e.target.name === 'svc-baptism-type') setBaptismType(e.target.value); });
    document.getElementById('svc-public-dates').addEventListener('change', (e) => {
      if (e.target.name === 'svc-public-date') { publicDateId = e.target.value; e.currentTarget.classList.remove('has-error'); }
    });
    loadParishRules(client).then(() => {
      // Saved fees can differ from the published ones: redraw the amounts.
      const chosen = baptismType;
      document.getElementById('svc-baptism-chooser').outerHTML = typeChooserHtml('svc');
      if (chosen) document.querySelector(`input[name="svc-baptism-type"][value="${chosen}"]`).checked = true;
    });
    watchDates(client, (dates) => {
      publicDates = dates;
      slotPicker.refresh(pickerRows());
      renderPublicDates();
    });
  }

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
      await changeMyRequest(fieldset.dataset.booking, 'set-reminder', { reminder: value }, { details: JSON.stringify(details) });
      if (value !== 'This phone' || note.textContent === '') {
        note.textContent = value === 'No reminder' ? 'Okay — no reminder.' : `Saved. We’ll remind you by ${value === 'Email' ? 'email' : 'a notification on this phone'} the day before.`;
      }
    } catch (err) {
      console.error('Could not save the reminder choice:', err);
      note.textContent = 'Couldn’t save that choice. Please try again.';
    }
  }

  function showServiceSuccess({ slot, approval, location, bookingId, name = svc.name }) {
    document.body.classList.remove('req-screen-open');
    formView.classList.add('hidden');
    if (pinMap) { pinMap.destroy(); pinMap = null; }

    document.getElementById('svc-success-title').textContent = approval ? 'Request Sent!' : 'Request Submitted!';
    document.getElementById('svc-success-desc').textContent = approval
      ? `Your ${name} request is waiting for the parish office to approve it — your slot is held for you, and you'll be notified once it's approved.`
      : `Your ${name} is booked — please arrive 15 minutes early. You can reschedule or cancel it anytime under My service bookings.`;
    const row = (label, value) => value ? `<div><p class="modal-detail-item-label">${escapeHtml(label)}</p><p class="modal-detail-item-value">${escapeHtml(value)}</p></div>` : '';
    document.getElementById('svc-success-details').innerHTML = [
      row('Service', name),
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

  /* --- What it costs, what's needed, and the cancellation terms --- */
  const usesPayments = paymentsReady();
  const needsOffice = usesPayments || needsApproval(svc.name);
  const feeBox = document.createElement('div');
  feeBox.id = 'svc-fee';
  svcNotesInput.parentElement.before(feeBox);

  function renderFee() {
    const fee = feeFor(svc.name, { baptismType: baptismType || (isBaptism ? 'private' : '') });
    const chosen = document.getElementById('svc-offered')?.value;
    feeBox.innerHTML = `
      <p class="form-label">Fee</p>
      <p class="svc-fee-amount">${isBaptism && !baptismType ? 'Shown when you choose the type above' : fee.label}</p>
      ${fee.kind === 'minimum' ? `
        <label class="form-label mt-2" for="svc-offered">Your offering (₱) <span class="text-red-500">*</span></label>
        <input type="number" id="svc-offered" class="form-input" min="${fee.amount}" step="50" value="${chosen || fee.amount}" />` : ''}`;
    renderDistance();
  }

  function renderDistance() {
    const box = document.getElementById('svc-distance');
    if (!box) return;
    const charge = distanceCharge(pinMap?.getValue() ? formatLatLng(pinMap.getValue()) : '');
    box.classList.toggle('hidden', !charge || (!charge.surcharge && !charge.outOfRange));
    if (!charge) return;
    box.textContent = charge.outOfRange
      ? `This address is about ${charge.km} km from the parish, which is beyond our usual reach. The parish office will confirm whether a priest can go.`
      : `This address is about ${charge.km} km from the parish, so ${peso(charge.surcharge)} is added for the distance.`;
  }

  const notesLabel = document.querySelector('label[for="svc-notes"]');
  if (feeFor(svc.name).kind === 'quoted' && !isBaptism) {
    notesLabel.textContent = 'Additional Requests (the parish office sets the amount from these)';
  }
  document.getElementById('svc-dynamic-fields').insertAdjacentHTML('beforebegin',
    hasChecklist(svc.name) ? requirementsBeforeFormHtml(svc.name, { canUpload: uploadsReady() }) : '');
  svcNotesInput.parentElement.insertAdjacentHTML('afterend', `
    <div id="svc-distance" class="pr-note hidden"></div>
    <label class="consent-check" id="svc-terms-wrap">
      <input type="checkbox" id="svc-terms" />
      <span id="svc-terms-text"></span>
    </label>`);
  document.getElementById('svc-terms-text').textContent = `${cancellationTerms()} I agree to these terms.`;
  renderFee();
  loadParishRules(client).then(() => {
    document.getElementById('svc-terms-text').textContent = `${cancellationTerms()} I agree to these terms.`;
    renderFee();
  });
  if (usesPayments) {
    document.getElementById('svc-booking-note').textContent = 'Your slot is held while the parish office reviews this. They will tell you the amount to pay, and the slot is confirmed once your payment is checked.';
  }
  document.querySelector('.req-screen-body')?.addEventListener('click', () => renderDistance());

  /* --- Weddings: who may book, and what their ages add (wedding-rules.js) --- */
  const isWedding = svc.id === 'wedding';
  const weddingCheck = () => checkCouple({
    groomBirth: document.getElementById('groom-birth').value,
    brideBirth: document.getElementById('bride-birth').value,
    weddingDate: slotPicker.getValue()?.date,
  });
  function renderWeddingNotice() {
    const box = document.getElementById('svc-wedding-age');
    const { blocked, docs } = weddingCheck();
    const lines = [...blocked, ...docs.map(d => `${d.why} Please bring this document to the parish office.`)];
    box.classList.toggle('hidden', !lines.length);
    box.innerHTML = lines.map(l => `<p>${escapeHtml(l)}</p>`).join('');
  }
  if (isWedding) {
    svcDynamicFields.insertAdjacentHTML('beforeend', `
      <div id="svc-wedding-age" class="pr-note sm:col-span-2 hidden"></div>
      <label class="consent-check sm:col-span-2" id="svc-couple-wrap">
        <input type="checkbox" id="svc-couple" />
        <span>I am the bride or groom named above. Requests can’t be made for someone else online. I will show a valid ID at the parish office. <span class="text-red-500">*</span></span>
      </label>`);
    ['groom-birth', 'bride-birth'].forEach(id => document.getElementById(id).addEventListener('change', renderWeddingNotice));
    slotPickerEl.addEventListener('click', () => setTimeout(renderWeddingNotice, 0));
  }

  /* Details typed once: prefill from My Profile, and offer to save changes back. */
  const addressField = svc.fields.find(f => /address/i.test(f.label) && !f.kind);
  svcNotesInput.parentElement.insertAdjacentHTML('afterend', `<div>${rememberHtml('svc-remember')}</div>`);
  myDetails(REQUESTER_NAME).then((saved) => {
    prefill(svcContactInput, saved.phone);
    if (addressField) prefill(document.getElementById(addressField.id), saved.address);
  });

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
    const publicDate = publicDates.find(d => d.id === publicDateId);
    const slot = baptismType === 'public'
      ? (publicDate ? { date: publicDate.date, time: publicDate.time } : null)
      : slotPicker.getValue();
    if (isBaptism && !baptismType) {
      const chooser = document.getElementById('svc-baptism-chooser');
      chooser.classList.add('has-error');
      missing.push(['type of baptism', chooser]);
    } else if (baptismType === 'public' && !slot) {
      const box = document.getElementById('svc-public-dates');
      box.classList.add('has-error');
      missing.push(['public baptism date', box]);
    } else if (!slot) { slotPickerEl.classList.add('has-error'); missing.push(['date and time', slotPickerEl]); }

    if (isWedding) {
      const wrap = document.getElementById('svc-couple-wrap');
      wrap.classList.remove('has-error');
      if (!document.getElementById('svc-couple').checked) { wrap.classList.add('has-error'); missing.push(['declaration that you are the bride or groom', wrap]); }
      ['groom-email', 'bride-email'].forEach(id => {
        const el = document.getElementById(id);
        if (el.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) { setFieldError(el, 'Please enter a valid email address.'); missing.push(['valid email', el]); }
      });
      if (!missing.length && !accountIsInCouple(REQUESTER_NAME, readNameFields('groom-name'), readNameFields('bride-name'))) {
        window.showToast(`This account is under ${REQUESTER_NAME}, who isn’t named as the bride or groom. Please use your own account, or book at the parish office.`, true);
        return;
      }
      const { blocked } = weddingCheck();
      if (blocked.length) { window.showToast(blocked.join(' '), true); return; }
    }

    const terms = document.getElementById('svc-terms');
    document.getElementById('svc-terms-wrap').classList.remove('has-error');
    if (!terms.checked) { document.getElementById('svc-terms-wrap').classList.add('has-error'); missing.push(['agreement to the terms', terms]); }
    const offeredEl = document.getElementById('svc-offered');
    if (offeredEl) {
      clearFieldError(offeredEl);
      if (!(Number(offeredEl.value) >= Number(offeredEl.min))) { setFieldError(offeredEl, `The minimum is ${peso(Number(offeredEl.min))}.`); missing.push(['offering', offeredEl]); }
    }
    const files = [...document.querySelectorAll('[data-upload-item]')].filter(i => i.files[0]);
    const badFile = files.map(i => uploadProblem(i.files[0])).find(Boolean);
    if (badFile) { window.showToast(badFile, true); return; }

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

    if (offeredEl) details[OFFERED_KEY] = Number(offeredEl.value);
    if (isWedding) {
      const { docs } = weddingCheck();
      if (docs.length) details[AGE_DOCS_KEY] = docs;
    }
    const charge = distanceCharge(pinMap?.getValue() ? formatLatLng(pinMap.getValue()) : '', parishRules());
    if (charge) {
      details[DISTANCE_KEY] = `${charge.km} km`;
      if (charge.surcharge) details[DISTANCE_FEE_KEY] = charge.surcharge;
      if (charge.outOfRange) details[DISTANCE_CHECK_KEY] = 'Yes';
    }
    if (isBaptism) details[BAPTISM_TYPE_KEY] = BAPTISM_TYPE_LABELS[baptismType];
    if (publicDate) details[PUBLIC_DATE_KEY] = publicDate.id;
    const location = publicDate ? publicDate.location : locationFor(svc.name, details);

    svcSubmitBtn.disabled = true;
    const approval = needsOffice;
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
      allBookings = latest || allBookings;
      if (publicDate) {
        takenLoaded = true;
        if (dateState(publicDate, allBookings) !== 'open') {
          publicDateId = '';
          renderPublicDates();
          throw new Error('Sorry, that date just filled up or closed. Please pick another date.');
        }
      } else if (!slotHasRoom(svc.name, pickerRows(), slot.date, slot.time, { closures })) {
        slotPicker.refresh(pickerRows());
        throw new Error('Sorry, that slot was just taken. Please pick another time.');
      }

      if (files.length) {
        const uploads = {};
        for (const input of files) uploads[input.dataset.uploadItem] = await uploadRequirement(input.files[0], input.dataset.uploadItem);
        details[UPLOADS_KEY] = uploads;
      }

      const result = await createServiceRequest({
        requesterName: REQUESTER_NAME,
        type: svc.name,
        email: currentUser()?.email || undefined, // where approval/decline emails go
        contact: mobileDigits(svcContactInput.value),
        notes: svcNotesInput.value.trim() || undefined,
        details: JSON.stringify({ ...details, [REMINDER_FIELD]: 'Email' }),
        location,
        preferredDate: slot.date,
        date: slot.date,
        time: slot.time,
        status,
      });

      // The couple both hear about the request, whoever sent it.
      if (isWedding) {
        [details[GROOM_EMAIL], details[BRIDE_EMAIL]].forEach(to => notifyServiceUpdate({
          to, name: REQUESTER_NAME, serviceType: svc.name, status: 'received', date: slot.date, time: slot.time, location,
        }));
      }

      // Blessings get their email once the office approves (or declines) them.
      if (!approval) {
        notifyServiceUpdate({
          to: currentUser()?.email, name: REQUESTER_NAME, serviceType: svc.name, status: 'scheduled',
          date: slot.date, time: slot.time, location,
        });
      }

      if (document.getElementById('svc-remember').checked) {
        rememberDetails(REQUESTER_NAME, {
          phone: mobileDigits(svcContactInput.value),
          ...(addressField ? { address: document.getElementById(addressField.id).value.trim() } : {}),
        }).catch(err => console.warn('Could not save details to the profile:', err));
      }

      showServiceSuccess({ slot, approval, location, bookingId: result.data?.id, name: isBaptism ? serviceLabel(result.data) : svc.name });
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      svcSubmitBtn.disabled = false;
    }
  });
}
