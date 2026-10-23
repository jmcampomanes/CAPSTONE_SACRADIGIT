/* ============================================
   SacraDigit Admin — "+ Service" walk-in booking
   For parishioners who come to (or call) the
   parish office instead of booking online. Used on
   Schedule Offers and Blessings.

   It works like the parishioner's own Request a
   Service, so the office and parishioners see the
   same thing:
     1. "What do they need?" — the same Blessing /
        Sacrament / Mass buttons and service cards
        (../service-catalog.js).
     2. The same form: a "Details" column (the
        service's own fields in the same order, then
        contact and notes) and "Choose a Schedule"
        with the same slot calendar, the map under it.
   The office also types who asked, can add an email
   for reminders, and books any open slot from
   tomorrow on (no lead time, no approval wait).

   The screen is built here (no HTML needed on the
   page) using the full-screen "svc-screen" styles in
   ../service-schedule.css. It saves a normal Blessing
   record (status 'scheduled'), exactly like an online
   booking, so it shows up on both admin pages and in
   the parishioner's Requested Services if the name
   matches.
   ============================================ */

import { client } from '../amplify-init.js';
import { SERVICE_CATEGORIES, SERVICE_TYPES, SERVICE_NEEDS, serviceCardHtml, needButtonsHtml } from '../service-catalog.js';
import { createSlotPicker, slotHasRoom, locationFor, logBookingAction, MAP_PIN_LABEL, googleMapsUrl } from '../service-schedule.js';
import { nameFieldsHtml, readNameFields, setNameFields, nameFieldsFilled, isNameEmpty, formatFullName } from '../name-utils.js';
import { createPinMap, formatLatLng } from '../pin-map.js';
import { notifyServiceUpdate } from '../email-notify.js';
import { reportEmail } from './admin-ui.js';
import { isMobile, mobileDigits, MOBILE_HINT } from '../mobile-number.js';

// Added to every walk-in's details so staff can tell how it was booked.
export const BOOKED_BY_LABEL = 'Booked By';

const escapeHtml = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const detailText = (v) => (v && typeof v === 'object')
  ? [v.firstName, v.middleName, v.lastName, v.extension].filter(Boolean).join(' ')
  : String(v ?? '');
const fmtLongDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const BACK_ICON = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
const INFO_ICON = '<svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:#5b5fa8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
const PLUS_ICON = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>';

const PICK_TITLE = 'New Walk-in Request';
const PICK_SUB = 'For parishioners who asked at the parish office or by phone. Choose what they need.';

/**
 * getRecords()  — every Blessing record (so full slots show as taken)
 * getClosures() — 'No Services' closure ranges
 * Returns { open(), refresh() }; call refresh() when those change.
 */
export function initWalkInService({ showToast, getRecords, getClosures, backLabel = 'Back' }) {
  document.body.insertAdjacentHTML('beforeend', `
  <section id="walkin-screen" class="svc-screen hidden" role="dialog" aria-modal="true" aria-labelledby="walkin-title">
    <header class="svc-screen-bar">
      <button type="button" id="walkin-back" class="svc-screen-back">${BACK_ICON}<span id="walkin-back-label">${escapeHtml(backLabel)}</span></button>
      <div id="walkin-icon" class="svc-icon svc-screen-icon hidden" aria-hidden="true"></div>
      <div class="svc-screen-heading">
        <h2 class="svc-screen-title" id="walkin-title">${PICK_TITLE}</h2>
        <p class="svc-screen-sub" id="walkin-sub">${PICK_SUB}</p>
      </div>
    </header>

    <div class="svc-screen-body" id="walkin-body">
      <!-- 1. What do they need? (same as Request a Service) -->
      <div id="walkin-pick" class="walkin-pick">
        <h3 class="svc-need-title">What do they need?</h3>
        <div class="svc-need-options" id="walkin-need-options" role="group" aria-label="What do they need?">${needButtonsHtml()}</div>
        <div id="walkin-list" class="walkin-list hidden">
          <p class="svc-category-desc" id="walkin-cat-desc"></p>
          <div class="svc-type-row" id="walkin-type-row"></div>
        </div>
      </div>

      <!-- 2. The form (same layout as the parishioner's service page) -->
      <div id="walkin-form" class="svc-screen-cols hidden">
        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title">Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${nameFieldsHtml('walkin-requester', 'Person who asked', { required: true, spanFull: true })}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4" id="walkin-fields"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label class="form-label" for="walkin-contact">Contact Number <span class="text-red-500">*</span></label>
              <input type="tel" id="walkin-contact" class="form-input" data-mobile inputmode="numeric" autocomplete="tel" placeholder="e.g. 09171234567" />
            </div>
            <div>
              <label class="form-label" for="walkin-email">Email <span class="text-gray-400 font-normal">(optional)</span></label>
              <input type="email" id="walkin-email" class="form-input" placeholder="for reminders" />
            </div>
          </div>
          <div class="mt-4">
            <label class="form-label" for="walkin-notes">Additional Notes (optional)</label>
            <textarea id="walkin-notes" class="form-input" rows="3" placeholder="e.g. Paid the stipend at the office; bring baptismal candle."></textarea>
          </div>
          <div class="req-info-note mt-4">
            ${INFO_ICON}
            <p class="text-xs text-gray-600 leading-relaxed">These are the parish’s fixed schedules. A walk-in is booked right away — no approval needed — and the office can book any open slot from tomorrow on.</p>
          </div>
        </div>

        <div class="svc-screen-col">
          <h3 class="svc-screen-col-title">Choose a Schedule <span class="text-red-500">*</span></h3>
          <div>
            <div id="walkin-slot-picker" class="slot-picker"></div>
            <p id="walkin-slot-summary" class="slot-summary hidden"></p>
          </div>
          <div id="walkin-map-slot"></div>
        </div>
      </div>
    </div>

    <footer class="svc-screen-footer">
      <button type="button" id="walkin-cancel" class="btn-secondary">Cancel</button>
      <button type="button" id="walkin-submit" class="btn-lavender hidden">${PLUS_ICON} Book Service</button>
    </footer>
  </section>`);

  const $ = (id) => document.getElementById(id);
  const screen     = $('walkin-screen');
  const pickEl     = $('walkin-pick');
  const formEl     = $('walkin-form');
  const fieldsEl   = $('walkin-fields');
  const pickerEl   = $('walkin-slot-picker');
  const summaryEl  = $('walkin-slot-summary');
  const submitBtn  = $('walkin-submit');
  const iconEl     = $('walkin-icon');

  let chosen = null;   // the service being booked
  let picker = null;
  let pinMap = null;
  const currentService = () => chosen;

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

  /* ---------- 1. What do they need? ---------- */
  function showNeed(key) {
    const need = SERVICE_NEEDS.find(n => n.key === key);
    const cat = SERVICE_CATEGORIES.find(c => c.key === key);
    $('walkin-need-options').querySelectorAll('.svc-need-btn').forEach(b => {
      const on = b.dataset.need === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('walkin-list').classList.toggle('hidden', !need);
    if (!need) return;
    $('walkin-cat-desc').textContent = cat?.desc || '';
    // Walk-ins are booked right away, so no "Needs approval" tag here.
    $('walkin-type-row').innerHTML = SERVICE_TYPES.filter(s => s.category === key)
      .map(s => serviceCardHtml(s, { cta: 'Book for them', showApproval: false })).join('');
  }
  $('walkin-need-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.svc-need-btn');
    if (btn) showNeed(btn.dataset.need);
  });
  $('walkin-type-row').addEventListener('click', (e) => {
    const card = e.target.closest('.svc-type-card');
    if (card) chooseService(SERVICE_TYPES.find(s => s.id === card.dataset.id));
  });

  function showPick() {
    destroyPinMap();
    chosen = null;
    picker = null;
    pickEl.classList.remove('hidden');
    formEl.classList.add('hidden');
    submitBtn.classList.add('hidden');
    iconEl.classList.add('hidden');
    $('walkin-title').textContent = PICK_TITLE;
    $('walkin-sub').textContent = PICK_SUB;
    $('walkin-back-label').textContent = backLabel;
    $('walkin-body').scrollTop = 0;
  }

  /* ---------- 2. The form ---------- */
  function chooseService(svc) {
    if (!svc) return;
    chosen = svc;
    pickEl.classList.add('hidden');
    formEl.classList.remove('hidden');
    submitBtn.classList.remove('hidden');
    $('walkin-title').textContent = `Walk-in — ${svc.name}`;
    $('walkin-sub').textContent = svc.desc;
    $('walkin-back-label').textContent = 'Change service';
    iconEl.style.backgroundColor = svc.iconBg;
    iconEl.style.color = svc.iconColor;
    iconEl.innerHTML = svc.icon;
    iconEl.classList.remove('hidden');
    renderServiceFields();
    $('walkin-body').scrollTop = 0;
    $('walkin-requester-first')?.focus({ preventScroll: true });
  }

  function renderServiceFields() {
    destroyPinMap();
    const svc = currentService();
    summaryEl.classList.add('hidden');
    pickerEl.classList.remove('has-error');
    // Same order as the parishioner's page: the service's own fields, the map under the schedule.
    fieldsEl.innerHTML = svc.fields.map(f => {
      if (f.kind === 'name') return nameFieldsHtml(`walkin-f-${f.id}`, escapeHtml(f.label), { required: f.required, spanFull: true });
      if (f.kind === 'map') return '';
      if (f.kind === 'note') return `<p class="svc-field-note sm:col-span-2">${escapeHtml(f.text)}</p>`;
      return `
        <div class="${f.span2 ? 'sm:col-span-2' : ''}">
          <label class="form-label" for="walkin-f-${f.id}">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}</label>
          <input type="text" id="walkin-f-${f.id}" class="form-input" placeholder="${escapeHtml(f.placeholder || '')}" />
        </div>`;
    }).join('');
    fieldsEl.classList.toggle('hidden', !fieldsEl.innerHTML.trim());

    const mapField = svc.fields.find(f => f.kind === 'map');
    $('walkin-map-slot').innerHTML = mapField ? pinFieldHtml(mapField) : '';
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

  /* ---------- open / close ---------- */
  function open() {
    reset();
    showPick();
    showNeed(null);
    screen.classList.remove('hidden', 'is-closing');
    document.body.classList.add('svc-screen-open');
    $('walkin-need-options').querySelector('.svc-need-btn')?.focus({ preventScroll: true });
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
    setNameFields('walkin-requester', null);
    ['walkin-contact', 'walkin-email', 'walkin-notes'].forEach(id => { $(id).value = ''; });
    screen.querySelectorAll('.form-input.has-error').forEach(clearFieldError);
  }

  // Back: from the form to the service list ("Change service"); from the list, out.
  $('walkin-back').addEventListener('click', () => {
    if (chosen) { const cat = chosen.category; showPick(); showNeed(cat); }
    else close();
  });
  $('walkin-cancel').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !screen.classList.contains('hidden')) close(); });

  /* ---------- Map pin (House Blessing, Business Dedication) — under the schedule, like the parishioner page ---------- */
  function pinFieldHtml(f) {
    const place = f.place === 'business' ? 'business' : 'house';
    return `
      <div class="pin-map-field mt-4" id="walkin-q-${f.id}">
        <p class="form-label">Pin the location on the map <span class="pin-map-optional">(optional)</span></p>
        <p class="pin-map-why">Helps the priest find the ${place}. You can skip this.</p>
        <div class="pin-map-wrap">
          <div id="walkin-f-${f.id}" class="pin-map" role="application" aria-label="Map — click to place a pin on the ${place}"></div>
          <div class="pin-map-actions">
            <button type="button" class="pin-map-btn" data-pin-action="find">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
              Find the address
            </button>
            <span id="walkin-f-${f.id}-status" class="pin-map-status">Type the address, then “Find the address”, or click the map.</span>
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
      if (!address) { setStatus('Type the address first, then click “Find the address”.', 'error'); return; }
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
    if (!svc) return;
    let hasError = false;

    const reqLast = $('walkin-requester-last');
    [$('walkin-requester-first'), reqLast].forEach(clearFieldError);
    if (!nameFieldsFilled('walkin-requester')) { setFieldError(reqLast, 'First and last name of the person who asked are required.'); hasError = true; }

    const contactEl = $('walkin-contact');
    clearFieldError(contactEl);
    if (!contactEl.value.trim()) { setFieldError(contactEl, 'Contact number is required.'); hasError = true; }
    else if (!isMobile(contactEl.value)) { setFieldError(contactEl, MOBILE_HINT); hasError = true; }

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

    if (hasError) {
      showToast(slot ? 'Please fill in the highlighted fields.' : 'Please fill in the highlighted fields and pick a schedule.', true);
      screen.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Same details shape the parishioner form saves, keyed by field label.
    const details = {};
    svc.fields.forEach(f => {
      if (f.kind === 'note') return;
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
        contact: mobileDigits($('walkin-contact').value),
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
      const bookedMsg = `${svc.name} booked for ${requesterName} — ${fmtLongDate(slot.date)} at ${slot.time}.`;
      if (email) {
        const detailsLines = Object.entries(details)
          .filter(([k]) => k !== BOOKED_BY_LABEL && k !== MAP_PIN_LABEL)
          .map(([k, v]) => [k, detailText(v)]).filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .concat(details[MAP_PIN_LABEL] ? [`Pinned Location: ${googleMapsUrl(details[MAP_PIN_LABEL])}`] : []);
        reportEmail(notifyServiceUpdate({
          to: email, name: requesterName, serviceType: svc.name, status: 'scheduled',
          date: fmtLongDate(slot.date), time: slot.time, location: locationFor(svc.name, details),
          contact: mobileDigits($('walkin-contact').value), detailsLines,
        }), requesterName, bookedMsg);
      } else showToast(bookedMsg); // no email typed in — nothing to report
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
