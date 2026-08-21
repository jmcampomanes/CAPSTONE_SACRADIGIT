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

  const todayISO = new Date().toISOString().slice(0, 10);

  let intentions = []; // kept in sync via observeQuery, each has .id

  const tbody          = document.getElementById('intentions-tbody');
  const intentionsEmpty  = document.getElementById('intentions-empty');
  const logCount         = document.getElementById('log-count');

  const searchInput = document.getElementById('search-input');
  const typeFilter    = document.getElementById('type-filter');
  const statusFilter   = document.getElementById('status-filter');

  const badgeClass = { pending: 'badge-amber', scheduled: 'badge-green', completed: 'badge-blue' };
  const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', completed: 'Completed' };

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


  function renderTable() {
    updateActiveStatCard();
    const sorted = intentions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const filtered = sorted.filter(matchesFilters);

    logCount.textContent = `${filtered.length} intention${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      intentionsEmpty.classList.remove('hidden');
      return;
    }
    intentionsEmpty.classList.add('hidden');

    tbody.innerHTML = filtered.map((it) => {
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
    }).join('');
  }

  tbody.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.row-edit');
    const viewBtn    = e.target.closest('.row-view');
    const removeBtn   = e.target.closest('.row-remove');

    if (editBtn)   openEditModal(editBtn.dataset.id);
    if (viewBtn)    openDetailsModal(viewBtn.dataset.id);
    if (removeBtn)  openRemoveModal(removeBtn.dataset.id);
  });

  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);
  statusFilter.addEventListener('change', renderTable);

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    statusFilter.value = '';
    renderTable();
  });


  /* --- Add/Edit Intention Modal --- */
  const addModal = document.getElementById('add-modal');

  const addNameInput  = document.getElementById('add-name-input');
  const addAddNameBtn  = document.getElementById('add-add-name');
  const addNameChipsBox = document.getElementById('add-name-chips');
  const addNameCountLabel = document.getElementById('add-name-count');

  let addIntentionNames = [];
  let editTargetId = null; // null = Add mode, otherwise id of intention being edited

  const addModalTitle = document.getElementById('add-modal-title');
  const addSubmitBtn   = document.getElementById('add-submit');

  function renderAddNameChips() {
    addNameChipsBox.innerHTML = addIntentionNames.map((n, i) => `
      <span class="name-chip" data-index="${i}">
        ${escapeHtml(n)}
        <button type="button" class="name-chip-remove" data-index="${i}" aria-label="Remove ${escapeHtml(n)}">×</button>
      </span>
    `).join('');

    if (addIntentionNames.length > 0) {
      addNameCountLabel.textContent = addIntentionNames.length;
      addNameCountLabel.classList.remove('hidden');
    } else {
      addNameCountLabel.classList.add('hidden');
    }
  }

  function addIntentionName() {
    const val = addNameInput.value.trim();
    if (!val) return;
    addIntentionNames.push(val);
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
    const btn = e.target.closest('.name-chip-remove');
    if (!btn) return;
    addIntentionNames.splice(parseInt(btn.dataset.index, 10), 1);
    renderAddNameChips();
  });

  function resetAddForm() {
    document.getElementById('add-donor').value = '';
    document.getElementById('add-type').value = '';
    document.getElementById('add-start-time').value = '';
    document.getElementById('add-end-time').value = '';
    document.getElementById('add-offering').value = '';
    document.getElementById('add-status').value = 'pending';
    document.getElementById('add-mass-date').value = '';
    document.getElementById('add-mass-time').value = '';
    addIntentionNames = [];
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
    document.getElementById('add-type').value = it.type;
    document.getElementById('add-start-time').value = it.startTime ? to24hInput(it.startTime) : '';
    document.getElementById('add-end-time').value = it.endTime ? to24hInput(it.endTime) : '';
    document.getElementById('add-offering').value = it.offering;
    document.getElementById('add-status').value = it.status;
    document.getElementById('add-mass-date').value = it.massDate || '';
    document.getElementById('add-mass-time').value = it.massTime ? to24hInput(it.massTime) : '';

    addIntentionNames = getNames(it);
    renderAddNameChips();

    openModal(addModal);
  }

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
    const type          = document.getElementById('add-type').value;
    const startTime24    = document.getElementById('add-start-time').value;
    const endTime24        = document.getElementById('add-end-time').value;
    const offering          = parseInt(document.getElementById('add-offering').value, 10);
    const status              = document.getElementById('add-status').value.toLowerCase();
    const massDate              = document.getElementById('add-mass-date').value;
    const massTime24              = document.getElementById('add-mass-time').value;

    if (!donor || !type || addIntentionNames.length === 0 || !offering) {
      showToast('Please fill in donor name, intention type, at least one name, and offering amount.', true);
      return;
    }

    const names = JSON.stringify(addIntentionNames);
    const startTime = startTime24 ? formatTime12(startTime24) : undefined;
    const endTime     = endTime24 ? formatTime12(endTime24) : undefined;
    const massTime      = massTime24 ? formatTime12(massTime24) : undefined;

    try {
      if (editTargetId === null) {
        const result = await client.models.MassIntention.create({
          donor, type, names, startTime, endTime,
          massDate: massDate || undefined,
          massTime: massDate ? massTime : undefined,
          offering, status,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`Intention logged for ${donor}.`);
      } else {
        const result = await client.models.MassIntention.update({
          id: editTargetId,
          donor, type, names, startTime, endTime,
          massDate: massDate || undefined,
          massTime: massDate ? massTime : undefined,
          offering, status,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`Changes saved for ${donor}.`);
        editTargetId = null;
      }

      closeModal(addModal);
      resetAddForm();
    } catch (err) {
      console.error('Failed to save intention:', err);
      showToast(err.message || "Couldn't save the intention.", true);
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


  /* --- Print --- */
  document.getElementById('btn-print').addEventListener('click', () => {
    const printDateEl = document.getElementById('print-date-value');
    if (printDateEl) {
      const d = new Date();
      printDateEl.textContent = `Printed ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
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