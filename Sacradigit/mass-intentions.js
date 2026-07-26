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

    logCount.textContent = `${sorted.length} intention${sorted.length === 1 ? '' : 's'}`;

    if (sorted.length === 0) {
      tbody.innerHTML = '';
      intentionsEmpty.classList.remove('hidden');
      return;
    }
    intentionsEmpty.classList.add('hidden');

    tbody.innerHTML = sorted.map((it) => {
      const realIndex = intentions.indexOf(it);
      const massDateLabel = it.massDate
        ? `${formatShortDate(it.massDate)}${it.massTime ? ' · ' + it.massTime : ''}`
        : '—';

      let actionHtml = '';
      if (it.status === 'Pending') {
        actionHtml = `<button type="button" class="row-assign" data-index="${realIndex}">Assign Mass ›</button>`;
      } else {
        actionHtml = `<button type="button" class="row-action" data-index="${realIndex}">View ›</button>`;
      }

      return `
        <tr>
          <td class="font-medium text-gray-900">${escapeHtml(it.donor)}</td>
          <td>
            ${escapeHtml(it.type)}
            ${it.note ? `<div class="text-xs text-gray-400 mt-0.5">${escapeHtml(it.note)}</div>` : ''}
          </td>
          <td>${massDateLabel}</td>
          <td class="offering-amount">${formatPeso(it.offering)}</td>
          <td><span class="badge ${badgeClass[it.status] || 'badge-gray'}">${escapeHtml(it.status)}</span></td>
          <td class="text-right">${actionHtml}</td>
        </tr>
      `;
    }).join('');
  }

  tbody.addEventListener('click', (e) => {
    const assignBtn = e.target.closest('.row-assign');
    const viewBtn    = e.target.closest('.row-action');

    if (assignBtn) {
      const idx = parseInt(assignBtn.dataset.index, 10);
      openAssignModal(idx);
    }

    if (viewBtn) {
      const idx = parseInt(viewBtn.dataset.index, 10);
      const it = intentions[idx];
      const massInfo = it.massDate ? ` Assigned to ${formatShortDate(it.massDate)} ${it.massTime || ''}.` : '';
      showToast(`${it.donor} — ${it.type} (${it.status}).${massInfo}`);
    }
  });

  renderStats();
  renderTable();


  /* ------------------------------------------
     3. ADD INTENTION MODAL
  ------------------------------------------ */
  const addModal = document.getElementById('add-modal');

  document.getElementById('btn-add-intention').addEventListener('click', () => openModal(addModal));

  document.getElementById('add-submit').addEventListener('click', () => {
    const donor    = document.getElementById('add-donor').value.trim();
    const type      = document.getElementById('add-type').value;
    const note       = document.getElementById('add-note').value.trim();
    const offering    = parseInt(document.getElementById('add-offering').value, 10);

    if (!donor || !type || !offering) {
      showToast('Please fill in donor name, intention type, and offering amount.', true);
      return;
    }

    intentions.unshift({
      donor,
      type,
      note,
      submittedDate: TODAY_ISO,
      massDate: null,
      massTime: null,
      offering,
      status: 'Pending',
    });

    renderStats();
    renderTable();
    closeModal(addModal);
    showToast(`Intention logged for ${donor}.`);

    // Reset form
    document.getElementById('add-donor').value = '';
    document.getElementById('add-type').value = '';
    document.getElementById('add-note').value = '';
    document.getElementById('add-offering').value = '';
  });


  /* ------------------------------------------
     4. ASSIGN MASS DATE MODAL
  ------------------------------------------ */
  const assignModal = document.getElementById('assign-modal');
  const assignTargetName = document.getElementById('assign-target-name');
  let assignTargetIndex = null;

  function openAssignModal(idx) {
    assignTargetIndex = idx;
    assignTargetName.textContent = intentions[idx].donor;
    document.getElementById('assign-date').value = '';
    document.getElementById('assign-time').value = '';
    openModal(assignModal);
  }

  document.getElementById('assign-submit').addEventListener('click', () => {
    if (assignTargetIndex === null) return;

    const date    = document.getElementById('assign-date').value;
    const time24   = document.getElementById('assign-time').value;

    if (!date || !time24) {
      showToast('Please select a mass date and time.', true);
      return;
    }

    intentions[assignTargetIndex].massDate = date;
    intentions[assignTargetIndex].massTime = formatTime12(time24);
    intentions[assignTargetIndex].status = 'Scheduled';

    renderStats();
    renderTable();
    closeModal(assignModal);
    showToast(`${intentions[assignTargetIndex].donor}'s intention assigned to ${formatShortDate(date)}.`);

    assignTargetIndex = null;
  });

  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* ------------------------------------------
     5. MODAL HELPERS (shared open/close/escape)
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(addModal);
      closeModal(assignModal);
    });
  });

  [addModal, assignModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(addModal);
      closeModal(assignModal);
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
     6. PRINT INTENTIONS
  ------------------------------------------ */
  document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
  });


  /* ------------------------------------------
     7. TOAST NOTIFICATIONS
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});