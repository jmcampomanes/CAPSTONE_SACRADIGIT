/* ============================================
   SacraDigit Admin — Schedule Offers Scripts
   (schedule-offers.js)
   Runs after dashboard.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  const TODAY_ISO = '2026-06-19';

  /* ------------------------------------------
     0. SAMPLE DATA
  ------------------------------------------ */
  let offers = [
    {
      requester: 'Santos Family',
      service: 'Baptism',
      preferredDate: '2026-07-05',
      submitted: '2026-06-15',
      contact: '09171234567',
      status: 'Approved',
      confirmedDate: '2026-07-05',
      confirmedTime: '10:00 AM',
      officiant: 'Fr. Mark D.',
      details: { "Child's Name": 'Juan Santos Jr.', "Parents": 'Juan & Maria Santos' },
      notes: '',
    },
    {
      requester: 'Dela Cruz, Ana',
      service: 'Wedding',
      preferredDate: '2026-08-14',
      submitted: '2026-06-18',
      contact: '09281234567',
      status: 'Pending',
      confirmedDate: null,
      confirmedTime: null,
      officiant: '',
      details: { "Groom": 'Juan Dela Cruz', "Bride": 'Ana Reyes' },
      notes: '',
    },
    {
      requester: 'Garcia Family',
      service: 'Funeral Mass',
      preferredDate: '2026-06-22',
      submitted: '2026-06-19',
      contact: '09351234567',
      status: 'Pending',
      confirmedDate: null,
      confirmedTime: null,
      officiant: '',
      details: { "Deceased": 'Pedro M. Garcia', "Relationship": 'Son' },
      notes: '',
    },
    {
      requester: 'Villanueva, Rosa',
      service: 'House Blessing',
      preferredDate: '2026-06-28',
      submitted: '2026-06-10',
      contact: '09171112233',
      status: 'Approved',
      confirmedDate: '2026-06-28',
      confirmedTime: '09:00 AM',
      officiant: 'Fr. Mark D.',
      details: { "Address": '42 Maligaya St., Cubao', "Owner": 'Villanueva Family' },
      notes: 'Please arrive 30 minutes early.',
    },
    {
      requester: 'Bautista, Carlo',
      service: 'Vehicle / Item Blessing',
      preferredDate: '2026-06-21',
      submitted: '2026-06-08',
      contact: '09501234567',
      status: 'Completed',
      confirmedDate: '2026-06-21',
      confirmedTime: '11:00 AM',
      officiant: 'Fr. Mark D.',
      details: { "Vehicle": '2024 Toyota Fortuner — ABC 123', "Owner": 'Carlo Bautista' },
      notes: '',
    },
    {
      requester: 'Reyes, Carmen',
      service: 'First Communion',
      preferredDate: '2026-07-12',
      submitted: '2026-06-17',
      contact: '09221234567',
      status: 'Pending',
      confirmedDate: null,
      confirmedTime: null,
      officiant: '',
      details: { "Child": 'Sofia Reyes', "Parents": 'Carmen & Jose Reyes' },
      notes: '',
    },
    {
      requester: 'Torres, Manuel',
      service: 'Business Dedication',
      preferredDate: '2026-07-01',
      submitted: '2026-06-12',
      contact: '09171239999',
      status: 'Rejected',
      confirmedDate: null,
      confirmedTime: null,
      officiant: '',
      details: { "Business": 'Torres Hardware', "Address": '10 Aurora Blvd., Cubao' },
      notes: 'Date unavailable. Please re-submit with a new preferred date.',
    },
    {
      requester: 'Mendoza, Elena',
      service: 'Anniversary Mass',
      preferredDate: '2026-07-20',
      submitted: '2026-06-16',
      contact: '09281112233',
      status: 'Pending',
      confirmedDate: null,
      confirmedTime: null,
      officiant: '',
      details: { "Couple": 'Jose & Elena Mendoza', "Years": '25 years' },
      notes: '',
    },
  ];

  const badgeClass = {
    Pending:   'badge-amber',
    Approved:  'badge-green',
    Rejected:  'badge-red',
    Completed: 'badge-blue',
  };

  const tbody       = document.getElementById('offers-tbody');
  const offersEmpty  = document.getElementById('offers-empty');
  const resultsCount  = document.getElementById('results-count');
  const searchInput   = document.getElementById('search-input');
  const typeFilter     = document.getElementById('type-filter');
  const statusFilter    = document.getElementById('status-filter');

  function escapeHtml(str) {
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function setFieldError(input, message) {
    input.classList.add('has-error');
    let msg = input.parentElement.querySelector('.form-error-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'form-error-msg';
      input.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = message;
  }

  function clearFieldError(input) {
    input.classList.remove('has-error');
    const msg = input.parentElement.querySelector('.form-error-msg');
    if (msg) msg.remove();
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    const weekStart = new Date(TODAY_ISO + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekCount = offers.filter(o => {
      if (!o.confirmedDate) return false;
      const d = new Date(o.confirmedDate + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    }).length;

    document.getElementById('stat-total').textContent    = offers.length;
    document.getElementById('stat-pending').textContent  = offers.filter(o => o.status === 'Pending').length;
    document.getElementById('stat-approved').textContent = offers.filter(o => o.status === 'Approved').length;
    document.getElementById('stat-week').textContent     = weekCount;

    updateActiveStatCard();
  }

  /* ------------------------------------------
     1b. STAT CARDS AS QUICK FILTERS
     Total clears the status filter; Pending /
     Approved set it and jump straight to the
     matching rows. "This Week" isn't a status,
     so it stays informational only.
  ------------------------------------------ */
  const statCardTotal    = document.getElementById('stat-total').closest('.stat-card');
  const statCardPending  = document.getElementById('stat-pending').closest('.stat-card');
  const statCardApproved = document.getElementById('stat-approved').closest('.stat-card');

  const statCardsByStatus = [
    { card: statCardTotal,    status: '' },
    { card: statCardPending,  status: 'Pending' },
    { card: statCardApproved, status: 'Approved' },
  ];

  statCardsByStatus.forEach(({ card, status }) => {
    card.classList.add('stat-card-clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => {
      statusFilter.value = status;
      renderTable();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        statusFilter.value = status;
        renderTable();
      }
    });
  });

  function updateActiveStatCard() {
    statCardsByStatus.forEach(({ card, status }) => {
      card.classList.toggle('stat-card-active', statusFilter.value === status);
    });
  }


  /* ------------------------------------------
     2. RENDER TABLE
  ------------------------------------------ */
  function renderTable() {
    const query     = searchInput.value.trim().toLowerCase();
    const typeVal    = typeFilter.value;
    const statusVal   = statusFilter.value;

    updateActiveStatCard();

    const filtered = offers.filter(o => {
      const matchQuery  = !query || o.requester.toLowerCase().includes(query) || o.service.toLowerCase().includes(query);
      const matchType    = !typeVal   || o.service === typeVal;
      const matchStatus  = !statusVal || o.status  === statusVal;
      return matchQuery && matchType && matchStatus;
    });

    resultsCount.textContent = `${filtered.length} request${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      offersEmpty.classList.remove('hidden');
      return;
    }
    offersEmpty.classList.add('hidden');

    tbody.innerHTML = filtered.map(o => {
      const realIdx = offers.indexOf(o);

      let actionsHtml = '';
      if (o.status === 'Pending') {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-approve" data-index="${realIdx}">Approve</button>
            <button type="button" class="row-reject"  data-index="${realIdx}">Decline</button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="row-actions">
            <button type="button" class="row-view" data-index="${realIdx}">View ›</button>
          </div>`;
      }

      return `
        <tr>
          <td class="font-medium text-gray-900">${escapeHtml(o.requester)}</td>
          <td>
            <span class="service-type-tag">${escapeHtml(o.service)}</span>
          </td>
          <td>
            ${fmtDate(o.preferredDate)}
            ${o.confirmedDate && o.confirmedDate !== o.preferredDate
              ? `<span class="confirmed-chip">→ ${fmtDate(o.confirmedDate)}</span>` : ''}
          </td>
          <td class="text-gray-400">${fmtDate(o.submitted)}</td>
          <td><span class="badge ${badgeClass[o.status] || 'badge-gray'}">${escapeHtml(o.status)}</span></td>
          <td class="text-right">${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  }

  // Wire filters
  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);
  statusFilter.addEventListener('change', renderTable);
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value   = '';
    statusFilter.value  = '';
    renderTable();
  });

  // Delegate row actions
  tbody.addEventListener('click', e => {
    const approveBtn = e.target.closest('.row-approve');
    const rejectBtn   = e.target.closest('.row-reject');
    const viewBtn      = e.target.closest('.row-view');

    if (approveBtn) openAssignModal(parseInt(approveBtn.dataset.index, 10));
    if (rejectBtn)  openRejectModal(parseInt(rejectBtn.dataset.index, 10));
    if (viewBtn)    openViewModal(parseInt(viewBtn.dataset.index, 10));
  });

  renderStats();
  renderTable();


  /* ------------------------------------------
     3. ASSIGN (APPROVE) MODAL
  ------------------------------------------ */
  const assignModal     = document.getElementById('assign-modal');
  const assignName       = document.getElementById('assign-name');
  const assignService     = document.getElementById('assign-service');
  const assignDetailGrid  = document.getElementById('assign-detail-grid');
  const assignDateInput    = document.getElementById('assign-date');
  const assignTimeInput     = document.getElementById('assign-time');
  const assignOfficiantInput = document.getElementById('assign-officiant');
  const assignNoteInput      = document.getElementById('assign-note');

  let assignTargetIndex = null;

  function openAssignModal(idx) {
    assignTargetIndex = idx;
    const o = offers[idx];

    assignName.textContent    = o.requester;
    assignService.textContent  = o.service;
    assignDateInput.value      = o.preferredDate || '';
    assignTimeInput.value       = '';
    assignOfficiantInput.value   = '';
    assignNoteInput.value         = '';
    [assignDateInput, assignTimeInput].forEach(clearFieldError);

    // Show request details in the gray box
    assignDetailGrid.innerHTML = Object.entries(o.details).map(([label, value]) => `
      <div>
        <p class="so-detail-label">${escapeHtml(label)}</p>
        <p class="so-detail-value">${escapeHtml(value)}</p>
      </div>
    `).join('') + `
      <div>
        <p class="so-detail-label">Preferred Date</p>
        <p class="so-detail-value">${fmtDate(o.preferredDate)}</p>
      </div>
      <div>
        <p class="so-detail-label">Contact</p>
        <p class="so-detail-value">${escapeHtml(o.contact)}</p>
      </div>
    `;

    openModal(assignModal);
  }

  [assignDateInput, assignTimeInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
    input.addEventListener('change', () => clearFieldError(input));
  });

  document.getElementById('assign-submit').addEventListener('click', () => {
    if (assignTargetIndex === null) return;

    const date      = assignDateInput.value;
    const time24     = assignTimeInput.value;
    const officiant   = assignOfficiantInput.value.trim();
    const note         = assignNoteInput.value.trim();

    [assignDateInput, assignTimeInput].forEach(clearFieldError);

    let hasError = false;
    if (!date)   { setFieldError(assignDateInput, 'Confirmed date is required.'); hasError = true; }
    if (!time24) { setFieldError(assignTimeInput, 'Confirmed time is required.'); hasError = true; }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    const o = offers[assignTargetIndex];
    o.status         = 'Approved';
    o.confirmedDate   = date;
    o.confirmedTime    = formatTime12(time24);
    o.officiant         = officiant;
    o.notes              = note;

    renderStats();
    renderTable();
    closeModal(assignModal);
    showToast(`${o.service} for ${o.requester} approved — ${fmtDate(date)} at ${o.confirmedTime}.`);
    assignTargetIndex = null;
  });


  /* ------------------------------------------
     4. REJECT MODAL
  ------------------------------------------ */
  const rejectModal  = document.getElementById('reject-modal');
  const rejectName    = document.getElementById('reject-name');
  const rejectReason   = document.getElementById('reject-reason');
  let rejectTargetIndex = null;

  function openRejectModal(idx) {
    rejectTargetIndex = idx;
    rejectName.textContent = offers[idx].requester;
    rejectReason.value      = '';
    clearFieldError(rejectReason);
    openModal(rejectModal);
  }

  rejectReason.addEventListener('input', () => clearFieldError(rejectReason));

  document.getElementById('reject-submit').addEventListener('click', () => {
    if (rejectTargetIndex === null) return;
    const reason = rejectReason.value.trim();
    if (!reason) {
      setFieldError(rejectReason, 'Please provide a reason for declining.');
      showToast('Please fix the highlighted fields.', true);
      return;
    }
    clearFieldError(rejectReason);

    const o = offers[rejectTargetIndex];
    o.status = 'Rejected';
    o.notes   = reason;

    renderStats();
    renderTable();
    closeModal(rejectModal);
    showToast(`Request from ${o.requester} declined.`);
    rejectTargetIndex = null;
  });


  /* ------------------------------------------
     5. VIEW DETAILS MODAL (non-pending rows)
  ------------------------------------------ */
  const viewModal          = document.getElementById('view-modal');
  const viewName             = document.getElementById('view-name');
  const viewStatusBadge       = document.getElementById('view-status-badge');
  const viewDetailGrid          = document.getElementById('view-detail-grid');
  const viewScheduleWrap           = document.getElementById('view-schedule-wrap');
  const viewScheduleValue             = document.getElementById('view-schedule-value');
  const viewNotesWrap                    = document.getElementById('view-notes-wrap');
  const viewNotes                           = document.getElementById('view-notes');

  function openViewModal(idx) {
    const o = offers[idx];

    viewName.textContent = o.requester;
    viewStatusBadge.textContent = o.status;
    viewStatusBadge.className = `badge ${badgeClass[o.status] || 'badge-gray'}`;

    viewDetailGrid.innerHTML = Object.entries(o.details).map(([label, value]) => `
      <div>
        <p class="so-detail-label">${escapeHtml(label)}</p>
        <p class="so-detail-value">${escapeHtml(value)}</p>
      </div>
    `).join('') + `
      <div>
        <p class="so-detail-label">Service Type</p>
        <p class="so-detail-value">${escapeHtml(o.service)}</p>
      </div>
      <div>
        <p class="so-detail-label">Preferred Date</p>
        <p class="so-detail-value">${fmtDate(o.preferredDate)}</p>
      </div>
      <div>
        <p class="so-detail-label">Submitted</p>
        <p class="so-detail-value">${fmtDate(o.submitted)}</p>
      </div>
      <div>
        <p class="so-detail-label">Contact</p>
        <p class="so-detail-value">${escapeHtml(o.contact)}</p>
      </div>
    `;

    if (o.confirmedDate) {
      viewScheduleValue.textContent = `${fmtDate(o.confirmedDate)} at ${o.confirmedTime}${o.officiant ? ` — ${o.officiant}` : ''}`;
      viewScheduleWrap.classList.remove('hidden');
    } else {
      viewScheduleWrap.classList.add('hidden');
    }

    if (o.notes) {
      viewNotes.textContent = o.notes;
      viewNotesWrap.classList.remove('hidden');
    } else {
      viewNotesWrap.classList.add('hidden');
    }

    openModal(viewModal);
  }


  /* ------------------------------------------
     6. MODAL HELPERS
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(assignModal);
      closeModal(rejectModal);
      closeModal(viewModal);
    });
  });

  [assignModal, rejectModal, viewModal].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal(assignModal);
      closeModal(rejectModal);
      closeModal(viewModal);
    }
  });

  function openModal(m) {
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(m) {
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function formatTime12(t24) {
    let [h, m] = t24.split(':').map(Number);
    const mer = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`;
  }


  /* ------------------------------------------
     7. TOAST
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