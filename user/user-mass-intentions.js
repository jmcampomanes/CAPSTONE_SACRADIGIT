/* ============================================
   SacraDigit — User Mass Intentions Scripts
   (user-mass-intentions.js)
   Runs after user-shell.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  const TODAY_ISO = '2026-06-19';

  /* ------------------------------------------
     0. INTENTION TYPES
  ------------------------------------------ */
  const intentionTypes = [
    {
      id: 'soul',
      label: 'For the Soul of…',
      iconBg: 'rgba(107,114,128,0.12)',
      iconColor: '#6b7280',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>`,
    },
    {
      id: 'thanksgiving',
      label: 'Thanksgiving',
      iconBg: 'rgba(201,168,76,0.16)',
      iconColor: '#b5943e',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>`,
    },
    {
      id: 'healing',
      label: 'Healing',
      iconBg: 'rgba(21,128,61,0.1)',
      iconColor: '#15803d',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
    },
    {
      id: 'birthday',
      label: 'Birthday Blessing',
      iconBg: 'rgba(139,143,199,0.16)',
      iconColor: '#5b5fa8',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A1.994 1.994 0 003 15.546M8.5 6.5V6a3.5 3.5 0 117 0v.5M4 15h16v5H4z"/></svg>`,
    },
    {
      id: 'special',
      label: 'Special Intention',
      iconBg: 'rgba(239,68,68,0.1)',
      iconColor: '#dc2626',
      icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`,
    },
  ];

  /* ------------------------------------------
     1. SAMPLE DATA — my past intentions
  ------------------------------------------ */
  let myIntentions = [
    {
      type: 'For the Soul of…',
      typeId: 'soul',
      names: ['Lola Remedios Santos'],
      note: 'Lola Remedios Santos',
      submitted: '2026-06-15',
      massDate: '2026-06-21',
      offering: 300,
      status: 'Scheduled',
    },
    {
      type: 'Thanksgiving',
      typeId: 'thanksgiving',
      names: ['For a safe surgery'],
      note: 'For a safe surgery',
      submitted: '2026-06-10',
      massDate: '2026-06-14',
      offering: 250,
      status: 'Completed',
    },
    {
      type: 'Healing',
      typeId: 'healing',
      names: ["Rosa's full recovery", 'Tita Elena Reyes'],
      note: "Rosa's full recovery",
      submitted: '2026-06-18',
      massDate: null,
      offering: 300,
      status: 'Pending',
    },
  ];

  const badgeClass = {
    Pending:   'badge-amber',
    Scheduled: 'badge-green',
    Completed: 'badge-blue',
  };

  const list           = document.getElementById('intentions-list');
  const emptyState      = document.getElementById('intentions-empty');
  const intentionsCount  = document.getElementById('intentions-count');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatShort(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatPeso(n) {
    return '₱' + n.toLocaleString('en-US');
  }

  function typeConfig(id) {
    return intentionTypes.find(t => t.id === id) || intentionTypes[4];
  }

  /* ------------------------------------------
     2. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    document.getElementById('stat-total').textContent =
      myIntentions.length;
    document.getElementById('stat-scheduled').textContent =
      myIntentions.filter(i => i.status === 'Scheduled').length;
    document.getElementById('stat-total-offered').textContent =
      formatPeso(myIntentions.reduce((s, i) => s + i.offering, 0));
  }

  /* ------------------------------------------
     3. RENDER — intentions list
  ------------------------------------------ */
  function renderList() {
    intentionsCount.textContent =
      `${myIntentions.length} intention${myIntentions.length === 1 ? '' : 's'}`;

    if (myIntentions.length === 0) {
      list.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const sorted = myIntentions
      .slice()
      .sort((a, b) => new Date(b.submitted) - new Date(a.submitted));

    list.innerHTML = sorted.map(it => {
      const cfg = typeConfig(it.typeId);
      const realIndex = myIntentions.indexOf(it);
      const names = (it.names && it.names.length) ? it.names : [it.note];
      const namesDisplay = names.length > 1
        ? `${escapeHtml(names[0])} <span class="text-gray-400 font-medium">+${names.length - 1} more</span>`
        : escapeHtml(names[0]);

      return `
        <li>
          <div class="intention-row">
            <div class="intention-icon"
                 style="background-color:${cfg.iconBg};color:${cfg.iconColor};">
              ${cfg.icon}
            </div>
            <div class="intention-info">
              <p class="intention-type">${escapeHtml(it.type)}</p>
              <p class="intention-note">${namesDisplay}</p>
              <div class="intention-meta">
                <span class="intention-date">Submitted ${formatShort(it.submitted)}</span>
                ${it.massDate
                  ? `<span class="intention-mass-date">📅 Mass: ${formatShort(it.massDate)}</span>`
                  : `<span class="badge badge-amber" style="font-size:0.625rem;">Awaiting assignment</span>`}
                <span class="badge ${badgeClass[it.status] || 'badge-gray'}"
                      style="font-size:0.625rem;">${escapeHtml(it.status)}</span>
              </div>
              <button type="button" class="intention-details-btn" data-index="${realIndex}">See Details ›</button>
            </div>
            <div class="intention-offering">${formatPeso(it.offering)}</div>
          </div>
        </li>
      `;
    }).join('');
  }

  list.addEventListener('click', e => {
    const btn = e.target.closest('.intention-details-btn');
    if (!btn) return;
    openDetailsModal(parseInt(btn.dataset.index, 10));
  });

  renderStats();
  renderList();

  /* ------------------------------------------
     4. SUBMIT INTENTION MODAL
  ------------------------------------------ */
  const modal     = document.getElementById('intention-modal');
  const typeGrid   = document.getElementById('intention-type-grid');
  const nameInput    = document.getElementById('mi-name-input');
  const addNameBtn    = document.getElementById('mi-add-name');
  const nameChipsBox   = document.getElementById('mi-name-chips');
  const nameCountLabel  = document.getElementById('mi-name-count');
  const dateInput    = document.getElementById('mi-date');
  const offeringInput = document.getElementById('mi-offering');

  let selectedTypeId = null;
  let intentionNames = [];

  /* ---- Name chip helpers: each added name becomes its own box ---- */
  function renderNameChips() {
    nameChipsBox.innerHTML = intentionNames.map((n, i) => `
      <span class="name-chip" data-index="${i}">
        ${escapeHtml(n)}
        <button type="button" class="name-chip-remove" data-index="${i}" aria-label="Remove ${escapeHtml(n)}">×</button>
      </span>
    `).join('');

    if (intentionNames.length > 0) {
      nameCountLabel.textContent = intentionNames.length;
      nameCountLabel.classList.remove('hidden');
    } else {
      nameCountLabel.classList.add('hidden');
    }
  }

  function addName() {
    const val = nameInput.value.trim();
    if (!val) return;
    intentionNames.push(val);
    nameInput.value = '';
    nameInput.classList.remove('border-red-400');
    renderNameChips();
    nameInput.focus();
  }

  addNameBtn.addEventListener('click', addName);

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addName();
    }
  });

  nameChipsBox.addEventListener('click', e => {
    const btn = e.target.closest('.name-chip-remove');
    if (!btn) return;
    intentionNames.splice(parseInt(btn.dataset.index, 10), 1);
    renderNameChips();
  });

  // Render type selector buttons
  typeGrid.innerHTML = intentionTypes.map(t => `
    <button type="button" class="intention-type-btn" data-type-id="${t.id}">
      <div class="intention-type-btn-icon"
           style="background-color:${t.iconBg};color:${t.iconColor};">
        ${t.icon}
      </div>
      <span class="intention-type-btn-label">${t.label}</span>
    </button>
  `).join('');

  typeGrid.addEventListener('click', e => {
    const btn = e.target.closest('.intention-type-btn');
    if (!btn) return;
    document.querySelectorAll('.intention-type-btn')
      .forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTypeId = btn.dataset.typeId;
  });

  function openModal() {
    selectedTypeId = null;
    intentionNames = [];
    document.querySelectorAll('.intention-type-btn')
      .forEach(b => b.classList.remove('selected'));
    nameInput.value = '';
    renderNameChips();
    dateInput.value = '';
    offeringInput.value = '';
    showModal(modal);
  }

  function closeModal() {
    hideModal(modal);
  }

  document.getElementById('btn-submit-intention').addEventListener('click', openModal);
  document.getElementById('btn-empty-submit')?.addEventListener('click', openModal);

  /* ---- Generic modal open/close (shared by Submit + Details modals) ---- */
  function showModal(el) {
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideModal(el) {
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.modal-overlay').forEach(overlayEl => {
    overlayEl.addEventListener('click', e => {
      if (e.target === overlayEl) hideModal(overlayEl);
    });
    overlayEl.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => hideModal(overlayEl));
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(hideModal);
    }
  });

  /* Submit handler */
  document.getElementById('mi-submit').addEventListener('click', () => {
    // If the person typed a name but forgot to hit Add/Enter, add it for them.
    if (nameInput.value.trim()) addName();

    const offering = parseInt(offeringInput.value, 10);

    if (!selectedTypeId) {
      window.showToast('Please select an intention type.', true);
      return;
    }
    if (intentionNames.length === 0) {
      nameInput.classList.add('border-red-400');
      nameInput.addEventListener('input', () => nameInput.classList.remove('border-red-400'), { once: true });
      window.showToast('Please add at least one name.', true);
      return;
    }
    if (!offering || offering <= 0) {
      offeringInput.classList.add('border-red-400');
      offeringInput.addEventListener('input', () => offeringInput.classList.remove('border-red-400'), { once: true });
      window.showToast('Please enter an offering amount.', true);
      return;
    }

    const cfg = typeConfig(selectedTypeId);
    const names = intentionNames.slice();

    myIntentions.unshift({
      type: cfg.label,
      typeId: selectedTypeId,
      names,
      note: names[0],
      submitted: TODAY_ISO,
      massDate: dateInput.value || null,
      offering,
      status: 'Pending',
    });

    renderStats();
    renderList();
    closeModal();
    window.showToast(
      `Mass intention submitted — ${cfg.label} for ${names.length} name${names.length === 1 ? '' : 's'}.`
    );
  });

  /* ------------------------------------------
     5. INTENTION DETAILS MODAL
  ------------------------------------------ */
  const detailsModal = document.getElementById('details-modal');
  const detailsBody   = document.getElementById('details-body');

  function openDetailsModal(idx) {
    const it = myIntentions[idx];
    if (!it) return;
    const cfg = typeConfig(it.typeId);
    const names = (it.names && it.names.length) ? it.names : [it.note];

    detailsBody.innerHTML = `
      <div class="details-header-row">
        <div class="intention-icon" style="background-color:${cfg.iconBg};color:${cfg.iconColor};">
          ${cfg.icon}
        </div>
        <div>
          <p class="intention-type">${escapeHtml(it.type)}</p>
          <span class="badge ${badgeClass[it.status] || 'badge-gray'}" style="font-size:0.625rem;">${escapeHtml(it.status)}</span>
        </div>
      </div>

      <div>
        <p class="details-label">Name${names.length === 1 ? '' : 's'} (${names.length})</p>
        <div class="name-chip-list">
          ${names.map(n => `<span class="name-chip">${escapeHtml(n)}</span>`).join('')}
        </div>
      </div>

      <div class="details-grid">
        <div>
          <p class="details-label">Submitted</p>
          <p class="details-value">${formatShort(it.submitted)}</p>
        </div>
        <div>
          <p class="details-label">Mass Date</p>
          <p class="details-value">${it.massDate ? formatShort(it.massDate) : 'Awaiting assignment'}</p>
        </div>
      </div>

      <div>
        <p class="details-label">Offering</p>
        <p class="details-value text-green-700">${formatPeso(it.offering)}</p>
      </div>
    `;

    showModal(detailsModal);
  }

});