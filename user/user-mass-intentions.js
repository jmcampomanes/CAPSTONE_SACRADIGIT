/* ============================================
   SacraDigit — User Mass Intentions Scripts (AWS Amplify)
   Runs after user-shell.js.
   Reuses the same MassIntention model as the admin
   side. "My Intentions" filters client-side by
   donor === hardcoded demo name (no real login yet).
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const DONOR_NAME = 'Maria P. Santos';

  const intentionTypes = [
    { id: 'soul', label: 'For the Soul of...', iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>` },
    { id: 'thanksgiving', label: 'Thanksgiving', iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>` },
    { id: 'healing', label: 'Healing', iconBg: 'rgba(21,128,61,0.1)', iconColor: '#15803d',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>` },
    { id: 'birthday', label: 'Birthday Blessing', iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A1.994 1.994 0 003 15.546M8.5 6.5V6a3.5 3.5 0 117 0v.5M4 15h16v5H4z"/></svg>` },
    { id: 'special', label: 'Special Intention', iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>` },
  ];

  let myIntentions = [];

  const badgeClass = { pending: 'badge-amber', scheduled: 'badge-green', completed: 'badge-blue' };
  const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', completed: 'Completed' };

  const list          = document.getElementById('intentions-list');
  const emptyState      = document.getElementById('intentions-empty');
  const intentionsCount  = document.getElementById('intentions-count');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function formatShort(input) {
    if (!input) return '';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatPeso(n) { return '₱' + (n || 0).toLocaleString('en-US'); }
  function typeConfig(id) { return intentionTypes.find(t => t.id === id) || intentionTypes[4]; }
  function getNames(it) {
    if (!it.names) return [];
    try { return JSON.parse(it.names); } catch { return []; }
  }
  function typeIdFromLabel(label) {
    return (intentionTypes.find(t => t.label === label) || intentionTypes[4]).id;
  }

  client.models.MassIntention.observeQuery({ filter: { donor: { eq: DONOR_NAME } } }).subscribe({
    next: ({ items }) => {
      myIntentions = items;
      renderStats();
      renderList();
    },
    error: (err) => {
      console.error('Failed to load intentions:', err);
      list.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load intentions.</p>`;
    },
  });

  function renderStats() {
    document.getElementById('stat-total').textContent = myIntentions.length;
    document.getElementById('stat-scheduled').textContent = myIntentions.filter(i => i.status === 'scheduled').length;
    document.getElementById('stat-total-offered').textContent = formatPeso(myIntentions.reduce((s, i) => s + (i.offering || 0), 0));
  }

  function renderList() {
    intentionsCount.textContent = `${myIntentions.length} intention${myIntentions.length === 1 ? '' : 's'}`;

    if (myIntentions.length === 0) {
      list.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const sorted = myIntentions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    list.innerHTML = sorted.map(it => {
      const cfg = typeConfig(typeIdFromLabel(it.type));
      const names = getNames(it);
      const namesDisplay = names.length > 1
        ? `${escapeHtml(names[0])} <span class="text-gray-400 font-medium">+${names.length - 1} more</span>`
        : escapeHtml(names[0] || '');

      return `<li><div class="intention-row">
        <div class="intention-icon" style="background-color:${cfg.iconBg};color:${cfg.iconColor};">${cfg.icon}</div>
        <div class="intention-info">
          <p class="intention-type">${escapeHtml(it.type)}</p>
          <p class="intention-note">${namesDisplay}</p>
          <div class="intention-meta">
            <span class="intention-date">Submitted ${formatShort(it.createdAt)}</span>
            ${it.massDate ? `<span class="intention-mass-date">📅 Mass: ${formatShort(it.massDate)}</span>` : `<span class="badge badge-amber" style="font-size:0.625rem;">Awaiting assignment</span>`}
            <span class="badge ${badgeClass[it.status] || 'badge-gray'}" style="font-size:0.625rem;">${statusLabel[it.status] || it.status}</span>
          </div>
          <button type="button" class="intention-details-btn" data-id="${it.id}">See Details ›</button>
        </div>
        <div class="intention-offering">${formatPeso(it.offering)}</div>
      </div></li>`;
    }).join('');
  }

  list.addEventListener('click', e => {
    const btn = e.target.closest('.intention-details-btn');
    if (btn) openDetailsModal(btn.dataset.id);
  });

  /* --- Submit Intention Modal --- */
  const modal     = document.getElementById('intention-modal');
  const typeGrid   = document.getElementById('intention-type-grid');
  const nameInput    = document.getElementById('mi-name-input');
  const addNameBtn    = document.getElementById('mi-add-name');
  const dateInput    = document.getElementById('mi-date');
  const offeringInput = document.getElementById('mi-offering');

  const OFFERING_PER_INTENTION = 300;

  let selectedTypeId = null;
  let addedIntentions = []; // [{ name, typeId }] — each name keeps whichever
                             // category was selected on the pill grid at
                             // the moment it was added, so one submission
                             // can mix categories. Newest is index 0.
  let offeringManuallyEdited = false;
  let editingIndex = null; // index currently in inline-edit mode, or null

  /* ------------------------------------------
     Preferred Mass Date — custom calendar
     A native <input type="date"> can't restrict which
     days are pickable, so this renders a small calendar
     where only Saturdays, Sundays, and today-or-later
     are actual, clickable buttons — every other day is
     rendered disabled, not just flagged after the fact.
  ------------------------------------------ */
  const dateTrigger  = document.getElementById('mi-date-trigger');
  const dateDisplay    = document.getElementById('mi-date-display');
  const datePanel        = document.getElementById('mi-date-panel');
  const dateGrid            = document.getElementById('mi-date-grid');
  const dateMonthLabel        = document.getElementById('mi-date-month-label');
  const datePrevBtn              = document.getElementById('mi-date-prev');
  const dateNextBtn                = document.getElementById('mi-date-next');
  const dateClearBtn                 = document.getElementById('mi-date-clear');

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  let calYear, calMonth; // calMonth is 0-11
  let selectedWeekend = null; // { sat: 'YYYY-MM-DD', sun: 'YYYY-MM-DD' } or null

  function pad2(n) { return String(n).padStart(2, '0'); }

  function isoFromDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isSelectableDay(y, m, d) {
    const date = new Date(y, m, d);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    return (dow === 0 || dow === 6) && date >= startOfToday();
  }

  /* Mass runs Saturday evening through Sunday, so picking either day
     of a weekend selects the pair — Sat 22 → "Aug 22–23". */
  function weekendPairFor(iso) {
    const d = new Date(iso + 'T00:00:00');
    const dow = d.getDay();
    if (dow === 6) {
      const sun = new Date(d);
      sun.setDate(sun.getDate() + 1);
      return { sat: iso, sun: isoFromDate(sun) };
    }
    const sat = new Date(d);
    sat.setDate(sat.getDate() - 1);
    return { sat: isoFromDate(sat), sun: iso };
  }

  function formatWeekendRangeLabel(satIso, sunIso) {
    const sat = new Date(satIso + 'T00:00:00');
    const sun = new Date(sunIso + 'T00:00:00');
    const satMonth = sat.toLocaleDateString('en-US', { month: 'short' });
    const sunMonth = sun.toLocaleDateString('en-US', { month: 'short' });

    if (sat.getFullYear() === sun.getFullYear()) {
      if (satMonth === sunMonth) return `${satMonth} ${sat.getDate()}–${sun.getDate()}, ${sat.getFullYear()}`;
      return `${satMonth} ${sat.getDate()} – ${sunMonth} ${sun.getDate()}, ${sat.getFullYear()}`;
    }
    return `${satMonth} ${sat.getDate()}, ${sat.getFullYear()} – ${sunMonth} ${sun.getDate()}, ${sun.getFullYear()}`;
  }

  function renderCalendar() {
    dateMonthLabel.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

    const firstWeekday = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = startOfToday();

    let html = '';
    for (let i = 0; i < firstWeekday; i++) html += `<span class="mi-cal-blank"></span>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`;
      const selectable = isSelectableDay(calYear, calMonth, d);
      const isSelected = !!selectedWeekend && (iso === selectedWeekend.sat || iso === selectedWeekend.sun);
      const thisDate = new Date(calYear, calMonth, d);
      thisDate.setHours(0, 0, 0, 0);
      const isToday = thisDate.getTime() === today.getTime();

      const classes = ['mi-cal-day'];
      if (!selectable) classes.push('mi-cal-day-disabled');
      if (isSelected) classes.push('mi-cal-day-selected');
      if (isToday && !isSelected) classes.push('mi-cal-day-today');

      html += `<button type="button" class="${classes.join(' ')}" data-date="${iso}"${selectable ? '' : ' disabled tabindex="-1"'}>${d}</button>`;
    }

    dateGrid.innerHTML = html;

    const now = new Date();
    datePrevBtn.disabled = (calYear === now.getFullYear() && calMonth === now.getMonth());
  }

  function updateDateDisplay() {
    if (!selectedWeekend) {
      dateDisplay.textContent = 'Select a date';
      dateDisplay.classList.add('mi-date-placeholder');
    } else {
      dateDisplay.textContent = formatWeekendRangeLabel(selectedWeekend.sat, selectedWeekend.sun);
      dateDisplay.classList.remove('mi-date-placeholder');
    }
  }

  function openDatePanel() {
    const base = selectedWeekend ? new Date(selectedWeekend.sat + 'T00:00:00') : new Date();
    calYear = base.getFullYear();
    calMonth = base.getMonth();
    renderCalendar();
    datePanel.classList.remove('hidden');
    dateTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeDatePanel() {
    datePanel.classList.add('hidden');
    dateTrigger.setAttribute('aria-expanded', 'false');
  }

  dateTrigger.addEventListener('click', () => {
    if (datePanel.classList.contains('hidden')) openDatePanel();
    else closeDatePanel();
  });

  dateGrid.addEventListener('click', e => {
    const btn = e.target.closest('.mi-cal-day');
    if (!btn || btn.disabled) return;
    selectedWeekend = weekendPairFor(btn.dataset.date);
    // The Saturday of the pair is what's actually stored as the
    // preferred mass date — the Sunday is implied by the parish's
    // own Sat-evening-through-Sunday mass convention.
    dateInput.value = selectedWeekend.sat;
    updateDateDisplay();
    closeDatePanel();
  });

  datePrevBtn.addEventListener('click', () => {
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    renderCalendar();
  });

  dateNextBtn.addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderCalendar();
  });

  dateClearBtn.addEventListener('click', () => {
    selectedWeekend = null;
    dateInput.value = '';
    updateDateDisplay();
    closeDatePanel();
  });

  document.addEventListener('click', e => {
    if (!datePanel.classList.contains('hidden') && !e.target.closest('.mi-datepicker')) closeDatePanel();
  });

  document.addEventListener('keydown', e => {
    // Registered before the modal-wide Escape handler below, so this
    // runs first — stopImmediatePropagation keeps a single Escape
    // press from closing the calendar AND the whole modal at once.
    if (e.key === 'Escape' && !datePanel.classList.contains('hidden')) {
      closeDatePanel();
      e.stopImmediatePropagation();
    }
  });

  const addedSection  = document.getElementById('mi-added-section');
  const addedList       = document.getElementById('mi-added-list');
  const addedHeading       = document.getElementById('mi-added-heading');
  const nameLabelSuffix       = document.getElementById('mi-name-label-suffix');

  function updateNameLabelSuffix() {
    nameLabelSuffix.textContent = ` (for ${typeConfig(selectedTypeId).label})`;
  }

  function updateOfferingDefault() {
    if (offeringManuallyEdited) return;
    const total = addedIntentions.length * OFFERING_PER_INTENTION;
    offeringInput.value = total > 0 ? total : '';
  }

  function renderAddedList() {
    addedHeading.textContent = `Added Intentions (${addedIntentions.length})`;
    addedSection.classList.toggle('hidden', addedIntentions.length === 0);
    addedList.innerHTML = addedIntentions.map((item, i) => {
      if (i === editingIndex) {
        return `
          <div class="mi-added-item mi-added-item-editing" data-index="${i}">
            <div class="mi-added-item-edit-fields">
              <input type="text" class="form-input mi-added-edit-name" data-index="${i}" value="${escapeHtml(item.name)}" />
              <select class="form-input mi-added-edit-type" data-index="${i}">
                ${intentionTypes.map(t => `<option value="${t.id}" ${t.id === item.typeId ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
              </select>
            </div>
            <div class="mi-added-item-edit-actions">
              <button type="button" class="mi-added-item-save" data-index="${i}" aria-label="Save changes">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button type="button" class="mi-added-item-cancel" data-index="${i}" aria-label="Cancel editing">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>`;
      }
      const cfg = typeConfig(item.typeId);
      return `
        <div class="mi-added-item" data-index="${i}">
          <div class="mi-added-item-body">
            <p class="mi-added-item-name">${escapeHtml(item.name)}</p>
            <p class="mi-added-item-type" style="color:${cfg.iconColor};">${escapeHtml(cfg.label)}</p>
          </div>
          <div class="mi-added-item-actions">
            <button type="button" class="mi-added-item-edit" data-index="${i}" aria-label="Edit ${escapeHtml(item.name)}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button type="button" class="mi-added-item-remove" data-index="${i}" aria-label="Remove ${escapeHtml(item.name)}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
    updateOfferingDefault();

    if (editingIndex !== null) {
      const nameField = addedList.querySelector(`.mi-added-edit-name[data-index="${editingIndex}"]`);
      if (nameField) { nameField.focus(); nameField.select(); }
    }
  }

  function saveEdit(index) {
    const nameField = addedList.querySelector(`.mi-added-edit-name[data-index="${index}"]`);
    const typeField = addedList.querySelector(`.mi-added-edit-type[data-index="${index}"]`);
    if (!nameField || !typeField) return;
    const val = nameField.value.trim();
    if (!val) { nameField.classList.add('border-red-400'); return; }
    addedIntentions[index] = { name: val, typeId: typeField.value };
    editingIndex = null;
    renderAddedList();
  }

  function addName() {
    const val = nameInput.value.trim();
    if (!val) return;
    // Newest addition goes to the top of the list, so what was just
    // added is immediately visible without scrolling.
    addedIntentions.unshift({ name: val, typeId: selectedTypeId });
    if (editingIndex !== null) editingIndex += 1;
    nameInput.value = '';
    nameInput.classList.remove('border-red-400');
    renderAddedList();
    nameInput.focus();
  }

  addNameBtn.addEventListener('click', addName);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addName(); } });

  addedList.addEventListener('click', e => {
    const editBtn = e.target.closest('.mi-added-item-edit');
    if (editBtn) { editingIndex = parseInt(editBtn.dataset.index, 10); renderAddedList(); return; }

    const saveBtn = e.target.closest('.mi-added-item-save');
    if (saveBtn) { saveEdit(parseInt(saveBtn.dataset.index, 10)); return; }

    const cancelBtn = e.target.closest('.mi-added-item-cancel');
    if (cancelBtn) { editingIndex = null; renderAddedList(); return; }

    const removeBtn = e.target.closest('.mi-added-item-remove');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.index, 10);
      addedIntentions.splice(idx, 1);
      if (editingIndex !== null) {
        if (editingIndex === idx) editingIndex = null;
        else if (idx < editingIndex) editingIndex -= 1;
      }
      renderAddedList();
    }
  });

  addedList.addEventListener('keydown', e => {
    if (!e.target.classList.contains('mi-added-edit-name')) return;
    const index = parseInt(e.target.dataset.index, 10);
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(index); }
    if (e.key === 'Escape') { e.preventDefault(); editingIndex = null; renderAddedList(); }
  });

  offeringInput.addEventListener('input', () => { offeringManuallyEdited = true; });

  typeGrid.innerHTML = intentionTypes.map(t => `
    <button type="button" class="intention-type-btn" data-type-id="${t.id}">
      <div class="intention-type-btn-icon" style="background-color:${t.iconBg};color:${t.iconColor};">${t.icon}</div>
      <span class="intention-type-btn-label">${t.label}</span>
    </button>`).join('');

  typeGrid.addEventListener('click', e => {
    const btn = e.target.closest('.intention-type-btn');
    if (!btn) return;
    document.querySelectorAll('.intention-type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTypeId = btn.dataset.typeId;
    updateNameLabelSuffix();
  });

  function openModal() {
    // Default to the first category so a name can always be added right
    // away — the pill grid always shows one option selected, matching
    // the "Name (for X)" label always having something to name.
    selectedTypeId = intentionTypes[0].id;
    addedIntentions = [];
    editingIndex = null;
    offeringManuallyEdited = false;
    document.querySelectorAll('.intention-type-btn').forEach((b, i) => b.classList.toggle('selected', i === 0));
    updateNameLabelSuffix();
    nameInput.value = '';
    renderAddedList();
    dateInput.value = '';
    selectedWeekend = null;
    updateDateDisplay();
    closeDatePanel();
    showModal(modal);
  }

  function closeModal() { hideModal(modal); }

  document.getElementById('btn-submit-intention').addEventListener('click', openModal);
  document.getElementById('btn-empty-submit')?.addEventListener('click', openModal);

  function showModal(el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function hideModal(el) { el.classList.add('hidden'); document.body.style.overflow = ''; }

  document.querySelectorAll('.modal-overlay').forEach(overlayEl => {
    overlayEl.addEventListener('click', e => { if (e.target === overlayEl) hideModal(overlayEl); });
    overlayEl.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => hideModal(overlayEl)));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(hideModal); });

  const submitBtn = document.getElementById('mi-submit');

  submitBtn.addEventListener('click', async () => {
    if (nameInput.value.trim()) addName();

    if (addedIntentions.length === 0) {
      nameInput.classList.add('border-red-400');
      nameInput.addEventListener('input', () => nameInput.classList.remove('border-red-400'), { once: true });
      window.showToast('Please add at least one name.', true);
      return;
    }
    const offering = parseInt(offeringInput.value, 10);
    if (!offering || offering <= 0) {
      offeringInput.classList.add('border-red-400');
      offeringInput.addEventListener('input', () => offeringInput.classList.remove('border-red-400'), { once: true });
      window.showToast('Please enter an offering amount.', true);
      return;
    }

    // The schema stores one type per record, but a submission here can
    // mix categories across names — so each added intention becomes its
    // own record. The total offering is split evenly across them (any
    // remainder from uneven division goes to the last one) so the sum
    // across records still matches exactly what the parishioner entered.
    const count = addedIntentions.length;
    const base = Math.floor(offering / count);
    const remainder = offering - base * count;

    submitBtn.disabled = true;
    try {
      const results = await Promise.all(addedIntentions.map((item, i) => {
        const cfg = typeConfig(item.typeId);
        return client.models.MassIntention.create({
          donor: DONOR_NAME,
          type: cfg.label,
          names: JSON.stringify([item.name]),
          massDate: dateInput.value || undefined,
          offering: base + (i === count - 1 ? remainder : 0),
          status: 'pending',
        });
      }));
      const failed = results.find(r => r.errors);
      if (failed) throw new Error(failed.errors.map(e => e.message).join('; '));

      closeModal();
      window.showToast(`Mass intention submitted — ${count} intention${count === 1 ? '' : 's'} for ${formatPeso(offering)}.`);
    } catch (err) {
      console.error('Failed to submit intention:', err);
      window.showToast(err.message || "Couldn't submit the intention.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ------------------------------------------
     VIEW TABS (My Intentions / Community Intentions)
  ------------------------------------------ */
  const miTabs   = document.querySelectorAll('.mi-tab');
  const miPanels = document.querySelectorAll('.mi-panel');

  miTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      miTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      miPanels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });


  /* ------------------------------------------
     COMMUNITY INTENTIONS (Reader's Sheet)
     A read-aloud, parish-wide view of every mass's
     intentions — mirrors the admin Reader's Sheet.
     Unlike "My Intentions" above, this pulls every
     donor's records (not just DONOR_NAME), since a
     mass intentions sheet is public church-bulletin
     content by nature.
  ------------------------------------------ */
  let allIntentions = [];

  client.models.MassIntention.observeQuery().subscribe({
    next: ({ items }) => {
      allIntentions = items;
      renderSheetOptions();
    },
    error: (err) => {
      console.error('Failed to load community intentions:', err);
    },
  });

  function formatShortDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function timeToMinutes(time12) {
    if (!time12) return 0;
    const [time, meridiem] = time12.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + (m || 0);
  }

  /* e.g. "FOR JULY 25, 2026, 6:00 PM MASS" */
  function formatSheetRangeLabel(massDate, massTime) {
    const d = new Date(massDate + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    return massTime ? `FOR ${dateLabel}, ${massTime.toUpperCase()} MASS` : `FOR ${dateLabel} MASS`;
  }

  const sheetMassSelect = document.getElementById('sheet-mass-select');
  const sheetEmpty        = document.getElementById('sheet-empty');
  const sheetBody           = document.getElementById('sheet-body');
  const sheetMassRange        = document.getElementById('sheet-mass-range');

  const GROUP_TYPE_MAP = {
    'Thanksgiving': 'thanksgiving',
    'Birthday Blessing': 'thanksgiving',
    'Special Intention': 'special',
    'Healing': 'special',
    'For the Soul of...': 'souls',
  };

  const sheetListEls = {
    thanksgiving: document.getElementById('sheet-list-thanksgiving'),
    special: document.getElementById('sheet-list-special'),
    souls: document.getElementById('sheet-list-souls'),
  };

  let currentSheetKey = '';

  /* ------------------------------------------
     Category filter (All / one category at a time)
  ------------------------------------------ */
  const sheetCatBtns   = document.querySelectorAll('.sheet-cat-btn');
  const sheetGroupEls    = document.querySelectorAll('.sheet-group');
  const sheetBoilerplateEl = document.querySelector('.sheet-boilerplate');
  const sheetClosingEl       = document.querySelector('.sheet-closing');

  let activeCategory = 'all';

  function applyCategoryFilter() {
    sheetGroupEls.forEach(g => {
      const show = activeCategory === 'all' || g.dataset.cat === activeCategory;
      g.classList.toggle('sheet-group-filtered-out', !show);
    });
    // The standing intentions aren't part of any one category, so
    // they only make sense in the full "All" view.
    const showStanding = activeCategory === 'all';
    sheetBoilerplateEl?.classList.toggle('sheet-group-filtered-out', !showStanding);
    sheetClosingEl?.classList.toggle('sheet-group-filtered-out', !showStanding);

    refreshFindMatches();
  }

  sheetCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      sheetCatBtns.forEach(b => b.classList.toggle('active', b === btn));
      applyCategoryFilter();
    });
  });

  /* ------------------------------------------
     Find a name (Ctrl+F-style, scoped to the sheet)
  ------------------------------------------ */
  const findInput   = document.getElementById('sheet-find-input');
  const findCount     = document.getElementById('sheet-find-count');
  const findPrevBtn     = document.getElementById('sheet-find-prev');
  const findNextBtn       = document.getElementById('sheet-find-next');
  const findClearBtn        = document.getElementById('sheet-find-clear');

  let findQuery = '';
  let findMatches = [];
  let findActiveIndex = -1;

  function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* Wraps matches of findQuery inside already-escaped HTML text.
     The query is escaped the same way the source text was, so the
     regex only ever matches against literal (already-safe) markup. */
  function highlightText(escapedText, query) {
    const escapedQuery = escapeHtml(query.trim());
    if (!escapedQuery) return escapedText;
    const re = new RegExp(escapeRegExp(escapedQuery), 'gi');
    return escapedText.replace(re, (m) => `<mark class="sheet-highlight">${m}</mark>`);
  }

  function refreshFindMatches() {
    // Only search within whatever category is currently visible —
    // matches hidden by the category filter shouldn't count or be
    // jumped to.
    const scopeEls = activeCategory === 'all'
      ? [sheetListEls.thanksgiving, sheetListEls.special, sheetListEls.souls]
      : [sheetListEls[activeCategory]];
    findMatches = scopeEls.flatMap(el => [...el.querySelectorAll('mark.sheet-highlight')]);
    findActiveIndex = findMatches.length ? 0 : -1;
    updateFindUI();
    if (findActiveIndex >= 0) focusMatch(findActiveIndex);
  }

  function updateFindUI() {
    const hasQuery = findQuery.trim().length > 0;
    findClearBtn.classList.toggle('hidden', !hasQuery);

    if (!hasQuery) {
      findCount.classList.add('hidden');
      findPrevBtn.disabled = true;
      findNextBtn.disabled = true;
      return;
    }

    findCount.classList.remove('hidden');
    findCount.textContent = findMatches.length ? `${findActiveIndex + 1} of ${findMatches.length}` : 'No matches';
    findPrevBtn.disabled = findMatches.length === 0;
    findNextBtn.disabled = findMatches.length === 0;
  }

  function focusMatch(index) {
    findMatches.forEach(m => m.classList.remove('sheet-highlight-active'));
    const el = findMatches[index];
    if (!el) return;
    el.classList.add('sheet-highlight-active');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  findInput.addEventListener('input', () => {
    findQuery = findInput.value;
    renderSheet();
  });

  findInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.shiftKey) findPrevBtn.click(); else findNextBtn.click();
  });

  findNextBtn.addEventListener('click', () => {
    if (!findMatches.length) return;
    findActiveIndex = (findActiveIndex + 1) % findMatches.length;
    updateFindUI();
    focusMatch(findActiveIndex);
  });

  findPrevBtn.addEventListener('click', () => {
    if (!findMatches.length) return;
    findActiveIndex = (findActiveIndex - 1 + findMatches.length) % findMatches.length;
    updateFindUI();
    focusMatch(findActiveIndex);
  });

  findClearBtn.addEventListener('click', () => {
    findInput.value = '';
    findQuery = '';
    renderSheet();
    findInput.focus();
  });

  function sheetKey(it) { return `${it.massDate}||${it.massTime || ''}`; }

  function getSheetOptions() {
    const map = new Map();
    allIntentions.forEach(it => {
      if (!it.massDate) return;
      const key = sheetKey(it);
      if (!map.has(key)) map.set(key, { massDate: it.massDate, massTime: it.massTime || '', count: 0 });
      map.get(key).count += 1;
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => {
        if (a.massDate !== b.massDate) return a.massDate < b.massDate ? -1 : 1;
        return timeToMinutes(a.massTime) - timeToMinutes(b.massTime);
      });
  }

  function renderSheetOptions() {
    const options = getSheetOptions();
    const hasCurrent = options.some(o => o.key === currentSheetKey);

    sheetMassSelect.innerHTML = `<option value="">Choose a mass date &amp; time…</option>` +
      options.map(o => `
        <option value="${o.key}" ${o.key === currentSheetKey ? 'selected' : ''}>
          ${formatShortDate(o.massDate)}${o.massTime ? ' · ' + escapeHtml(o.massTime) : ''}, ${new Date(o.massDate + 'T00:00:00').getFullYear()} (${o.count} intention${o.count === 1 ? '' : 's'})
        </option>
      `).join('');

    if (!hasCurrent) currentSheetKey = '';
    renderSheet();
  }

  function renderSheet() {
    if (!currentSheetKey) {
      sheetBody.classList.add('hidden');
      sheetEmpty.classList.remove('hidden');
      findMatches = [];
      findActiveIndex = -1;
      updateFindUI();
      return;
    }

    const matching = allIntentions.filter(it => it.massDate && sheetKey(it) === currentSheetKey);

    if (matching.length === 0) {
      sheetBody.classList.add('hidden');
      sheetEmpty.classList.remove('hidden');
      findMatches = [];
      findActiveIndex = -1;
      updateFindUI();
      return;
    }

    sheetEmpty.classList.add('hidden');
    sheetBody.classList.remove('hidden');

    const first = matching[0];
    sheetMassRange.textContent = formatSheetRangeLabel(first.massDate, first.massTime);

    const grouped = { thanksgiving: [], special: [], souls: [] };
    matching.forEach(it => {
      const bucket = GROUP_TYPE_MAP[it.type] || 'special';
      grouped[bucket].push(it);
    });

    Object.entries(grouped).forEach(([bucket, items]) => {
      const listEl = sheetListEls[bucket];
      const emptyNote = listEl.parentElement.querySelector('.sheet-group-empty');

      if (items.length === 0) {
        listEl.innerHTML = '';
        emptyNote.classList.remove('hidden');
        return;
      }
      emptyNote.classList.add('hidden');

      listEl.innerHTML = items.map(it => {
        const names = getNames(it);
        const namesText = names.length ? names.join(' / ') : it.donor;
        const tag = (it.startTime && it.endTime)
          ? ` <span class="sheet-entry-tag">🕐 ${escapeHtml(it.startTime)} – ${escapeHtml(it.endTime)}</span>`
          : '';
        return `${highlightText(escapeHtml(namesText), findQuery)}${tag}`;
      }).join(' / ');
    });

    applyCategoryFilter();
  }

  sheetMassSelect.addEventListener('change', () => {
    currentSheetKey = sheetMassSelect.value;
    findInput.value = '';
    findQuery = '';
    renderSheet();
  });

  document.getElementById('btn-print-sheet').addEventListener('click', () => {
    if (!currentSheetKey) {
      window.showToast("Select a mass to print its intentions.", true);
      return;
    }
    const printDateEl = document.getElementById('sheet-print-date-value');
    if (printDateEl) {
      printDateEl.textContent = `Printed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    window.print();
  });


  /* --- Details Modal --- */
  const detailsModal = document.getElementById('details-modal');
  const detailsBody   = document.getElementById('details-body');

  function openDetailsModal(id) {
    const it = myIntentions.find(x => x.id === id);
    if (!it) return;
    const cfg = typeConfig(typeIdFromLabel(it.type));
    const names = getNames(it);

    detailsBody.innerHTML = `
      <div class="details-header-row">
        <div class="intention-icon" style="background-color:${cfg.iconBg};color:${cfg.iconColor};">${cfg.icon}</div>
        <div><p class="intention-type">${escapeHtml(it.type)}</p><span class="badge ${badgeClass[it.status] || 'badge-gray'}" style="font-size:0.625rem;">${statusLabel[it.status] || it.status}</span></div>
      </div>
      <div>
        <p class="details-label">Name${names.length === 1 ? '' : 's'} (${names.length})</p>
        <div class="name-chip-list">${names.map(n => `<span class="name-chip">${escapeHtml(n)}</span>`).join('')}</div>
      </div>
      <div class="details-grid">
        <div><p class="details-label">Submitted</p><p class="details-value">${formatShort(it.createdAt)}</p></div>
        <div><p class="details-label">Mass Date</p><p class="details-value">${it.massDate ? formatShort(it.massDate) : 'Awaiting assignment'}</p></div>
      </div>
      <div><p class="details-label">Offering</p><p class="details-value text-green-700">${formatPeso(it.offering)}</p></div>`;

    showModal(detailsModal);
  }

});