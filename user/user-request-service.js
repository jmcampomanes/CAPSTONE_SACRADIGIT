/* ============================================
   SacraDigit — User Request a Service Scripts (AWS Amplify)
   Runs after user-shell.js.
   Browsing + submitting only — the tracking log now
   lives on user-requested-services.html/.js. Backed
   by the Blessing model.

   Scheduling uses the parish's fixed slots from
   ../service-schedule.js: the parishioner picks an
   open slot. Sacraments and special Masses are saved
   straight away as 'scheduled'; blessings are saved as
   'pending' (holding the slot) until the parish office
   approves or declines them on the admin Blessings
   page — see needsApproval() in ../service-catalog.js.
   ============================================ */

import { client } from '../amplify-init.js';
import { watchTakenSlots, fetchTakenSlots } from '../public-data.js';
import { currentUserName, currentUser } from '../auth.js';
import { notifyServiceUpdate } from '../email-notify.js';
import { createSlotPicker, slotHasRoom, locationFor, describeSchedule, watchClosures, serviceSchedulesReady } from '../service-schedule.js';
import { nameFieldsHtml, readNameFields, nameFieldsFilled, isNameEmpty } from '../name-utils.js';
import { createPinMap, formatLatLng, addressFromLatLng } from '../pin-map.js';
import { SERVICE_CATEGORIES, SERVICE_TYPES, needsApproval } from '../service-catalog.js';

// A pending blessing holds its slot until the office decides, so one person
// can only have this many waiting at once (keeps spam from filling the calendar).
const MAX_PENDING_BLESSINGS = 3;

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = currentUserName(); // the signed-in parishioner (auth.js)

  const serviceTypes = SERVICE_TYPES;

  const formView       = document.getElementById('form-view');
  const formViewIcon   = document.getElementById('form-view-icon');
  const formViewSub    = document.getElementById('form-view-sub');
  const svcDynamicFields      = document.getElementById('svc-dynamic-fields');
  const slotPickerEl             = document.getElementById('svc-slot-picker');
  const slotSummaryEl            = document.getElementById('svc-slot-summary');
  const svcContactInput             = document.getElementById('svc-contact');
  const svcNotesInput                  = document.getElementById('svc-notes');
  const svcSubmitBtn                     = document.getElementById('svc-submit');
  const formViewTitle                   = document.getElementById('form-view-title');
  const svcTypeGrid      = document.getElementById('svc-type-grid');

  let selectedTypeId = null;
  let slotPicker = null;
  let pinMap = null; // House Blessing's location map, while the form is open
  let allBookings = []; // every booked slot parish-wide (no names — see public-data.js)

  watchTakenSlots('blessing', (rows) => {
    allBookings = rows;
    if (slotPicker) slotPicker.refresh(allBookings);
  });

  // "No Services (Parish Closed)" special schedules block those dates
  let closures = [];
  watchClosures(client, (next) => {
    closures = next;
    if (slotPicker) slotPicker.setClosures(closures);
  });

  function fmtLongDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function renderSlotSummary(value) {
    slotPickerEl.classList.remove('has-error');
    if (!value) { slotSummaryEl.classList.add('hidden'); return; }
    slotSummaryEl.textContent = `Selected: ${fmtLongDate(value.date)} at ${value.time}`;
    slotSummaryEl.classList.remove('hidden');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
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
  /* --- Services We Offer — on-page catalog, grouped into a labeled row
     per category (Blessings, Sacraments, Special Masses) instead of one
     undifferentiated grid, so it's clear at a glance what kind of
     request each card is. --- */
  // "Mon–Sat · 09:00 AM, 10:30 AM" → days on one line, each time as a small chip
  const CLOCK_ICON = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  function schedHtml(name) {
    const [days, times = ''] = describeSchedule(name).split(' · ');
    const chips = times.split(', ').filter(Boolean)
      .map(t => `<span class="svc-time-chip">${escapeHtml(t.replace(/^0(\d)/, '$1'))}</span>`).join('');
    return `<span class="svc-sched-days">${CLOCK_ICON}${escapeHtml(days)}</span>${chips ? `<span class="svc-sched-times">${chips}</span>` : ''}`;
  }

  function svcCardHtml(s) {
    return `
    <button type="button" class="svc-type-card" data-id="${s.id}">
      <div class="svc-type-head">
        <div class="svc-icon" style="background-color:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
        <p class="svc-type-name">${escapeHtml(s.name)}</p>
      </div>
      <p class="svc-type-desc">${escapeHtml(s.desc)}</p>
      <div class="svc-type-sched">${schedHtml(s.name)}</div>
      <div class="svc-type-foot">
        ${needsApproval(s.name) ? '<span class="svc-type-approval" title="The parish office approves blessing requests first">Needs approval</span>' : '<span></span>'}
        <span class="svc-type-cta">Start request
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </span>
      </div>
    </button>`;
  }

  svcTypeGrid.innerHTML = SERVICE_CATEGORIES.map(cat => {
    const items = serviceTypes.filter(s => s.category === cat.key);
    if (!items.length) return '';
    return `
    <div class="svc-category-block">
      <div class="svc-category-header">
        <h3 class="svc-category-title">${escapeHtml(cat.label)}</h3>
        <p class="svc-category-desc">${escapeHtml(cat.desc)}</p>
      </div>
      <div class="svc-type-row">${items.map(svcCardHtml).join('')}</div>
    </div>`;
  }).join('');

  // Refresh the day/time line once any schedule edits saved by ITech have loaded.
  serviceSchedulesReady.then(() => {
    svcTypeGrid.querySelectorAll('.svc-type-card').forEach(card => {
      const svc = serviceTypes.find(s => s.id === card.dataset.id);
      const line = card.querySelector('.svc-type-sched');
      if (svc && line) line.innerHTML = schedHtml(svc.name);
    });
  });

  svcTypeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.svc-type-card');
    if (card) selectService(card.dataset.id);
  });

  function selectService(id) {
    const svc = serviceTypes.find(s => s.id === id);
    if (!svc) return;
    selectedTypeId = id;

    formViewTitle.textContent = `Request — ${svc.name}`;
    formViewSub.textContent = svc.desc;
    formViewIcon.style.backgroundColor = svc.iconBg;
    formViewIcon.style.color = svc.iconColor;
    formViewIcon.innerHTML = svc.icon;
    svcContactInput.value = '';
    svcNotesInput.value = '';
    document.getElementById('svc-booking-note').textContent = needsApproval(svc.name)
      ? 'These are the parish\'s fixed schedules. Blessing requests are reviewed by the parish office first — your slot is held for you, and you\'ll be notified once it\'s approved. Track it under "Requested Services."'
      : 'These are the parish\'s fixed schedules. The slot you pick is booked for you as soon as you submit — no waiting for approval. You can cancel it anytime under "Requested Services."';
    clearFieldError(svcContactInput);
    renderSlotSummary(null);
    slotPicker = createSlotPicker(slotPickerEl, {
      type: svc.name,
      records: allBookings,
      closures,
      layout: 'calendar',
      onChange: renderSlotSummary,
    });

    destroyPinMap();
    svcDynamicFields.innerHTML = svc.fields.map(f => {
      if (f.kind === 'name') return nameFieldsHtml(f.id, escapeHtml(f.label), { required: f.required, spanFull: !!f.span2 });
      if (f.kind === 'map') return pinMapFieldHtml(f);
      return `
      <div class="${f.span2 ? 'sm:col-span-2' : ''}">
        <label class="form-label" for="${f.id}">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
        <input type="text" id="${f.id}" class="form-input" placeholder="${f.placeholder || ''}" />
      </div>`;
    }).join('');

    // The form is a full-screen view beside the sidebar that fits in one
    // screen and locks the services list behind it.
    formView.classList.remove('hidden', 'is-closing');
    document.body.classList.add('req-screen-open');
    document.getElementById('req-screen-body').scrollTop = 0;
    formView.querySelectorAll('.req-screen-col').forEach(col => { col.scrollTop = 0; });
    const mapField = svc.fields.find(f => f.kind === 'map');
    formView.classList.toggle('svc-has-map', !!mapField);
    if (mapField) initPinMap(mapField);
    else svcDynamicFields.querySelector('input')?.focus({ preventScroll: true });
  }

  /* --- Pin location map (House Blessing) --- */
  function pinMapFieldHtml(f) {
    return `
      <div class="sm:col-span-2 pin-map-field" id="q-${f.id}">
        <p class="form-label">Pin Your Exact Location <span class="pin-map-optional">(recommended)</span></p>
        <div class="pin-map-wrap">
          <div id="${f.id}" class="pin-map" role="application" aria-label="Map — tap to place a pin on your house"></div>
          <div class="pin-map-actions">
            <button type="button" class="pin-map-btn" data-pin-action="locate">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="7" stroke-width="1.6"/></svg>
              Use my current location
            </button>
            <button type="button" class="pin-map-btn" data-pin-action="find">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
              Find my address
            </button>
            <span id="${f.id}-status" class="pin-map-status">Tap the map to drop a pin on your house.</span>
          </div>
        </div>
      </div>`;
  }

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
          setStatus('Address filled in from your pin — please check it and add your house/unit number if it’s missing.', 'ok');
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
          if (!address) { setStatus('Type your Complete Address below first, then tap "Find my address."', 'error'); return; }
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

  function destroyPinMap() {
    if (pinMap) { pinMap.destroy(); pinMap = null; }
  }

  function goToMenu() {
    if (formView.classList.contains('hidden')) return;
    selectedTypeId = null;
    slotPicker = null;
    document.body.classList.remove('req-screen-open');
    const finish = () => { formView.classList.add('hidden'); destroyPinMap(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    formView.classList.add('is-closing');
    formView.addEventListener('animationend', () => {
      formView.classList.remove('is-closing');
      // Another service was picked mid-animation: keep it open
      if (!document.body.classList.contains('req-screen-open')) finish();
    }, { once: true });
  }

  document.getElementById('btn-back-to-menu').addEventListener('click', goToMenu);
  document.getElementById('btn-cancel-request').addEventListener('click', goToMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !formView.classList.contains('hidden')) goToMenu();
  });

  svcContactInput.addEventListener('input', () => clearFieldError(svcContactInput));

  svcSubmitBtn.addEventListener('click', async () => {
    if (!selectedTypeId) return;
    const svc = serviceTypes.find(s => s.id === selectedTypeId);

    let hasError = false;
    svc.fields.filter(f => f.required && f.kind !== 'map').forEach(f => {
      if (f.kind === 'name') {
        const firstEl = document.getElementById(`${f.id}-first`);
        const lastEl = document.getElementById(`${f.id}-last`);
        [firstEl, lastEl].forEach(clearFieldError);
        if (!nameFieldsFilled(f.id)) {
          setFieldError(lastEl, `${f.label} is required.`);
          hasError = true;
        }
        return;
      }
      const el = document.getElementById(f.id);
      clearFieldError(el);
      if (!el.value.trim()) { setFieldError(el, `${f.label} is required.`); hasError = true; }
    });

    const slot = slotPicker && slotPicker.getValue();
    if (!slot) { slotPickerEl.classList.add('has-error'); hasError = true; }

    clearFieldError(svcContactInput);
    if (!svcContactInput.value.trim()) { setFieldError(svcContactInput, 'Contact number is required.'); hasError = true; }

    if (hasError) { window.showToast(slot ? 'Please fix the highlighted fields.' : 'Please pick a schedule.', true); return; }

    const details = {};
    svc.fields.forEach(f => {
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
        contact: svcContactInput.value.trim(),
        notes: svcNotesInput.value.trim() || undefined,
        details: JSON.stringify(details),
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

      goToMenu();
      window.showToast(approval
        ? `${svc.name} requested for ${fmtLongDate(slot.date)} at ${slot.time}. The parish office will approve it soon — track it under "Requested Services."`
        : `${svc.name} booked for ${fmtLongDate(slot.date)} at ${slot.time}. See it under "Requested Services."`);
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      svcSubmitBtn.disabled = false;
    }
  });

});