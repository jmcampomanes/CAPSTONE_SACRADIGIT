/* ============================================
   SacraDigit Admin — "+ Service" walk-in booking
   For parishioners who come to (or call) the
   parish office instead of booking online. The
   office picks the service, fills in the same
   form the parishioner would, and books a fixed
   slot for them. Used on Schedule Offers and
   Blessings.

   The screen is built here (no HTML needed on the
   page) using the full-screen "svc-screen" styles
   in ../service-schedule.css. It saves a normal
   Blessing record (status 'scheduled'), exactly
   like an online booking, so it shows up on both
   admin pages and in the parishioner's Requested
   Services if the name matches.
   ============================================ */

import { client } from '../amplify-init.js';
import { SERVICE_CATEGORIES, SERVICE_TYPES } from '../service-catalog.js';
import { createSlotPicker, slotHasRoom, locationFor, describeSchedule, logBookingAction, MAP_PIN_LABEL, googleMapsUrl } from '../service-schedule.js';
import { nameFieldsHtml, readNameFields, setNameFields, nameFieldsFilled, isNameEmpty, formatFullName } from '../name-utils.js';
import { createPinMap, formatLatLng } from '../pin-map.js';
import { notifyServiceUpdate } from '../email-notify.js';

// Added to every walk-in's details so staff can tell how it was booked.
export const BOOKED_BY_LABEL = 'Booked By';

const escapeHtml = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const detailText = (v) => (v && typeof v === 'object')
  ? [v.firstName, v.middleName, v.lastName, v.extension].filter(Boolean).join(' ')
  : String(v ?? '');
const fmtLongDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/**
 * getRecords()  — every Blessing record (so full slots show as taken)
 * getClosures() — 'No Services' closure ranges
 * Returns { open(), refresh() }; call refresh() when those change.
 */
export function initWalkInService({ showToast, getRecords, getClosures, backLabel = 'Back' }) {
  document.body.insertAdjacentHTML('beforeend', `
  <section id="walkin-screen" class="svc-screen hidden" role="dialog" aria-modal="true" aria-labelledby="walkin-title">
    <header class="svc-screen-bar">
      <button type="button" id="walkin-back" class="svc-screen-back">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        ${escapeHtml(backLabel)}
      </button>
      <div class="svc-screen-heading">
        <h2 class="svc-screen-title" id="walkin-title">New Service — Walk-in</h2>
        <p class="svc-screen-sub">For parishioners who asked at the parish office. The office can book any open slot from tomorrow onward.</p>
      </div>
    </header>

    <div class="svc-screen-body" id="walkin-body">
      <div class="svc-screen-cols">
        <!-- Left: who and what -->
        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title">Service &amp; Requester</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="form-label" for="walkin-service">Service <span class="text-red-500">*</span></label>
              <select id="walkin-service" class="form-input">
                <option value="">Select a service</option>
                ${SERVICE_CATEGORIES.map(cat => `
                  <optgroup label="${escapeHtml(cat.label)}">
                    ${SERVICE_TYPES.filter(s => s.category === cat.key).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
                  </optgroup>`).join('')}
              </select>
              <p class="text-xs text-gray-400 mt-1 hidden" id="walkin-service-sched"></p>
            </div>
            ${nameFieldsHtml('walkin-requester', 'Requester (person who asked)', { required: true, spanFull: true })}
            <div>
              <label class="form-label" for="walkin-contact">Contact Number <span class="text-red-500">*</span></label>
              <input type="tel" id="walkin-contact" class="form-input" placeholder="e.g. 0917 123 4567" />
            </div>
            <div>
              <label class="form-label" for="walkin-email">Email <span class="text-gray-400 font-normal">(optional)</span></label>
              <input type="email" id="walkin-email" class="form-input" placeholder="for reminders" />
            </div>
          </div>

          <div id="walkin-fields-wrap" class="hidden mt-4">
            <h3 class="svc-screen-col-title" id="walkin-fields-title">Service Details</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="walkin-fields"></div>
          </div>

          <div class="mt-4">
            <label class="form-label" for="walkin-notes">Notes <span class="text-gray-400 font-normal">(optional)</span></label>
            <textarea id="walkin-notes" class="form-input" rows="2" placeholder="e.g. Paid the stipend at the office; bring baptismal candle."></textarea>
          </div>
        </div>

        <!-- Right: the slot -->
        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title">Pick a Schedule <span class="text-red-500">*</span></h3>
          <div id="walkin-slot-picker" class="slot-picker"><p class="slot-empty">Choose a service first.</p></div>
          <p id="walkin-slot-summary" class="slot-summary hidden"></p>
        </div>
      </div>
    </div>

    <footer class="svc-screen-footer">
      <button type="button" id="walkin-cancel" class="btn-secondary">Cancel</button>
      <button type="button" id="walkin-submit" class="btn-lavender">Book Service</button>
    </footer>
  </section>`);

  const $ = (id) => document.getElementById(id);
  const screen     = $('walkin-screen');
  const serviceSel = $('walkin-service');
  const fieldsWrap = $('walkin-fields-wrap');
  const fieldsEl   = $('walkin-fields');
  const pickerEl   = $('walkin-slot-picker');
  const summaryEl  = $('walkin-slot-summary');
  const submitBtn  = $('walkin-submit');

  let picker = null;
  let pinMap = null;

  const currentService = () => SERVICE_TYPES.find(s => s.id === serviceSel.value) || null;

  /* ---------- field errors ---------- */
  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) { msg = document.createElement('p'); msg.className = 'form-error-msg'; input.insertAdjacentElement('afterend', msg); }
    msg.textContent = message;
  }
  function clearFieldError(input) {
    if (!input) return;
    input.classList.remove('has-error');
    input.parentElement.querySelector('.form-error-msg')?.remove();
  }
  screen.addEventListener('input', (e) => { if (e.target.matches('.form-input')) clearFieldError(e.target); });

  /* ---------- open / close ---------- */
  function open() {
    reset();
    screen.classList.remove('hidden', 'is-closing');
    document.body.classList.add('svc-screen-open');
    $('walkin-body').scrollTop = 0;
    serviceSel.focus({ preventScroll: true });
  }

  function close() {
    if (screen.classList.contains('hidden')) return;
    document.body.classList.remove('svc-screen-open');
    const finish = () => { screen.classList.add('hidden'); destroyPinMap(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    screen.classList.add('is-closing');
    screen.addEventListener('animationend', () => {
      screen.classList.remove('is-closing');
      if (!document.body.classList.contains('svc-screen-open')) finish();
    }, { once: true });
  }

  function reset() {
    serviceSel.value = '';
    setNameFields('walkin-requester', null);
    ['walkin-contact', 'walkin-email', 'walkin-notes'].forEach(id => { $(id).value = ''; });
    screen.querySelectorAll('.form-input.has-error').forEach(clearFieldError);
    renderServiceFields();
  }

  $('walkin-back').addEventListener('click', close);
  $('walkin-cancel').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !screen.classList.contains('hidden')) close(); });

  /* ---------- service-specific fields + slot picker ---------- */
  function renderServiceFields() {
    destroyPinMap();
    const svc = currentService();
    summaryEl.classList.add('hidden');
    pickerEl.classList.remove('has-error');
    $('walkin-service-sched').classList.toggle('hidden', !svc);

    if (!svc) {
      picker = null;
      pickerEl.innerHTML = '<p class="slot-empty">Choose a service first.</p>';
      fieldsWrap.classList.add('hidden');
      fieldsEl.innerHTML = '';
      return;
    }

    $('walkin-service-sched').textContent = `Regular schedule: ${describeSchedule(svc.name)}`;
    $('walkin-fields-title').textContent = `${svc.name} Details`;
    fieldsEl.innerHTML = svc.fields.map(f => {
      if (f.kind === 'name') return nameFieldsHtml(`walkin-f-${f.id}`, escapeHtml(f.label), { required: f.required, spanFull: true });
      if (f.kind === 'map') return pinFieldHtml(f);
      return `
        <div class="${f.span2 ? 'sm:col-span-2' : ''}">
          <label class="form-label" for="walkin-f-${f.id}">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
          <input type="text" id="walkin-f-${f.id}" class="form-input" placeholder="${escapeHtml(f.placeholder || '')}" />
        </div>`;
    }).join('');
    fieldsWrap.classList.toggle('hidden', !svc.fields.length);

    const mapField = svc.fields.find(f => f.kind === 'map');
    if (mapField) initPinMap(mapField);

    picker = createSlotPicker(pickerEl, {
      type: svc.name,
      records: getRecords(),
      closures: getClosures(),
      ignoreLead: true, // walk-ins skip the service's lead time (earliest is still tomorrow)
      layout: 'calendar',
      onChange: (slot) => {
        pickerEl.classList.remove('has-error');
        summaryEl.classList.toggle('hidden', !slot);
        if (slot) summaryEl.textContent = `Selected: ${fmtLongDate(slot.date)} at ${slot.time}`;
      },
    });
  }

  serviceSel.addEventListener('change', () => { clearFieldError(serviceSel); renderServiceFields(); });

  /* ---------- House Blessing map pin ---------- */
  function pinFieldHtml(f) {
    return `
      <div class="sm:col-span-2" id="walkin-q-${f.id}">
        <p class="form-label">Pin the Exact Location <span class="pin-map-optional">(recommended)</span></p>
        <div class="pin-map-wrap">
          <div id="walkin-f-${f.id}" class="pin-map" role="application" aria-label="Map — click to place a pin on the house"></div>
          <div class="pin-map-actions">
            <button type="button" class="pin-map-btn" data-pin-action="find">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
              Find the address
            </button>
            <span id="walkin-f-${f.id}-status" class="pin-map-status">Type the address below, then “Find the address”, or click the map.</span>
          </div>
        </div>
      </div>`;
  }

  function initPinMap(field) {
    const statusEl = $(`walkin-f-${field.id}-status`);
    const setStatus = (text, state = '') => { statusEl.textContent = text; statusEl.dataset.state = state; };
    pinMap = createPinMap($(`walkin-f-${field.id}`), {
      onChange: (latlng) => { if (latlng) setStatus(`Pinned: ${formatLatLng(latlng)} — drag the pin to adjust.`, 'ok'); },
    });
    setTimeout(() => pinMap?.resize(), 300); // after the screen finishes sliding in
    $(`walkin-q-${field.id}`).addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-pin-action]');
      if (!btn || !pinMap) return;
      const address = $(`walkin-f-${field.addressField}`)?.value.trim();
      if (!address) { setStatus('Type the address below first, then click “Find the address”.', 'error'); return; }
      btn.disabled = true;
      try { setStatus('Looking up the address…'); await pinMap.findAddress(address); }
      catch (err) { setStatus(err.message, 'error'); }
      finally { btn.disabled = false; }
    });
  }

  function destroyPinMap() {
    if (pinMap) { pinMap.destroy(); pinMap = null; }
  }

  /* ---------- save ---------- */
  submitBtn.addEventListener('click', async () => {
    const svc = currentService();
    let hasError = false;

    if (!svc) { setFieldError(serviceSel, 'Please choose a service.'); showToast('Please choose a service.', true); return; }

    const reqLast = $('walkin-requester-last');
    [$('walkin-requester-first'), reqLast].forEach(clearFieldError);
    if (!nameFieldsFilled('walkin-requester')) { setFieldError(reqLast, 'Requester’s first and last name are required.'); hasError = true; }

    const contactEl = $('walkin-contact');
    clearFieldError(contactEl);
    if (!contactEl.value.trim()) { setFieldError(contactEl, 'Contact number is required.'); hasError = true; }

    svc.fields.filter(f => f.required && f.kind !== 'map').forEach(f => {
      if (f.kind === 'name') {
        const last = $(`walkin-f-${f.id}-last`);
        clearFieldError(last);
        if (!nameFieldsFilled(`walkin-f-${f.id}`)) { setFieldError(last, `${f.label} is required.`); hasError = true; }
        return;
      }
      const el = $(`walkin-f-${f.id}`);
      clearFieldError(el);
      if (!el.value.trim()) { setFieldError(el, `${f.label} is required.`); hasError = true; }
    });

    const slot = picker && picker.getValue();
    if (!slot) { pickerEl.classList.add('has-error'); hasError = true; }

    if (hasError) { showToast(slot ? 'Please fill in the highlighted fields.' : 'Please fill in the highlighted fields and pick a schedule.', true); return; }

    // Same details shape the parishioner form saves, keyed by field label.
    const details = {};
    svc.fields.forEach(f => {
      if (f.kind === 'map') { const pin = pinMap?.getValue(); if (pin) details[f.label] = formatLatLng(pin); return; }
      if (f.kind === 'name') { const n = readNameFields(`walkin-f-${f.id}`); if (!isNameEmpty(n)) details[f.label] = n; return; }
      const v = $(`walkin-f-${f.id}`).value.trim();
      if (v) details[f.label] = v;
    });
    details[BOOKED_BY_LABEL] = 'Parish Office (walk-in)';

    const requesterName = formatFullName(readNameFields('walkin-requester'));
    submitBtn.disabled = true;
    try {
      // Re-check against the freshest data so a slot can't be double-booked.
      const { data: latest } = await client.models.Blessing.list({ limit: 1000 });
      if (!slotHasRoom(svc.name, latest || getRecords(), slot.date, slot.time, { closures: getClosures() })) {
        picker.refresh(latest || getRecords());
        throw new Error('That slot was just taken. Please pick another time.');
      }

      const email = $('walkin-email').value.trim();
      const result = await client.models.Blessing.create({
        requesterName,
        type: svc.name,
        contact: $('walkin-contact').value.trim(),
        ...(email ? { email } : {}),
        notes: $('walkin-notes').value.trim() || undefined,
        details: JSON.stringify(details),
        location: locationFor(svc.name, details),
        preferredDate: slot.date,
        date: slot.date,
        time: slot.time,
        status: 'scheduled',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      logBookingAction(client, { action: 'Walk-in', record: result.data });
      if (email) {
        const detailsLines = Object.entries(details)
          .filter(([k]) => k !== BOOKED_BY_LABEL && k !== MAP_PIN_LABEL)
          .map(([k, v]) => [k, detailText(v)]).filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .concat(details[MAP_PIN_LABEL] ? [`Pinned Location: ${googleMapsUrl(details[MAP_PIN_LABEL])}`] : []);
        notifyServiceUpdate({
          to: email, name: requesterName, serviceType: svc.name, status: 'scheduled',
          date: fmtLongDate(slot.date), time: slot.time, location: locationFor(svc.name, details),
          contact: $('walkin-contact').value.trim(), detailsLines,
        });
      }
      showToast(`${svc.name} booked for ${requesterName} — ${fmtLongDate(slot.date)} at ${slot.time}.`);
      close();
    } catch (err) {
      console.error('Failed to book walk-in service:', err);
      showToast(err.message || "Couldn't book the service.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    open,
    /** Call when the records or closures change, so taken slots update live. */
    refresh() {
      if (!picker) return;
      picker.refresh(getRecords());
      picker.setClosures(getClosures());
    },
  };
}
