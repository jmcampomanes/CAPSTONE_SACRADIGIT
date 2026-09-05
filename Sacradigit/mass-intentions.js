/* ============================================
   SacraDigit Admin — Mass Intentions Scripts (AWS Amplify)
   Backed by the MassIntention model (extended with
   donor, type, names, startTime/endTime, massDate/
   massTime — see amplify/data/resource.ts).
   The "names" field is a.json(), so it's stringified
   before sending and parsed back when reading.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  function toLocalISODate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todayISO = toLocalISODate();

  let intentions = []; // kept in sync via observeQuery, each has .id

  const tbody          = document.getElementById('intentions-tbody');
  const intentionsEmpty  = document.getElementById('intentions-empty');
  const logCount         = document.getElementById('log-count');
  const paginationBar      = document.getElementById('intentions-pagination');

  const searchInput = document.getElementById('search-input');
  const typeFilter    = document.getElementById('type-filter');
  const statusFilter   = document.getElementById('status-filter');

  const PAGE_SIZE = 8;
  let currentPage = 1;

  const badgeClass = { pending: 'badge-amber', scheduled: 'badge-green', completed: 'badge-blue' };
  const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', completed: 'Completed' };

  /* Which of the 3 Reader's Sheet categories each intention type
     belongs to. Shared by the Add/Edit type picker (which uses it
     to keep multi-type selections within one category) and the
     Reader's Sheet grouping logic further down. */
  const GROUP_TYPE_MAP = {
    'Thanksgiving': 'thanksgiving',
    'Birthday Blessing': 'thanksgiving',
    'Special Intention': 'special',
    'Healing': 'special',
    'For the Soul of...': 'souls',
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

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

  function formatPeso(amount) {
    return '₱' + (amount || 0).toLocaleString('en-US');
  }

  function getNames(it) {
    if (!it.names) return [];
    try { return JSON.parse(it.names); } catch { return []; }
  }

  function matchesFilters(it) {
    const query    = searchInput.value.trim().toLowerCase();
    const typeVal   = typeFilter.value;
    const statusVal  = statusFilter.value;

    const matchesQuery = !query ||
      (it.donor || '').toLowerCase().includes(query) ||
      getNames(it).some(n => n.toLowerCase().includes(query));

    const matchesType   = !typeVal || it.type === typeVal;
    const matchesStatus  = !statusVal || it.status === statusVal;

    return matchesQuery && matchesType && matchesStatus;
  }


  /* --- Live data --- */
  client.models.MassIntention.observeQuery().subscribe({
    next: ({ items }) => {
      intentions = items;
      renderStats();
      renderTable();
      renderSheetOptions();
    },
    error: (err) => {
      console.error('Failed to load intentions:', err);
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn't load intentions.</td></tr>`;
    },
  });


  function renderStats() {
    const weekStart = new Date(todayISO + 'T00:00:00');
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date(todayISO + 'T00:00:00');
    weekEnd.setDate(weekEnd.getDate() + 1);

    const thisWeek = intentions.filter(i => {
      const d = new Date(i.createdAt);
      return d >= weekStart && d < weekEnd;
    });

    document.getElementById('stat-total-week').textContent = thisWeek.length;
    document.getElementById('stat-pending').textContent = intentions.filter(i => i.status === 'pending').length;

    const totalOfferings = thisWeek.reduce((sum, i) => sum + (i.offering || 0), 0);
    document.getElementById('stat-offerings').textContent = formatPeso(totalOfferings);
  }


  /* ------------------------------------------
     STAT CARDS AS QUICK FILTERS
     Only "Pending Mass Assignment" maps to a
     single status value, so it's the only stat
     card wired as a clickable quick filter —
     "Total Intentions This Week" and "Total
     Offerings" don't map to one status and stay
     plain, non-interactive stat cards.
  ------------------------------------------ */
  const statCardsByStatus = [
    { card: document.getElementById('stat-pending').closest('.stat-card'), status: 'pending' },
  ];

  statCardsByStatus.forEach(({ card, status }) => {
    card.classList.add('stat-card-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const activate = () => {
      searchInput.value = '';
      statusFilter.value = status;
      currentPage = 1;
      renderTable();
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  function updateActiveStatCard() {
    statCardsByStatus.forEach(({ card, status }) => {
      card.classList.toggle('stat-card-active', statusFilter.value === status);
    });
  }


  function intentionRowHtml(it) {
    const massDateLabel = it.massDate
      ? `${formatShortDate(it.massDate)}${it.massTime ? ' · ' + it.massTime : ''}`
      : '—';

    const names = getNames(it);
    const actionHtml = `
      <div class="row-actions">
        <button type="button" class="row-edit" data-id="${it.id}">Edit</button>
        <button type="button" class="row-view" data-id="${it.id}">View</button>
        <button type="button" class="row-remove" data-id="${it.id}">Remove</button>
      </div>
    `;

    return `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(it.donor)}</td>
        <td>
          ${escapeHtml(it.type)}
          ${names.length ? `<div class="text-xs text-gray-400 mt-0.5">${escapeHtml(names.join(', '))}</div>` : ''}
          ${it.startTime && it.endTime ? `<div class="intention-timeline">🕐 ${escapeHtml(it.startTime)} – ${escapeHtml(it.endTime)}</div>` : ''}
        </td>
        <td>${massDateLabel}</td>
        <td class="offering-amount">${formatPeso(it.offering)}</td>
        <td><span class="badge ${badgeClass[it.status] || 'badge-gray'}">${statusLabel[it.status] || it.status}</span></td>
        <td class="text-right no-print">${actionHtml}</td>
      </tr>
    `;
  }

  function getFilteredIntentions() {
    const sorted = intentions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted.filter(matchesFilters);
  }

  function renderTable() {
    updateActiveStatCard();
    const filtered = getFilteredIntentions();

    logCount.textContent = `${filtered.length} intention${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      intentionsEmpty.classList.remove('hidden');
      paginationBar.innerHTML = '';
      return;
    }
    intentionsEmpty.classList.add('hidden');

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    tbody.innerHTML = pageItems.map(intentionRowHtml).join('');

    renderPagination(filtered.length, totalPages, startIdx, pageItems.length);
  }

  function renderPagination(totalItems, totalPages, startIdx, pageCount) {
    if (totalPages <= 1) {
      paginationBar.innerHTML = `<span class="pagination-info">Showing ${totalItems} of ${totalItems}</span>`;
      return;
    }
    const rangeStart = startIdx + 1;
    const rangeEnd = startIdx + pageCount;
    let pageBtns = '';
    for (let p = 1; p <= totalPages; p++) {
      pageBtns += `<button type="button" class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    paginationBar.innerHTML = `
      <span class="pagination-info">Showing ${rangeStart}–${rangeEnd} of ${totalItems}</span>
      <div class="pagination-controls">
        <button type="button" class="pagination-btn" id="page-prev" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
        ${pageBtns}
        <button type="button" class="pagination-btn" id="page-next" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
      </div>`;
  }

  paginationBar.addEventListener('click', (e) => {
    const prevBtn = e.target.closest('#page-prev');
    const nextBtn = e.target.closest('#page-next');
    const pageBtn  = e.target.closest('.pagination-btn[data-page]');
    if (prevBtn && currentPage > 1) currentPage--;
    if (nextBtn) currentPage++;
    if (pageBtn) currentPage = parseInt(pageBtn.dataset.page, 10);
    if (prevBtn || nextBtn || pageBtn) renderTable();
  });

  tbody.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.row-edit');
    const viewBtn    = e.target.closest('.row-view');
    const removeBtn   = e.target.closest('.row-remove');

    if (editBtn)   openEditModal(editBtn.dataset.id);
    if (viewBtn)    openDetailsModal(viewBtn.dataset.id);
    if (removeBtn)  openRemoveModal(removeBtn.dataset.id);
  });

  [searchInput, typeFilter, statusFilter].forEach(el => {
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => { currentPage = 1; renderTable(); });
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    statusFilter.value = '';
    currentPage = 1;
    renderTable();
  });


  /* --- Add/Edit Intention Modal --- */
  const addModal = document.getElementById('add-modal');

  const addNameInput  = document.getElementById('add-name-input');
  const addAddNameBtn  = document.getElementById('add-add-name');
  const addNameChipsBox = document.getElementById('add-name-chips');
  const addAddedSection = document.getElementById('add-added-section');
  const addAddedHeading = document.getElementById('add-added-heading');
  const addNameLabelSuffix = document.getElementById('add-name-label-suffix');
  const addTypeGrid = document.getElementById('add-type-grid');

  let editTargetId = null; // null = Add mode, otherwise id of intention being edited
  let addNameEditingIndex = null; // index currently in inline-edit mode, or null

  const addModalTitle = document.getElementById('add-modal-title');
  const addSubmitBtn   = document.getElementById('add-submit');

  /* ------------------------------------------
     INTENTION CATEGORY PICKER — same shape as the
     parishioner-facing Submit Intention modal: a
     single-select pill grid. Whichever pill is
     highlighted is the category tagged onto the next
     name added below, so one submission can still mix
     categories across names (matches how the user side
     works, rather than one type applying to the whole
     batch of names).
  ------------------------------------------ */
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

  function typeConfig(id) { return intentionTypes.find(t => t.id === id) || intentionTypes[4]; }
  function typeIdFromLabel(label) { return (intentionTypes.find(t => t.label === label) || intentionTypes[4]).id; }

  let selectedTypeId = intentionTypes[0].id;
  let addedIntentions = []; // [{ name, typeId }]

  addTypeGrid.innerHTML = intentionTypes.map(t => `
    <button type="button" class="intention-type-btn" data-type-id="${t.id}">
      <div class="intention-type-btn-icon" style="background-color:${t.iconBg};color:${t.iconColor};">${t.icon}</div>
      <span class="intention-type-btn-label">${t.label}</span>
    </button>`).join('');

  function updateAddNameLabelSuffix() {
    addNameLabelSuffix.textContent = ` (for ${typeConfig(selectedTypeId).label})`;
  }

  function selectTypeButton(typeId) {
    addTypeGrid.querySelectorAll('.intention-type-btn').forEach(b => b.classList.toggle('selected', b.dataset.typeId === typeId));
  }

  addTypeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.intention-type-btn');
    if (!btn) return;
    selectTypeButton(btn.dataset.typeId);
    selectedTypeId = btn.dataset.typeId;
    updateAddNameLabelSuffix();
  });

  // Box rows (not pill chips) so each name has room for its own category
  // tag plus an inline edit affordance; the list itself scrolls past a
  // handful of entries (.mi-added-list, see mass-intentions.css) instead
  // of growing the modal, and a newly added name renders at the top.
  function renderAddNameChips() {
    addAddedHeading.textContent = `Added Intentions (${addedIntentions.length})`;
    addAddedSection.classList.toggle('hidden', addedIntentions.length === 0);

    addNameChipsBox.innerHTML = addedIntentions.map((item, i) => {
      if (i === addNameEditingIndex) {
        return `
          <div class="mi-added-item mi-added-item-editing" data-index="${i}">
            <div class="mi-added-item-edit-fields">
              <input type="text" class="form-input add-name-edit-input" data-index="${i}" value="${escapeHtml(item.name)}" />
              <select class="form-input add-name-edit-type" data-index="${i}">
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

    if (addNameEditingIndex !== null) {
      const field = addNameChipsBox.querySelector(`.add-name-edit-input[data-index="${addNameEditingIndex}"]`);
      if (field) { field.focus(); field.select(); }
    }
  }

  function saveAddNameEdit(index) {
    const nameField = addNameChipsBox.querySelector(`.add-name-edit-input[data-index="${index}"]`);
    const typeField = addNameChipsBox.querySelector(`.add-name-edit-type[data-index="${index}"]`);
    if (!nameField || !typeField) return;
    const val = nameField.value.trim();
    if (!val) { nameField.classList.add('border-red-400'); return; }
    addedIntentions[index] = { name: val, typeId: typeField.value };
    addNameEditingIndex = null;
    renderAddNameChips();
  }

  function addIntentionName() {
    const val = addNameInput.value.trim();
    if (!val) return;
    // Newest addition goes to the top, so it's visible right away.
    addedIntentions.unshift({ name: val, typeId: selectedTypeId });
    if (addNameEditingIndex !== null) addNameEditingIndex += 1;
    addNameInput.value = '';
    addNameInput.classList.remove('border-red-400');
    renderAddNameChips();
    addNameInput.focus();
  }

  addAddNameBtn.addEventListener('click', addIntentionName);

  addNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addIntentionName(); }
  });

  addNameChipsBox.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.mi-added-item-edit');
    if (editBtn) { addNameEditingIndex = parseInt(editBtn.dataset.index, 10); renderAddNameChips(); return; }

    const saveBtn = e.target.closest('.mi-added-item-save');
    if (saveBtn) { saveAddNameEdit(parseInt(saveBtn.dataset.index, 10)); return; }

    const cancelBtn = e.target.closest('.mi-added-item-cancel');
    if (cancelBtn) { addNameEditingIndex = null; renderAddNameChips(); return; }

    const removeBtn = e.target.closest('.mi-added-item-remove');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.index, 10);
      addedIntentions.splice(idx, 1);
      if (addNameEditingIndex !== null) {
        if (addNameEditingIndex === idx) addNameEditingIndex = null;
        else if (idx < addNameEditingIndex) addNameEditingIndex -= 1;
      }
      renderAddNameChips();
    }
  });

  addNameChipsBox.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('add-name-edit-input')) return;
    const index = parseInt(e.target.dataset.index, 10);
    if (e.key === 'Enter') { e.preventDefault(); saveAddNameEdit(index); }
    if (e.key === 'Escape') { e.preventDefault(); addNameEditingIndex = null; renderAddNameChips(); }
  });

  function resetAddForm() {
    document.getElementById('add-donor').value = '';
    document.getElementById('add-offering').value = '';
    document.getElementById('add-status').value = 'pending';
    resetMassDatePicker(null);
    document.getElementById('add-mass-time').value = '';
    addedIntentions = [];
    addNameEditingIndex = null;
    selectedTypeId = intentionTypes[0].id;
    selectTypeButton(selectedTypeId);
    updateAddNameLabelSuffix();
    renderAddNameChips();
  }

  document.getElementById('btn-add-intention').addEventListener('click', () => {
    editTargetId = null;
    addModalTitle.textContent = 'Add Mass Intention';
    addSubmitBtn.textContent = 'Save Intention';
    resetAddForm();
    openModal(addModal);
  });

  function openEditModal(id) {
    const it = intentions.find(x => x.id === id);
    if (!it) return;

    editTargetId = id;
    addModalTitle.textContent = 'Edit Mass Intention';
    addSubmitBtn.textContent = 'Save Changes';

    document.getElementById('add-donor').value = it.donor;
    document.getElementById('add-offering').value = it.offering;
    document.getElementById('add-status').value = it.status;
    resetMassDatePicker(it.massDate || null);
    document.getElementById('add-mass-time').value = it.massTime ? to24hInput(it.massTime) : '';

    // Existing names all shared this record's single type — load them
    // into the same editable, per-name-category list used for adding,
    // so admin can re-tag any of them individually while editing.
    const typeId = typeIdFromLabel(it.type);
    const names = getNames(it);
    addedIntentions = names.length ? names.map(n => ({ name: n, typeId })) : [];
    addNameEditingIndex = null;
    selectedTypeId = typeId;
    selectTypeButton(typeId);
    updateAddNameLabelSuffix();
    renderAddNameChips();

    openModal(addModal);
  }

  /* ------------------------------------------
     Mass Date Assigned — custom calendar
     Same weekend-only restriction as the parishioner-facing
     Preferred Mass Date picker (only Saturdays, Sundays, and
     today-or-later are selectable). Unlike that picker, this one
     assigns an exact mass instance rather than a preference, so it
     stores and displays the single day clicked instead of pairing
     Saturday+Sunday into one weekend selection.
  ------------------------------------------ */
  const massDateTrigger    = document.getElementById('add-mass-date-trigger');
  const massDateDisplay      = document.getElementById('add-mass-date-display');
  const massDateHiddenInput    = document.getElementById('add-mass-date');
  const massDatePanel            = document.getElementById('add-mass-date-panel');
  const massDateGrid                = document.getElementById('add-mass-date-grid');
  const massDateMonthLabel            = document.getElementById('add-mass-date-month-label');
  const massDatePrevBtn                  = document.getElementById('add-mass-date-prev');
  const massDateNextBtn                      = document.getElementById('add-mass-date-next');
  const massDateClearBtn                        = document.getElementById('add-mass-date-clear');

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  let massDateCalYear, massDateCalMonth; // massDateCalMonth is 0-11
  let selectedMassDateIso = null;

  function pad2(n) { return String(n).padStart(2, '0'); }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isSelectableMassDay(y, m, d) {
    const date = new Date(y, m, d);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    return (dow === 0 || dow === 6) && date >= startOfToday();
  }

  function renderMassDateCalendar() {
    massDateMonthLabel.textContent = `${MONTH_NAMES[massDateCalMonth]} ${massDateCalYear}`;

    const firstWeekday = new Date(massDateCalYear, massDateCalMonth, 1).getDay();
    const daysInMonth = new Date(massDateCalYear, massDateCalMonth + 1, 0).getDate();
    const today = startOfToday();

    let html = '';
    for (let i = 0; i < firstWeekday; i++) html += `<span class="mi-cal-blank"></span>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${massDateCalYear}-${pad2(massDateCalMonth + 1)}-${pad2(d)}`;
      const selectable = isSelectableMassDay(massDateCalYear, massDateCalMonth, d);
      const isSelected = iso === selectedMassDateIso;
      const thisDate = new Date(massDateCalYear, massDateCalMonth, d);
      thisDate.setHours(0, 0, 0, 0);
      const isToday = thisDate.getTime() === today.getTime();

      const classes = ['mi-cal-day'];
      if (!selectable) classes.push('mi-cal-day-disabled');
      if (isSelected) classes.push('mi-cal-day-selected');
      if (isToday && !isSelected) classes.push('mi-cal-day-today');

      html += `<button type="button" class="${classes.join(' ')}" data-date="${iso}"${selectable ? '' : ' disabled tabindex="-1"'}>${d}</button>`;
    }

    massDateGrid.innerHTML = html;

    const now = new Date();
    massDatePrevBtn.disabled = (massDateCalYear === now.getFullYear() && massDateCalMonth === now.getMonth());
  }

  function updateMassDateDisplay() {
    if (!selectedMassDateIso) {
      massDateDisplay.textContent = 'Select a date';
      massDateDisplay.classList.add('mi-date-placeholder');
    } else {
      const d = new Date(selectedMassDateIso + 'T00:00:00');
      massDateDisplay.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      massDateDisplay.classList.remove('mi-date-placeholder');
    }
  }

  function openMassDatePanel() {
    const base = selectedMassDateIso ? new Date(selectedMassDateIso + 'T00:00:00') : new Date();
    massDateCalYear = base.getFullYear();
    massDateCalMonth = base.getMonth();
    renderMassDateCalendar();
    massDatePanel.classList.remove('hidden');
    massDateTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeMassDatePanel() {
    massDatePanel.classList.add('hidden');
    massDateTrigger.setAttribute('aria-expanded', 'false');
  }

  function resetMassDatePicker(iso) {
    selectedMassDateIso = iso || null;
    massDateHiddenInput.value = selectedMassDateIso || '';
    updateMassDateDisplay();
    closeMassDatePanel();
  }

  massDateTrigger.addEventListener('click', () => {
    if (massDatePanel.classList.contains('hidden')) openMassDatePanel();
    else closeMassDatePanel();
  });

  massDateGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.mi-cal-day');
    if (!btn || btn.disabled) return;
    selectedMassDateIso = btn.dataset.date;
    massDateHiddenInput.value = selectedMassDateIso;
    updateMassDateDisplay();
    closeMassDatePanel();
  });

  massDatePrevBtn.addEventListener('click', () => {
    massDateCalMonth -= 1;
    if (massDateCalMonth < 0) { massDateCalMonth = 11; massDateCalYear -= 1; }
    renderMassDateCalendar();
  });

  massDateNextBtn.addEventListener('click', () => {
    massDateCalMonth += 1;
    if (massDateCalMonth > 11) { massDateCalMonth = 0; massDateCalYear += 1; }
    renderMassDateCalendar();
  });

  massDateClearBtn.addEventListener('click', () => {
    selectedMassDateIso = null;
    massDateHiddenInput.value = '';
    updateMassDateDisplay();
    closeMassDatePanel();
  });

  document.addEventListener('click', (e) => {
    if (!massDatePanel.classList.contains('hidden') && !e.target.closest('.mi-datepicker')) closeMassDatePanel();
  });

  document.addEventListener('keydown', (e) => {
    // Registered before the modal-wide Escape handler further down, so
    // this runs first — stopImmediatePropagation keeps a single Escape
    // press from closing the calendar AND the whole modal at once.
    if (e.key === 'Escape' && !massDatePanel.classList.contains('hidden')) {
      closeMassDatePanel();
      e.stopImmediatePropagation();
    }
  });

  function to24hInput(time12) {
    const [time, meridiem] = time12.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  document.getElementById('add-submit').addEventListener('click', async () => {
    if (addNameInput.value.trim()) addIntentionName();

    const donor       = document.getElementById('add-donor').value.trim();
    const offering          = parseInt(document.getElementById('add-offering').value, 10);
    const status              = document.getElementById('add-status').value.toLowerCase();
    const massDate              = document.getElementById('add-mass-date').value;
    const massTime24              = document.getElementById('add-mass-time').value;

    if (!donor || addedIntentions.length === 0 || !offering) {
      showToast('Please fill in donor name, at least one name (with category), and offering amount.', true);
      return;
    }

    const massTime = massTime24 ? formatTime12(massTime24) : undefined;

    /* The schema stores one type (and effectively one name) per record,
       but the Added Intentions list here can mix names and categories —
       so each entry becomes its own MassIntention row, all sharing the
       same donor, timeline, mass assignment, and status. The offering
       is split evenly across them (remainder on the last) so the total
       still matches exactly what was entered, without double-counting —
       same approach as the parishioner-facing Submit Intention modal. */
    const count = addedIntentions.length;
    const base = Math.floor(offering / count);
    const remainder = offering - base * count;

    addSubmitBtn.disabled = true;
    try {
      if (editTargetId === null) {
        const results = await Promise.all(addedIntentions.map((item, i) => {
          const cfg = typeConfig(item.typeId);
          return client.models.MassIntention.create({
            donor, type: cfg.label, names: JSON.stringify([item.name]),
            massDate: massDate || undefined,
            massTime: massDate ? massTime : undefined,
            offering: base + (i === count - 1 ? remainder : 0),
            status,
          });
        }));
        const failed = results.find(r => r.errors);
        if (failed) throw new Error(failed.errors.map(e => e.message).join('; '));

        showToast(count > 1
          ? `${count} intentions logged for ${donor}.`
          : `Intention logged for ${donor}.`);
      } else {
        const [first, ...rest] = addedIntentions;
        const firstCfg = typeConfig(first.typeId);
        const updateResult = await client.models.MassIntention.update({
          id: editTargetId,
          donor, type: firstCfg.label, names: JSON.stringify([first.name]),
          massDate: massDate || undefined,
          massTime: massDate ? massTime : undefined,
          offering: base + (rest.length === 0 ? remainder : 0),
          status,
        });
        if (updateResult.errors) throw new Error(updateResult.errors.map(e => e.message).join('; '));

        const createResults = await Promise.all(rest.map((item, i) => {
          const cfg = typeConfig(item.typeId);
          return client.models.MassIntention.create({
            donor, type: cfg.label, names: JSON.stringify([item.name]),
            massDate: massDate || undefined,
            massTime: massDate ? massTime : undefined,
            offering: base + (i === rest.length - 1 ? remainder : 0),
            status,
          });
        }));
        const failed = createResults.find(r => r.errors);
        if (failed) throw new Error(failed.errors.map(e => e.message).join('; '));

        showToast(rest.length > 0
          ? `Changes saved for ${donor} — ${rest.length} new intention${rest.length === 1 ? '' : 's'} added.`
          : `Changes saved for ${donor}.`);
        editTargetId = null;
      }

      closeModal(addModal);
      resetAddForm();
    } catch (err) {
      console.error('Failed to save intention:', err);
      showToast(err.message || "Couldn't save the intention.", true);
    } finally {
      addSubmitBtn.disabled = false;
    }
  });


  /* --- View (Details) Modal --- */
  const detailsModal = document.getElementById('details-modal');
  const detailsBody   = document.getElementById('details-body');

  function openDetailsModal(id) {
    const it = intentions.find(x => x.id === id);
    if (!it) return;

    const names = getNames(it);

    detailsBody.innerHTML = `
      <div class="so-detail-grid">
        <div><p class="so-detail-label">Donor</p><p class="so-detail-value">${escapeHtml(it.donor)}</p></div>
        <div><p class="so-detail-label">Intention Type</p><p class="so-detail-value">${escapeHtml(it.type)}</p></div>
        <div><p class="so-detail-label">Status</p><p class="so-detail-value">${statusLabel[it.status] || it.status}</p></div>
        <div><p class="so-detail-label">Offering</p><p class="so-detail-value">${formatPeso(it.offering)}</p></div>
        <div><p class="so-detail-label">Submitted</p><p class="so-detail-value">${formatShortDate(it.createdAt ? it.createdAt.slice(0, 10) : null)}</p></div>
        <div><p class="so-detail-label">Mass Date Assigned</p><p class="so-detail-value">${it.massDate ? `${formatShortDate(it.massDate)}${it.massTime ? ' · ' + it.massTime : ''}` : '—'}</p></div>
        ${it.startTime && it.endTime ? `
        <div class="col-span-2">
          <p class="so-detail-label">Timeline</p>
          <p class="so-detail-value">${escapeHtml(it.startTime)} – ${escapeHtml(it.endTime)}</p>
        </div>` : ''}
      </div>
      <div class="mt-3">
        <p class="so-detail-label">Name${names.length === 1 ? '' : 's'} (${names.length})</p>
        <div class="name-chip-list">
          ${names.map(n => `<span class="name-chip">${escapeHtml(n)}</span>`).join('') || '<span class="text-xs text-gray-400">—</span>'}
        </div>
      </div>
    `;

    openModal(detailsModal);
  }


  /* --- Remove Intention Modal --- */
  const removeModal = document.getElementById('remove-modal');
  const removeTargetName = document.getElementById('remove-target-name');
  let removeTargetId = null;

  function openRemoveModal(id) {
    const it = intentions.find(x => x.id === id);
    if (!it) return;
    removeTargetId = id;
    removeTargetName.textContent = it.donor;
    openModal(removeModal);
  }

  document.getElementById('remove-submit').addEventListener('click', async () => {
    if (removeTargetId === null) return;
    const it = intentions.find(x => x.id === removeTargetId);

    try {
      const result = await client.models.MassIntention.delete({ id: removeTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(removeModal);
      showToast(`Intention for ${it ? it.donor : 'donor'} removed.`);
      removeTargetId = null;
    } catch (err) {
      console.error('Failed to remove intention:', err);
      showToast(err.message || "Couldn't remove the intention.", true);
    }
  });


  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* ------------------------------------------
     VIEW TABS (Intentions Log / Reader's Sheet)
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
     READER'S SHEET
     A read-aloud version of the Mass Intentions
     Log, grouped into the 3 categories a lector
     traditionally reads from — replaces the old
     manual Excel sheet-per-mass workflow.
  ------------------------------------------ */
  const sheetMassSelect = document.getElementById('sheet-mass-select');
  const sheetEmpty        = document.getElementById('sheet-empty');
  const sheetBody           = document.getElementById('sheet-body');
  const sheetMassRange        = document.getElementById('sheet-mass-range');

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

  /* Every distinct (massDate, massTime) pair among intentions that
     have actually been assigned a mass date — that's what makes a
     "mass" selectable here, since this repo has no dedicated join
     between MassIntention and the Mass model. */
  function getSheetOptions() {
    const map = new Map();
    intentions.forEach(it => {
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

    const matching = intentions.filter(it => it.massDate && sheetKey(it) === currentSheetKey);

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

      // One continuous, "/"-separated flowing paragraph per category —
      // matching the parish's own printed sheet format — rather than a
      // table row per donor. A recurring intention's start/end window
      // is folded in as a small inline tag right after its names.
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

  /* e.g. "FOR JULY 25, 2026, 6:00 PM MASS" */
  function formatSheetRangeLabel(massDate, massTime) {
    const d = new Date(massDate + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    return massTime ? `FOR ${dateLabel}, ${massTime.toUpperCase()} MASS` : `FOR ${dateLabel} MASS`;
  }

  sheetMassSelect.addEventListener('change', () => {
    currentSheetKey = sheetMassSelect.value;
    findInput.value = '';
    findQuery = '';
    renderSheet();
  });


  /* --- Modal helpers --- */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { const overlay = btn.closest('.modal-overlay'); if (overlay) closeModal(overlay); });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(closeModal); });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }


  /* --- Print ---
     The table only renders the current page's rows, so printing
     straight from the DOM would silently drop everything else.
     Swap in every filtered row just for the print, then restore
     the paginated view once the print dialog closes. */
  document.getElementById('btn-print').addEventListener('click', () => {
    const printDateEl = document.getElementById('print-date-value');
    if (printDateEl) {
      printDateEl.textContent = `Printed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }

    const filtered = getFilteredIntentions();
    if (filtered.length > 0) tbody.innerHTML = filtered.map(intentionRowHtml).join('');

    window.print();
  });

  window.addEventListener('afterprint', renderTable);

  document.getElementById('btn-print-sheet').addEventListener('click', () => {
    if (!currentSheetKey) {
      showToast("Select a mass to print its reader's sheet.", true);
      return;
    }
    const printDateEl = document.getElementById('sheet-print-date-value');
    if (printDateEl) {
      printDateEl.textContent = `Printed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    window.print();
  });


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