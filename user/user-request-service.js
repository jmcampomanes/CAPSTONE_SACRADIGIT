/* ============================================
   SacraDigit — User Request a Service Scripts (AWS Amplify)
   Runs after user-shell.js.
   Browsing + submitting only — the tracking log now
   lives on user-requested-services.html/.js. Backed
   by the Blessing model.

   Scheduling uses the parish's fixed slots from
   ../service-schedule.js: the parishioner picks an
   open slot and the request is saved directly as
   status 'scheduled' — no admin approval step.
   ============================================ */

import { client } from '../amplify-init.js';
import { watchTakenSlots, fetchTakenSlots } from '../public-data.js';
import { currentUserName } from '../auth.js';
import { createSlotPicker, slotHasRoom, locationFor, describeSchedule, watchClosures } from '../service-schedule.js';
import { nameFieldsHtml, readNameFields, nameFieldsFilled, isNameEmpty } from '../name-utils.js';
import { createPinMap, formatLatLng } from '../pin-map.js';
import { SERVICE_CATEGORIES, SERVICE_TYPES } from '../service-catalog.js';

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
  function svcCardHtml(s) {
    return `
    <button type="button" class="svc-type-card" data-id="${s.id}">
      <div class="svc-icon" style="background-color:${s.iconBg};color:${s.iconColor};">${s.icon}</div>
      <p class="svc-type-name">${escapeHtml(s.name)}</p>
      <p class="svc-type-desc">${escapeHtml(s.desc)}</p>
      <p class="svc-type-sched">${escapeHtml(describeSchedule(s.name))}</p>
      <span class="svc-type-cta">Start request
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
      </span>
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

    pinMap = createPinMap(document.getElementById(field.id), {
      onChange: (latlng) => { if (latlng) setStatus(`Pinned: ${formatLatLng(latlng)} — drag the pin to adjust.`, 'ok'); },
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
          await pinMap.locateMe();
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

    try {
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
        status: 'scheduled',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      goToMenu();
      window.showToast(`${svc.name} booked for ${fmtLongDate(slot.date)} at ${slot.time}. See it under "Requested Services."`);
    } catch (err) {
      console.error('Failed to submit request:', err);
      window.showToast(err.message || "Couldn't submit the request.", true);
    } finally {
      svcSubmitBtn.disabled = false;
    }
  });

});