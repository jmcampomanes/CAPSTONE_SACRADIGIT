/* ============================================
   SacraDigit Admin — Mass Intentions Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" fixed to match the rest of the app.
     submittedDate = when the donor submitted it
     massDate/massTime = the assigned mass slot
     (null until assigned)
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  let intentions = [
    { donor: 'Santos Family',     type: 'For the Soul of...',    note: 'Lola Remedios Santos', submittedDate: '2026-06-18', massDate: '2026-06-21', massTime: '08:00 AM', offering: 300, status: 'Scheduled' },
    { donor: 'Cruz, Jose R.',      type: 'Thanksgiving',           note: 'For a safe surgery',    submittedDate: '2026-06-18', massDate: '2026-06-21', massTime: '06:00 AM', offering: 250, status: 'Scheduled' },
    { donor: 'Reyes Family',       type: 'Birthday Blessing',       note: "For Ana's 60th birthday", submittedDate: '2026-06-17', massDate: null,            massTime: null,        offering: 200, status: 'Pending'   },
    { donor: 'Garcia, Pedro M.',   type: 'For the Soul of...',     note: 'Pedro Garcia Sr.',       submittedDate: '2026-06-17', massDate: null,            massTime: null,        offering: 300, status: 'Pending'   },
    { donor: 'Villanueva Family',  type: 'Healing',                 note: 'For Rosa\'s recovery',    submittedDate: '2026-06-16', massDate: null,            massTime: null,        offering: 250, status: 'Pending'   },
    { donor: 'Bautista, Carlo M.', type: 'Thanksgiving',             note: 'For passing the bar exam', submittedDate: '2026-05-30', massDate: '2026-06-05', massTime: '07:00 AM', offering: 300, status: 'Completed' },
    { donor: 'Mendoza, Carmen P.', type: 'For the Soul of...',       note: 'Carmen\'s late husband', submittedDate: '2026-05-25', massDate: '2026-05-29', massTime: '06:00 AM', offering: 250, status: 'Completed' },
  ];

  const tbody          = document.getElementById('intentions-tbody');
  const intentionsEmpty  = document.getElementById('intentions-empty');
  const logCount         = document.getElementById('log-count');

  const searchInput = document.getElementById('search-input');
  const typeFilter    = document.getElementById('type-filter');
  const statusFilter   = document.getElementById('status-filter');

  const badgeClass = {
    'Pending':   'badge-amber',
    'Scheduled': 'badge-green',
    'Completed': 'badge-blue',
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatShortDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatPeso(amount) {
    return '₱' + amount.toLocaleString('en-US');
  }

  function matchesFilters(it) {
    const query    = searchInput.value.trim().toLowerCase();
    const typeVal   = typeFilter.value;
    const statusVal  = statusFilter.value;

    const matchesQuery = !query ||
      it.donor.toLowerCase().includes(query) ||
      (it.note && it.note.toLowerCase().includes(query));

    const matchesType   = !typeVal || it.type === typeVal;
    const matchesStatus  = !statusVal || it.status === statusVal;

    return matchesQuery && matchesType && matchesStatus;
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    const weekStart = new Date(TODAY_ISO + 'T00:00:00');
    weekStart.setDate(weekStart.getDate() - 7); // count submissions from the past 7 days
    const weekEnd = new Date(TODAY_ISO + 'T00:00:00');
    weekEnd.setDate(weekEnd.getDate() + 1);

    const thisWeek = intentions.filter(i => {
      const d = new Date(i.submittedDate + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    });

    document.getElementById('stat-total-week').textContent = thisWeek.length;
    document.getElementById('stat-pending').textContent = intentions.filter(i => i.status === 'Pending').length;

    const totalOfferings = thisWeek.reduce((sum, i) => sum + i.offering, 0);
    document.getElementById('stat-offerings').textContent = formatPeso(totalOfferings);
  }


  /* ------------------------------------------
     2. RENDER — Mass Intentions Log table
  ------------------------------------------ */
  function renderTable() {
    const sorted = intentions.slice().sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    const filtered = sorted.filter(matchesFilters);

    logCount.textContent = `${filtered.length} intention${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      intentionsEmpty.classList.remove('hidden');
      return;
    }
    intentionsEmpty.classList.add('hidden');

    tbody.innerHTML = filtered.map((it) => {
      const realIndex = intentions.indexOf(it);
      const massDateLabel = it.massDate
        ? `${formatShortDate(it.massDate)}${it.massTime ? ' · ' + it.massTime : ''}`
        : '—';

      const actionHtml = `
        <div class="row-actions">
          <button type="button" class="row-edit" data-index="${realIndex}">Edit</button>
          <button type="button" class="row-view" data-index="${realIndex}">View</button>
          <button type="button" class="row-remove" data-index="${realIndex}">Remove</button>
        </div>
      `;

      return `
        <tr>
          <td class="font-medium text-gray-900">${escapeHtml(it.donor)}</td>
          <td>
            ${escapeHtml(it.type)}
            ${it.note ? `<div class="text-xs text-gray-400 mt-0.5">${escapeHtml(it.note)}</div>` : ''}
            ${it.startTime && it.endTime ? `<div class="intention-timeline">🕐 ${escapeHtml(it.startTime)} – ${escapeHtml(it.endTime)}</div>` : ''}
          </td>
          <td>${massDateLabel}</td>
          <td class="offering-amount">${formatPeso(it.offering)}</td>
          <td><span class="badge ${badgeClass[it.status] || 'badge-gray'}">${escapeHtml(it.status)}</span></td>
          <td class="text-right no-print">${actionHtml}</td>
        </tr>
      `;
    }).join('');
  }

  tbody.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.row-edit');
    const viewBtn    = e.target.closest('.row-view');
    const removeBtn   = e.target.closest('.row-remove');

    if (editBtn)   openEditModal(parseInt(editBtn.dataset.index, 10));
    if (viewBtn)    openDetailsModal(parseInt(viewBtn.dataset.index, 10));
    if (removeBtn)  openRemoveModal(parseInt(removeBtn.dataset.index, 10));
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

  renderStats();
  renderTable();


  /* ------------------------------------------
     3. ADD INTENTION MODAL
  ------------------------------------------ */
  const addModal = document.getElementById('add-modal');

  const addNameInput  = document.getElementById('add-name-input');
  const addAddNameBtn  = document.getElementById('add-add-name');
  const addNameChipsBox = document.getElementById('add-name-chips');
  const addNameCountLabel = document.getElementById('add-name-count');

  let addIntentionNames = [];
  let editTargetIndex = null; // null = Add mode, otherwise index into `intentions` being edited

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
    if (e.key === 'Enter') {
      e.preventDefault();
      addIntentionName();
    }
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
    document.getElementById('add-status').value = 'Pending';
    document.getElementById('add-mass-date').value = '';
    document.getElementById('add-mass-time').value = '';
    addIntentionNames = [];
    renderAddNameChips();
  }

  document.getElementById('btn-add-intention').addEventListener('click', () => {
    editTargetIndex = null;
    addModalTitle.textContent = 'Add Mass Intention';
    addSubmitBtn.textContent = 'Save Intention';
    resetAddForm();
    openModal(addModal);
  });

  function openEditModal(idx) {
    const it = intentions[idx];
    if (!it) return;

    editTargetIndex = idx;
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

    addIntentionNames = it.names && it.names.length ? it.names.slice() : (it.note ? [it.note] : []);
    renderAddNameChips();

    openModal(addModal);
  }

  // Convert a "08:00 AM" style string back into a 24h "HH:MM" value for <input type="time">
  function to24hInput(time12) {
    const [time, meridiem] = time12.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  document.getElementById('add-submit').addEventListener('click', () => {
    // If a name was typed but not added yet, add it for them.
    if (addNameInput.value.trim()) addIntentionName();

    const donor       = document.getElementById('add-donor').value.trim();
    const type          = document.getElementById('add-type').value;
    const startTime24    = document.getElementById('add-start-time').value;
    const endTime24        = document.getElementById('add-end-time').value;
    const offering          = parseInt(document.getElementById('add-offering').value, 10);
    const status              = document.getElementById('add-status').value;
    const massDate              = document.getElementById('add-mass-date').value;
    const massTime24              = document.getElementById('add-mass-time').value;

    if (!donor || !type || addIntentionNames.length === 0 || !offering) {
      showToast('Please fill in donor name, intention type, at least one name, and offering amount.', true);
      return;
    }

    const names = addIntentionNames.slice();
    const startTime = startTime24 ? formatTime12(startTime24) : null;
    const endTime     = endTime24 ? formatTime12(endTime24) : null;
    const massTime      = massTime24 ? formatTime12(massTime24) : null;

    if (editTargetIndex === null) {
      // ADD mode
      intentions.unshift({
        donor,
        type,
        names,
        note: names.join(', '),
        startTime,
        endTime,
        submittedDate: TODAY_ISO,
        massDate: massDate || null,
        massTime: massDate ? massTime : null,
        offering,
        status,
      });
      showToast(`Intention logged for ${donor}.`);
    } else {
      // EDIT mode — update in place
      const it = intentions[editTargetIndex];
      it.donor      = donor;
      it.type        = type;
      it.names        = names;
      it.note          = names.join(', ');
      it.startTime      = startTime;
      it.endTime          = endTime;
      it.offering          = offering;
      it.status              = status;
      it.massDate              = massDate || null;
      it.massTime                = massDate ? massTime : null;
      showToast(`Changes saved for ${donor}.`);
      editTargetIndex = null;
    }

    renderStats();
    renderTable();
    closeModal(addModal);
    resetAddForm();
  });


  /* ------------------------------------------
     4. VIEW (DETAILS) MODAL
  ------------------------------------------ */
  const detailsModal = document.getElementById('details-modal');
  const detailsBody   = document.getElementById('details-body');

  function openDetailsModal(idx) {
    const it = intentions[idx];
    if (!it) return;

    const names = (it.names && it.names.length) ? it.names : (it.note ? [it.note] : []);

    detailsBody.innerHTML = `
      <div class="so-detail-grid">
        <div>
          <p class="so-detail-label">Donor</p>
          <p class="so-detail-value">${escapeHtml(it.donor)}</p>
        </div>
        <div>
          <p class="so-detail-label">Intention Type</p>
          <p class="so-detail-value">${escapeHtml(it.type)}</p>
        </div>
        <div>
          <p class="so-detail-label">Status</p>
          <p class="so-detail-value">${escapeHtml(it.status)}</p>
        </div>
        <div>
          <p class="so-detail-label">Offering</p>
          <p class="so-detail-value">${formatPeso(it.offering)}</p>
        </div>
        <div>
          <p class="so-detail-label">Submitted</p>
          <p class="so-detail-value">${formatShortDate(it.submittedDate)}</p>
        </div>
        <div>
          <p class="so-detail-label">Mass Date Assigned</p>
          <p class="so-detail-value">${it.massDate ? `${formatShortDate(it.massDate)}${it.massTime ? ' · ' + it.massTime : ''}` : '—'}</p>
        </div>
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


  /* ------------------------------------------
     5. REMOVE INTENTION MODAL
  ------------------------------------------ */
  const removeModal = document.getElementById('remove-modal');
  const removeTargetName = document.getElementById('remove-target-name');
  let removeTargetIndex = null;

  function openRemoveModal(idx) {
    const it = intentions[idx];
    if (!it) return;
    removeTargetIndex = idx;
    removeTargetName.textContent = it.donor;
    openModal(removeModal);
  }

  document.getElementById('remove-submit').addEventListener('click', () => {
    if (removeTargetIndex === null) return;

    const it = intentions[removeTargetIndex];
    intentions.splice(removeTargetIndex, 1);

    renderStats();
    renderTable();
    closeModal(removeModal);
    showToast(`Intention for ${it.donor} removed.`);

    removeTargetIndex = null;
  });


  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* ------------------------------------------
     6. MODAL HELPERS (shared open/close/escape)
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) closeModal(overlay);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(closeModal);
    }
  });

  function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }


  /* ------------------------------------------
     7. PRINT INTENTIONS
  ------------------------------------------ */
  document.getElementById('btn-print').addEventListener('click', () => {
    const printDateEl = document.getElementById('print-date-value');
    if (printDateEl) {
      const d = new Date(TODAY_ISO + 'T00:00:00');
      printDateEl.textContent = `Printed ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    window.print();
  });


  /* ------------------------------------------
     8. TOAST NOTIFICATIONS
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.querySelector('.toast-message').textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});