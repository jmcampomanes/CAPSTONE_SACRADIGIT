/* ============================================
   SacraDigit — User My Requests Scripts
   (user-my-requests.js)
   Runs after user-shell.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. DATA
     statusLevel maps status to a step index
     for the progress tracker (0-based).
     Steps: Submitted → Under Review → Approved → Ready → Released
  ------------------------------------------ */
  const STEPS = ['Submitted', 'Under Review', 'Approved', 'Ready for Pick-up', 'Released'];

  const requests = [
    {
      type: 'Baptismal Certificate',
      purpose: 'School enrollment',
      submitted: '2026-06-15',
      status: 'Approved',
      stepIndex: 2,
      details: { 'Baptized Name': 'Maria P. Santos', 'Approx. Date': 'Mar 12, 1995', 'Requested by': 'Maria P. Santos' },
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
    },
    {
      type: 'Confirmation Certificate',
      purpose: 'Employment requirement',
      submitted: '2026-06-10',
      status: 'Pending',
      stepIndex: 0,
      details: { 'Confirmed Name': 'Maria P. Santos', 'Approx. Date': 'Jun 5, 2007', 'Requested by': 'Maria P. Santos' },
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
    },
    {
      type: 'Marriage Certificate',
      purpose: 'Visa application',
      submitted: '2026-05-20',
      status: 'Released',
      stepIndex: 4,
      details: { 'Groom': 'Juan Dela Cruz', 'Bride': 'Maria P. Santos', 'Date of Marriage': 'Feb 14, 2020' },
      iconBg: 'rgba(239,68,68,0.1)', iconColor: '#dc2626',
    },
    {
      type: 'Baptismal Certificate',
      purpose: 'Confirmation sponsor',
      submitted: '2026-04-08',
      status: 'Rejected',
      stepIndex: -1,
      rejectionReason: 'Name on record does not match the name submitted. Please visit the parish office to verify.',
      details: { 'Baptized Name': 'Maria Santos', 'Approx. Date': 'Unknown', 'Requested by': 'Maria P. Santos' },
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
    },
    {
      type: 'Death Certificate',
      purpose: 'Estate settlement',
      submitted: '2026-06-18',
      status: 'Ready for Pick-up',
      stepIndex: 3,
      details: { 'Deceased': 'Pedro M. Santos', 'Approx. Date': 'Jun 1, 2026', 'Relationship': 'Daughter' },
      iconBg: 'rgba(107,114,128,0.12)', iconColor: '#6b7280',
    },
  ];

  const badgeClass = {
    'Pending':           'badge-amber',
    'Under Review':      'badge-blue',
    'Approved':          'badge-green',
    'Ready for Pick-up': 'badge-green',
    'Released':          'badge-gray',
    'Rejected':          'badge-red',
  };

  const filterMap = {
    'Pending':  ['Pending', 'Under Review'],
    'Approved': ['Approved'],
    'Ready':    ['Ready for Pick-up'],
    'Released': ['Released'],
    'Rejected': ['Rejected'],
  };

  let activeFilter = 'All';

  const list          = document.getElementById('requests-list');
  const emptyState     = document.getElementById('requests-empty');
  const detailModal    = document.getElementById('detail-modal');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatShortDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    document.getElementById('stat-total').textContent   = requests.length;
    document.getElementById('stat-pending').textContent = requests.filter(r => r.status === 'Pending' || r.status === 'Under Review').length;
    document.getElementById('stat-ready').textContent   = requests.filter(r => r.status === 'Ready for Pick-up').length;
  }


  /* ------------------------------------------
     2. RENDER — request cards
  ------------------------------------------ */
  function renderList() {
    const filtered = activeFilter === 'All'
      ? requests
      : requests.filter(r => (filterMap[activeFilter] || [activeFilter]).includes(r.status));

    list.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    filtered.forEach((r, localIdx) => {
      const realIndex = requests.indexOf(r);
      const isRejected = r.status === 'Rejected';

      // Build step dots
      const stepDotsHtml = STEPS.map((step, i) => {
        let cls = '';
        if (isRejected) {
          cls = i === 0 ? 'done' : i === 1 ? 'rejected' : '';
        } else {
          if (i < r.stepIndex) cls = 'done';
          else if (i === r.stepIndex) cls = 'current';
        }
        return `
          <div class="req-step ${cls}">
            <div class="req-step-dot"></div>
            <span class="req-step-label">${step.replace(' for Pick-up', '')}</span>
          </div>
        `;
      }).join('');

      const card = document.createElement('div');
      card.className = 'req-card';
      card.innerHTML = `
        <div class="req-card-icon" style="background-color:${r.iconBg};color:${r.iconColor};">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <div class="req-card-body">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p class="req-card-title">${escapeHtml(r.type)}</p>
              <p class="req-card-meta">Submitted ${formatShortDate(r.submitted)}</p>
              <p class="req-card-purpose">${escapeHtml(r.purpose)}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="badge ${badgeClass[r.status] || 'badge-gray'}">${escapeHtml(r.status)}</span>
            </div>
          </div>
          <div class="req-progress-wrap">
            <div class="req-progress-steps">${stepDotsHtml}</div>
          </div>
        </div>
        <div class="req-card-actions">
          <button type="button" class="btn-view-details" data-index="${realIndex}">Details</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // Delegate "Details" button
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-details');
    if (btn) openDetail(parseInt(btn.dataset.index, 10));
  });

  renderStats();
  renderList();


  /* ------------------------------------------
     3. STATUS FILTER TABS
  ------------------------------------------ */
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.status-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeFilter = tab.dataset.filter;
      renderList();
    });
  });


  /* ------------------------------------------
     4. DETAIL MODAL
  ------------------------------------------ */
  function openDetail(idx) {
    const r = requests[idx];
    const isRejected = r.status === 'Rejected';

    document.getElementById('modal-title').textContent    = r.type;
    document.getElementById('modal-date').textContent     = `Submitted ${formatShortDate(r.submitted)}`;

    const statusBadge = document.getElementById('modal-status-badge');
    statusBadge.textContent  = r.status;
    statusBadge.className     = `badge ${badgeClass[r.status] || 'badge-gray'}`;

    // Detail grid
    const detailGrid = document.getElementById('modal-details');
    detailGrid.innerHTML = Object.entries(r.details).map(([label, value]) => `
      <div>
        <p class="modal-detail-item-label">${escapeHtml(label)}</p>
        <p class="modal-detail-item-value">${escapeHtml(value)}</p>
      </div>
    `).join('');

    // Purpose
    const purposeWrap = document.getElementById('modal-purpose-wrap');
    if (r.purpose) {
      purposeWrap.classList.remove('hidden');
      document.getElementById('modal-purpose').textContent = r.purpose;
    } else {
      purposeWrap.classList.add('hidden');
    }

    // Rejection reason
    const rejWrap = document.getElementById('modal-rejection-wrap');
    if (isRejected && r.rejectionReason) {
      rejWrap.classList.remove('hidden');
      document.getElementById('modal-rejection').textContent = r.rejectionReason;
    } else {
      rejWrap.classList.add('hidden');
    }

    // Timeline
    const timeline = document.getElementById('modal-timeline');
    timeline.innerHTML = STEPS.map((step, i) => {
      let cls = '';
      let sub = '';

      if (isRejected) {
        if (i === 0)      { cls = 'done';     sub = formatShortDate(r.submitted); }
        else if (i === 1) { cls = 'rejected'; sub = 'Request rejected'; }
        else               { cls = '';         sub = ''; }
      } else {
        if (i < r.stepIndex)       { cls = 'done';    sub = 'Completed'; }
        else if (i === r.stepIndex) { cls = 'current'; sub = 'Current status'; }
        else                        { cls = '';         sub = 'Pending'; }

        if (i === 0) sub = formatShortDate(r.submitted);
      }

      return `
        <div class="req-timeline-step ${cls}">
          <div class="req-timeline-dot">
            ${cls === 'done' ? '<svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ''}
          </div>
          <div class="req-timeline-content">
            <p class="req-timeline-label">${step}</p>
            ${sub ? `<p class="req-timeline-sub">${sub}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');

    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeDetail);
  });

  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });

});