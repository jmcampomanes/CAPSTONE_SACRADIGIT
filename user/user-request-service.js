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
import { createSlotPicker, slotHasRoom, locationFor, describeSchedule, watchClosures, MAP_PIN_LABEL } from '../service-schedule.js';
import { nameFieldsHtml, readNameFields, nameFieldsFilled, isNameEmpty } from '../name-utils.js';
import { createPinMap, formatLatLng } from '../pin-map.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = 'Maria P. Santos';

  // Groups the catalog below into three rows on the "Services We Offer"
  // panel — Blessings, Sacraments, Special Masses (in that order) — each
  // with its own short description, so it's clear at a glance what kind
  // of request each card is instead of one undifferentiated grid. Order
  // here is also the on-page row order.
  const SERVICE_CATEGORIES = [
    { key: 'blessing', label: 'Blessings', desc: 'Blessings for a home, vehicle, or business.' },
    { key: 'sacrament', label: 'Sacraments', desc: 'The sacraments of the Catholic faith.' },
    { key: 'special-mass', label: 'Special Masses', desc: 'A Mass offered for a specific intention or occasion.' },
  ];

  // All 7 sacraments of the Catholic Church are listed below, in their
  // traditional order (Baptism, Confirmation, Eucharist, Reconciliation,
  // Anointing of the Sick, Matrimony, Holy Orders) — each with its own
  // short description, matching the Blessings/Special Masses cards.
  const serviceTypes = [
    { id: 'baptism', name: 'Baptism', category: 'sacrament', desc: 'Sacrament of initiation for infants, children, or adults.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3C8 3 5 6 5 9c0 4 7 12 7 12s7-8 7-12c0-3-3-6-7-6z"/></svg>`,
      fields: [
        { id: 'child-name', label: "Child's Full Name", kind: 'name', required: true, span2: true },
        { id: 'father-name', label: "Father's Name", kind: 'name', required: false },
        { id: 'mother-name', label: "Mother's Maiden Name", kind: 'name', required: false },
      ] },
    { id: 'confirmation', name: 'Confirmation', category: 'sacrament', desc: 'Sacrament of the Holy Spirit, completing Christian initiation.',
      iconBg: 'rgba(15,138,122,0.14)', iconColor: '#0f8a7a',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.657 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/></svg>`,
      fields: [
        { id: 'candidate-name-conf', label: "Candidate's Full Name", kind: 'name', required: true, span2: true },
        { id: 'sponsor-name-conf', label: "Confirmation Sponsor's Name", kind: 'name', required: false, span2: true },
      ] },
    { id: 'first-communion', name: 'First Communion', category: 'sacrament', desc: 'Sacrament of the Holy Eucharist, first reception.',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      fields: [
        { id: 'child-name-fc', label: "Child's Full Name", kind: 'name', required: true, span2: true },
        { id: 'parent-1-fc', label: 'Parent 1', kind: 'name', required: false, span2: true },
        { id: 'parent-2-fc', label: 'Parent 2', kind: 'name', required: false, span2: true },
      ] },
    { id: 'confession', name: 'Confession / Reconciliation', category: 'sacrament', desc: 'Sacrament of Penance — private confession and absolution.',
      iconBg: 'rgba(122,78,168,0.14)', iconColor: '#7a4ea8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
      fields: [
        { id: 'penitent-name-conf', label: 'Your Full Name', kind: 'name', required: false, span2: true },
      ] },
    { id: 'anointing-of-the-sick', name: 'Anointing of the Sick', category: 'sacrament', desc: 'Sacrament of healing and comfort for the seriously ill or elderly.',
      iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-3-3v6m9-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      fields: [
        { id: 'patient-name', label: "Patient's Full Name", kind: 'name', required: true, span2: true },
        { id: 'location-anointing', label: 'Location (Home / Hospital)', placeholder: "e.g. St. Luke's Medical Center, Room 204", required: true, span2: true },
      ] },
    { id: 'wedding', name: 'Wedding', category: 'sacrament', desc: 'Sacrament of matrimony for the Catholic rite.',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
      fields: [
        { id: 'groom-name', label: "Groom's Full Name", kind: 'name', required: true, span2: true },
        { id: 'bride-name', label: "Bride's Full Name", kind: 'name', required: true, span2: true },
      ] },
    { id: 'holy-orders', name: 'Holy Orders', category: 'sacrament', desc: 'Sacrament of ordination to the diaconate, priesthood, or episcopate.',
      iconBg: 'rgba(194,112,28,0.14)', iconColor: '#c2701c',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>`,
      fields: [
        { id: 'candidate-name-ho', label: "Candidate's Full Name", kind: 'name', required: true, span2: true },
        { id: 'sending-diocese', label: 'Sending Diocese / Seminary', placeholder: 'e.g. Diocese of Cubao', required: false, span2: true },
      ] },
    { id: 'funeral', name: 'Funeral Mass', category: 'special-mass', desc: 'Mass and rites for a deceased loved one.',
      iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
      fields: [
        { id: 'deceased-name', label: 'Full Name of Deceased', kind: 'name', required: true, span2: true },
        { id: 'requester-rel', label: 'Relationship to Deceased', placeholder: 'e.g. Son, Daughter, Spouse', required: true },
      ] },
    { id: 'house-blessing', name: 'House Blessing', category: 'blessing', desc: 'Blessing for a home or residence.',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
      fields: [
        // Saved as "lat, lng" under this label; the admin Blessings page
        // and Requested Services show it as a Google Maps link.
        { id: 'map-pin', label: MAP_PIN_LABEL, kind: 'map', addressField: 'address', required: false, span2: true },
        { id: 'address', label: 'Complete Address', placeholder: 'e.g. 12 Mabini St., Cubao', required: true, span2: true },
        { id: 'household', label: 'Household / Owner Name', placeholder: 'e.g. Santos Family', required: true },
      ] },
    { id: 'vehicle-blessing', name: 'Vehicle / Item Blessing', category: 'blessing', desc: 'Blessing for a vehicle or a special item.',
      iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
      fields: [
        { id: 'item', label: 'Item Description', placeholder: 'e.g. 2023 Honda CR-V — XYZ 456', required: true, span2: true },
        { id: 'owner', label: "Owner's Name", placeholder: 'e.g. Maria Santos', required: true },
      ] },
    { id: 'business-dedication', name: 'Business Dedication', category: 'blessing', desc: 'Blessing to dedicate a new or existing business.',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6M9 9v.01M9 12v.01M9 15v.01"/></svg>`,
      fields: [
        { id: 'business-name', label: 'Business Name', placeholder: 'e.g. Reyes Bakery', required: true, span2: true },
        { id: 'business-address', label: 'Business Address', placeholder: 'e.g. Aurora Blvd. corner 8th', required: true },
      ] },
    { id: 'anniversary-mass', name: 'Anniversary Mass', category: 'special-mass', desc: 'Thanksgiving mass for a wedding or ordination anniversary.',
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>`,
      fields: [
        { id: 'spouse-1', label: 'Spouse 1', kind: 'name', required: true, span2: true },
        { id: 'spouse-2', label: 'Spouse 2', kind: 'name', required: true, span2: true },
        { id: 'years', label: 'Years Being Celebrated', placeholder: 'e.g. 15 years', required: false },
      ] },
    { id: 'pet-blessing', name: 'Pet Blessing', category: 'blessing', desc: 'Blessing for a pet or animal companion.',
      iconBg: 'rgba(161,98,7,0.14)', iconColor: '#a16207',
      icon: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><ellipse cx="6.5" cy="9" rx="2" ry="2.4"/><ellipse cx="11.5" cy="6.2" rx="2" ry="2.4"/><ellipse cx="16.5" cy="6.2" rx="2" ry="2.4"/><ellipse cx="20" cy="10.2" rx="2" ry="2.4"/><path d="M13.5 11c-4 0-7.5 2.7-7.5 6.2 0 2.7 2.6 3.8 6.4 3.8h1.7c3.8 0 7.4-1.1 7.4-3.8C21.5 13.7 17.5 11 13.5 11z"/></svg>`,
      fields: [
        { id: 'pet-name', label: "Pet's Name", placeholder: 'e.g. Bantay', required: true, span2: true },
        { id: 'pet-type', label: 'Type of Pet', placeholder: 'e.g. Dog, Cat, Bird', required: false },
        { id: 'pet-owner', label: "Owner's Name", placeholder: 'e.g. Santos Family', required: true },
      ] },
    { id: 'baccalaureate-mass', name: 'Baccalaureate Mass', category: 'special-mass', desc: 'Thanksgiving Mass for graduating students before commencement.',
      iconBg: 'rgba(29,78,216,0.12)', iconColor: '#1d4ed8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`,
      fields: [
        { id: 'graduate-name', label: "Graduate's Full Name", kind: 'name', required: true, span2: true },
        { id: 'school-name', label: 'School / University', placeholder: 'e.g. Ateneo de Manila University', required: false, span2: true },
        { id: 'graduation-year', label: 'Graduation Year / Batch', placeholder: 'e.g. 2026', required: false },
      ] },
  ];

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
  let allBookings = []; // every Blessing record, kept live so full slots show as taken

  client.models.Blessing.observeQuery().subscribe({
    next: ({ items }) => {
      allBookings = items;
      if (slotPicker) slotPicker.refresh(allBookings);
    },
    error: (err) => console.error('Failed to load existing bookings:', err),
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
      const { data: latest } = await client.models.Blessing.list({ limit: 1000 });
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