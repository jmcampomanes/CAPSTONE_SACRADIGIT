/* ============================================
   SacraDigit Admin — Mass Intentions Scripts (AWS Amplify)
   Backed by the MassIntention model (extended with
   donor, type, names, startTime/endTime, massDate/
   massTime — see amplify/data/resource.ts).
   The "names" field is a.json(), so it's stringified
   before sending and parsed back when reading.

   Records are never deleted: Cancel sets status
   'cancelled' with a cancelReason, so the log keeps
   them. Every intention is 'scheduled' as soon as
   it's logged — there's no pending/approval step.
   Booking, changes and cancelling are only allowed up to
   the day before the Mass; from the Mass day on, Edit
   can only change the status (e.g. mark Completed).
   ============================================ */

import { client } from '../amplify-init.js';
import { printReport, printReadersSheet, printAltarSheets, tableHtml, esc } from '../print-report.js';
import { formatFullName } from '../name-utils.js';
import { createIntentionForm } from '../mass-intention-form.js';
import { showToast, reportEmail } from './admin-ui.js';
import { notifyMassIntentionUpdate } from '../email-notify.js';

document.addEventListener('DOMContentLoaded', () => {

  // Names are stored as { firstName, middleName, lastName, extension }
  // objects (see name-utils.js). normalizeName tolerates any older
  // plain-string entries so display code never has to branch on shape.
  function normalizeName(n) {
    return typeof n === 'string' ? { firstName: n, middleName: '', lastName: '', extension: '' } : (n || {});
  }
  function nameDisplay(n) { return formatFullName(normalizeName(n)); }

  const todayISO = new Date().toISOString().slice(0, 10);
  // Local date (UTC would still say "yesterday" before 8 AM in the Philippines)
  const localTodayISO = () => new Date().toLocaleDateString('en-CA');

  const CLOSED_STATUSES = ['cancelled'];
  const isClosed = (it) => CLOSED_STATUSES.includes(it.status);
  // The Mass day has arrived (or passed): no more changes except status.
  const isLocked = (it) => !!it.massDate && it.massDate <= localTodayISO();

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

  const badgeClass = { scheduled: 'badge-green', completed: 'badge-blue', cancelled: 'badge-red' };
  const statusLabel = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };

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
      getNames(it).some(n => nameDisplay(n).toLowerCase().includes(query));

    const matchesType   = !typeVal || it.type === typeVal;
    const matchesStatus  = !statusVal || it.status === statusVal;

    return matchesQuery && matchesType && matchesStatus;
  }

  /* ------------------------------------------
     READER'S SHEET — declared here, ABOVE the observeQuery
     subscription just below, because that subscription's callback
     (via renderSheetOptions -> renderSheet -> applyCategoryFilter /
     refreshFindMatches) can fire synchronously on first subscribe
     and reads these consts/lets. Same TDZ pitfall documented on the
     user-facing Mass Intentions and Donations pages.
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

  // Once its Mass day arrives there's nothing left to do but mark it
  // Completed — this does that automatically instead of waiting for an
  // admin to open Edit and change the status by hand. Runs whenever this
  // page loads/refreshes (there's no always-on server here to run it on
  // a schedule); autoCompleting tracks ids already sent so a burst of
  // observeQuery updates can't fire the same update twice.
  const autoCompleting = new Set();
  function autoCompletePastIntentions(items) {
    items
      .filter(it => it.status === 'scheduled' && isLocked(it) && !autoCompleting.has(it.id))
      .forEach(it => {
        autoCompleting.add(it.id);
        client.models.MassIntention.update({ id: it.id, status: 'completed' })
          .catch(err => console.error('Failed to auto-complete intention:', it.id, err))
          .finally(() => autoCompleting.delete(it.id));
      });
  }

  /* --- Live data --- */
  client.models.MassIntention.observeQuery().subscribe({
    next: ({ items }) => {
      intentions = items;
      renderStats();
      renderTable();
      renderSheetOptions();
      autoCompletePastIntentions(items);
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

    const totalOfferings = thisWeek.filter(i => !isClosed(i)).reduce((sum, i) => sum + (i.offering || 0), 0);
    document.getElementById('stat-offerings').textContent = formatPeso(totalOfferings);
  }


  function intentionRowHtml(it) {
    const massDateLabel = it.massDate
      ? `${formatShortDate(it.massDate)}${it.massTime ? ' · ' + it.massTime : ''}`
      : '—';

    const names = getNames(it);
    // Cancel a scheduled intention — only up to the day before the Mass.
    const canCancel = it.status === 'scheduled' && !isLocked(it);
    const actionHtml = `
      <div class="row-actions">
        <button type="button" class="act-btn row-view" data-id="${it.id}">View</button>
        ${isClosed(it) ? '' : `<button type="button" class="act-btn row-edit" data-id="${it.id}">Edit</button>`}
        ${canCancel ? `<button type="button" class="act-btn act-danger row-remove" data-id="${it.id}">Cancel…</button>` : ''}
      </div>
    `;

    return `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(it.donor)}</td>
        <td>
          ${escapeHtml(it.type)}
          ${names.length ? `<div class="text-xs text-gray-400 mt-0.5">${escapeHtml(names.map(nameDisplay).join(', '))}</div>` : ''}
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


  /* --- Add / Edit Intention — 3 numbered steps ---
     Same form as the parishioner's Submit a Mass Intention
     (../mass-intention-form.js), plus the donor, the exact Mass
     day and time, and the status. Edit loads the record; from
     the Mass day on, only its status can change (locked). Saved
     as one MassIntention record per person per category, the
     offering split across them; when editing, the first record
     is updated and any extra people/categories are added. */
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

  function to24hInput(time12) {
    const [time, meridiem] = time12.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  let editTargetId = null; // null = Add, otherwise the record being edited

  const intentionForm = createIntentionForm(document.getElementById('add-modal'), {
    role: 'admin',
    intentionTypes,
    toast: showToast,
    async onSubmit({ donor, records, massDate, massTime24, status, lockedOnly }) {
      // Mass day reached: only the status can change.
      if (lockedOnly) {
        const it = intentions.find(x => x.id === editTargetId);
        const result = await client.models.MassIntention.update({ id: editTargetId, status });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`Status updated for ${it ? it.donor : 'donor'}.`);
        editTargetId = null;
        return;
      }
      if (massDate && massDate <= localTodayISO()) throw new Error('Mass dates can only be booked up to the day before. Please pick a later date.');
      const massTime = massDate && massTime24 ? formatTime12(massTime24) : undefined;
      const fields = (r) => ({
        donor, type: typeConfig(r.typeId).label, names: JSON.stringify([r.name]),
        massDate: massDate || undefined, massTime, offering: r.offering, status,
      });

      if (editTargetId === null) {
        const results = await Promise.all(records.map(r => client.models.MassIntention.create(fields(r))));
        const failed = results.find(r => r.errors);
        if (failed) throw new Error(failed.errors.map(e => e.message).join('; '));
        showToast(records.length > 1 ? `${records.length} intentions logged for ${donor}.` : `Intention logged for ${donor}.`);
        return;
      }
      const [first, ...rest] = records;
      const upd = await client.models.MassIntention.update({ id: editTargetId, ...fields(first) });
      if (upd.errors) throw new Error(upd.errors.map(e => e.message).join('; '));
      const created = await Promise.all(rest.map(r => client.models.MassIntention.create(fields(r))));
      const failed = created.find(r => r.errors);
      if (failed) throw new Error(failed.errors.map(e => e.message).join('; '));
      showToast(rest.length ? `Changes saved for ${donor} — ${rest.length} new intention${rest.length === 1 ? '' : 's'} added.` : `Changes saved for ${donor}.`);
      editTargetId = null;
    },
  });

  document.getElementById('btn-add-intention').addEventListener('click', () => {
    editTargetId = null;
    intentionForm.open();
  });

  function openEditModal(id) {
    const it = intentions.find(x => x.id === id);
    if (!it) return;
    editTargetId = id;
    const typeId = typeIdFromLabel(it.type);
    intentionForm.open({
      title: 'Edit Mass Intention',
      submitLabel: 'Save Changes',
      donor: it.donor,
      // A record holds one category; its name(s) become prayer-list rows that can be re-tagged
      people: getNames(it).map(n => ({ name: normalizeName(n), typeIds: [typeId] })),
      offering: it.offering,
      massDate: it.massDate || '',
      massTime24: it.massTime ? to24hInput(it.massTime) : '',
      status: it.status,
      locked: isLocked(it),
    });
  }


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
        ${isClosed(it) ? `
        <div class="col-span-2" style="grid-column: 1 / -1;">
          <p class="so-detail-label">Cancellation Reason</p>
          <p class="so-detail-value">${escapeHtml(it.cancelReason) || 'No reason given'}</p>
        </div>` : ''}
        ${it.startTime && it.endTime ? `
        <div class="col-span-2">
          <p class="so-detail-label">Timeline</p>
          <p class="so-detail-value">${escapeHtml(it.startTime)} – ${escapeHtml(it.endTime)}</p>
        </div>` : ''}
      </div>
      <div class="mt-3">
        <p class="so-detail-label">Name${names.length === 1 ? '' : 's'} (${names.length})</p>
        <div class="name-chip-list">
          ${names.map(n => `<span class="name-chip">${escapeHtml(nameDisplay(n))}</span>`).join('') || '<span class="text-xs text-gray-400">—</span>'}
        </div>
      </div>
    `;

    openModal(detailsModal);
  }


  /* --- Cancel Intention Modal ---
     The record stays (status 'cancelled' + cancelReason) for proper keeping. */
  const removeModal = document.getElementById('remove-modal');
  const removeTargetName = document.getElementById('remove-target-name');
  const removeReason = document.getElementById('remove-reason');
  const removeSubmitBtn = document.getElementById('remove-submit');
  let removeTargetId = null;
  const removeNextStatus = 'cancelled';

  function openRemoveModal(id) {
    const it = intentions.find(x => x.id === id);
    if (!it) return;
    if (isLocked(it)) { showToast('Intentions can only be cancelled up to the day before the Mass.', true); return; }
    removeTargetId = id;
    document.getElementById('remove-title').textContent = 'Cancel Intention';
    document.getElementById('remove-verb').textContent = 'Cancel the intention for';
    removeSubmitBtn.textContent = 'Cancel Intention';
    removeTargetName.textContent = it.donor;
    removeReason.value = '';
    removeReason.classList.remove('border-red-400');
    openModal(removeModal);
  }

  removeReason.addEventListener('input', () => removeReason.classList.remove('border-red-400'));

  removeSubmitBtn.addEventListener('click', async () => {
    if (removeTargetId === null) return;
    const it = intentions.find(x => x.id === removeTargetId);
    const reason = removeReason.value.trim();
    if (!reason) {
      removeReason.classList.add('border-red-400');
      showToast('Please give a reason.', true);
      return;
    }

    removeSubmitBtn.disabled = true;
    try {
      const result = await client.models.MassIntention.update({ id: removeTargetId, status: removeNextStatus, cancelReason: reason });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(removeModal);
      const doneMsg = `Intention for ${it ? it.donor : 'donor'} ${removeNextStatus}.`;
      // Only intentions a parishioner submitted have an email; office-logged ones just get the toast.
      if (it?.email) {
        const names = getNames(it).map(nameDisplay).join(', ');
        reportEmail(notifyMassIntentionUpdate({
          to: it.email, name: it.donor, status: 'cancelled', reason,
          date: it.massDate ? new Date(it.massDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '',
          time: it.massTime, detailsLines: [[it.type, names].filter(Boolean).join(': ')].filter(Boolean),
        }), it.donor, doneMsg);
      } else showToast(doneMsg);
      removeTargetId = null;
    } catch (err) {
      console.error('Failed to cancel intention:', err);
      showToast(err.message || "Couldn't update the intention.", true);
    } finally {
      removeSubmitBtn.disabled = false;
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


  function sheetKey(it) { return `${it.massDate}||${it.massTime || ''}`; }

  /* Every distinct (massDate, massTime) pair among intentions that
     have actually been assigned a mass date — that's what makes a
     "mass" selectable here, since this repo has no dedicated join
     between MassIntention and the Mass model. */
  function getSheetOptions() {
    const map = new Map();
    intentions.forEach(it => {
      if (!it.massDate || isClosed(it)) return;
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

    const matching = intentions.filter(it => it.massDate && !isClosed(it) && sheetKey(it) === currentSheetKey);

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
        const namesText = names.length ? names.map(nameDisplay).join(' / ') : it.donor;
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
  /* Print: every intention matching the current filters (not just the
     page on screen), with the offering total, on the parish letterhead. */
  document.getElementById('btn-print').addEventListener('click', () => {
    const rows = getFilteredIntentions();
    const total = rows.filter(it => !isClosed(it)).reduce((sum, it) => sum + (Number(it.offering) || 0), 0);
    const tableRows = rows.map(it => {
      const names = getNames(it).map(nameDisplay).join(', ');
      return [
        esc(it.donor),
        `${esc(it.type)}${names ? `<div class="small">${esc(names)}</div>` : ''}`,
        it.massDate ? esc(`${formatShortDate(it.massDate)}${it.massTime ? ' · ' + it.massTime : ''}`) : '<span class="muted">Not yet assigned</span>',
        esc(statusLabel[it.status] || it.status),
        esc(formatPeso(it.offering)),
      ];
    });
    const cols = [{ label: 'Donor' }, { label: 'Intention' }, { label: 'Mass' }, { label: 'Status' }, { label: 'Offering', cls: 'num' }];
    printReport({
      title: 'Mass Intentions Log',
      subtitle: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      chips: [['Intentions', rows.length], ['Total offerings', formatPeso(total)]],
      body: tableHtml(cols, tableRows, { empty: 'No intentions match the current filters.', foot: ['Total', '', '', '', esc(formatPeso(total))] }),
      signatures: ['Prepared by', 'Parish Priest'],
    });
  });

  /* --- Altar sheets: every Mass of the chosen day, one page each --- */
  const sheetDayInput = document.getElementById('sheet-day');
  const SHEET_GROUPS = [
    ['thanksgiving', 'Thanksgiving & (Birthdays):'],
    ['special', 'Special Intentions:'],
    ['souls', 'Souls:'],
  ];

  // The next day (today or later) that has intentions assigned, so the
  // button is ready for the coming Masses without picking a date.
  function nextDayWithIntentions() {
    const today = localTodayISO();
    const days = [...new Set(intentions.filter(it => it.massDate && !isClosed(it) && it.massDate >= today).map(it => it.massDate))].sort();
    return days[0] || today;
  }
  let sheetDayTouched = false;
  sheetDayInput.addEventListener('change', () => { sheetDayTouched = true; });
  const refreshSheetDay = () => { if (!sheetDayTouched) sheetDayInput.value = nextDayWithIntentions(); };
  refreshSheetDay();
  document.querySelector('[data-tab="sheet"]')?.addEventListener('click', refreshSheetDay);

  document.getElementById('btn-print-day').addEventListener('click', () => {
    const day = sheetDayInput.value;
    if (!day) { showToast('Pick a day to print.', true); return; }
    const forDay = intentions.filter(it => it.massDate === day && !isClosed(it));
    if (!forDay.length) { showToast(`No intentions are assigned to Masses on ${formatShortDate(day)}.`, true); return; }

    const byMass = new Map();
    forDay.forEach(it => {
      const key = it.massTime || '';
      if (!byMass.has(key)) byMass.set(key, []);
      byMass.get(key).push(it);
    });
    const masses = [...byMass.entries()]
      .sort(([a], [b]) => timeToMinutes(a) - timeToMinutes(b))
      .map(([time, items]) => ({
        heading: time ? `${time.replace(/^0/, '')} Mass` : 'Mass (time not set)',
        groups: SHEET_GROUPS.map(([bucket, title]) => [title, items
          .filter(it => (GROUP_TYPE_MAP[it.type] || 'special') === bucket)
          .map(it => { const names = getNames(it); return names.length ? names.map(nameDisplay).join(' / ') : it.donor; })
          .join(' / ')]),
      }));
    const dayLabel = new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    printAltarSheets(dayLabel, masses);
  });

  document.getElementById('btn-print-sheet').addEventListener('click', () => {
    if (!currentSheetKey) {
      showToast("Select a mass to print its reader's sheet.", true);
      return;
    }
    printReadersSheet(); // large, easy-to-read sheet for the lector (../print-report.js)
  });



});