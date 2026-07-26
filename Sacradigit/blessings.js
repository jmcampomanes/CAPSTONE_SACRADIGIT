/* ============================================
   SacraDigit Admin — Blessings Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" fixed to match the rest of the app.
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  let upcoming = [
    { requester: 'Santos Family',     type: 'House Blessing',      location: '42 Maligaya St., Cubao', date: '2026-06-20', time: '09:00 AM' },
    { requester: 'Reyes Bakery',      type: 'Business Dedication', location: 'Aurora Blvd. corner 8th',  date: '2026-06-21', time: '02:00 PM' },
    { requester: 'Cruz, Jose R.',     type: 'Vehicle Blessing',    location: 'Parish grounds',           date: '2026-06-22', time: '10:30 AM' },
    { requester: 'Villanueva Family', type: 'House Blessing',      location: '15 Sampaguita St.',        date: '2026-06-25', time: '04:00 PM' },
  ];

  let requests = [
    { requester: 'Garcia, Pedro M.',  type: 'House Blessing',      requestedDate: '2026-06-18', preferredDate: '2026-06-28' },
    { requester: 'Fernandez Eatery',  type: 'Business Dedication', requestedDate: '2026-06-17', preferredDate: '2026-06-30' },
    { requester: 'Mendoza, Carmen P.', type: 'Vehicle Blessing',    requestedDate: '2026-06-16', preferredDate: '2026-07-02' },
  ];

  const completed = [
    { requester: 'Bautista Family',   type: 'House Blessing',      date: '2026-05-28' },
    { requester: 'Ramos Auto Shop',   type: 'Business Dedication', date: '2026-05-24' },
    { requester: 'Dela Cruz, Juan P.', type: 'Vehicle Blessing',    date: '2026-05-19' },
    { requester: 'Torres Family',     type: 'House Blessing',      date: '2026-05-12' },
    { requester: 'Aquino Bakeshop',   type: 'Business Dedication', date: '2026-05-06' },
  ];

  const upcomingList   = document.getElementById('upcoming-list');
  const upcomingEmpty   = document.getElementById('upcoming-empty');
  const upcomingCount   = document.getElementById('upcoming-count');
  const requestsList    = document.getElementById('requests-list');
  const requestsEmpty    = document.getElementById('requests-empty');
  const requestsCount    = document.getElementById('requests-count');
  const completedList    = document.getElementById('completed-list');
  const completedCount    = document.getElementById('completed-count');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatLongDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function blessingIconSvg() {
    return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
  }


  /* ------------------------------------------
     1. STAT BOXES
  ------------------------------------------ */
  function renderStats() {
    document.getElementById('stat-scheduled').textContent = upcoming.length;
    document.getElementById('stat-pending').textContent   = requests.length;
  }


  /* ------------------------------------------
     2. RENDER — Upcoming Blessings
  ------------------------------------------ */
  function renderUpcoming() {
    const sorted = upcoming.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

    upcomingCount.textContent = `${sorted.length} scheduled`;

    if (sorted.length === 0) {
      upcomingList.innerHTML = '';
      upcomingEmpty.classList.remove('hidden');
      return;
    }
    upcomingEmpty.classList.add('hidden');

    upcomingList.innerHTML = sorted.map(b => `
      <li>
        <div class="blessing-row">
          <div class="blessing-icon">${blessingIconSvg()}</div>
          <div class="blessing-info">
            <p class="blessing-name">${escapeHtml(b.requester)}</p>
            <p class="blessing-meta">${escapeHtml(b.type)} · ${escapeHtml(b.location)}</p>
          </div>
          <div class="blessing-datetime">
            ${formatLongDate(b.date)}<br/>${escapeHtml(b.time)}
          </div>
        </div>
      </li>
    `).join('');
  }


  /* ------------------------------------------
     3. RENDER — New Blessing Requests
  ------------------------------------------ */
  function renderRequests() {
    requestsCount.textContent = `${requests.length} pending`;

    if (requests.length === 0) {
      requestsList.innerHTML = '';
      requestsEmpty.classList.remove('hidden');
      return;
    }
    requestsEmpty.classList.add('hidden');

    requestsList.innerHTML = requests.map((r, idx) => `
      <li>
        <div class="request-row">
          <div class="request-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="request-info">
            <p class="request-name">${escapeHtml(r.requester)}</p>
            <p class="request-meta">${escapeHtml(r.type)} · requested for ${formatLongDate(r.preferredDate)}</p>
          </div>
          <div class="request-actions">
            <button type="button" class="req-approve" data-index="${idx}">Approve</button>
            <button type="button" class="req-decline" data-index="${idx}">Decline</button>
          </div>
        </div>
      </li>
    `).join('');
  }

  requestsList.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('.req-approve');
    const declineBtn = e.target.closest('.req-decline');

    if (approveBtn) {
      const idx = parseInt(approveBtn.dataset.index, 10);
      approveRequest(idx);
    }

    if (declineBtn) {
      const idx = parseInt(declineBtn.dataset.index, 10);
      openDeclineModal(idx);
    }
  });

  function approveRequest(idx) {
    const r = requests[idx];

    // Move into the upcoming schedule (default to 9:00 AM unless rescheduled later)
    upcoming.push({
      requester: r.requester,
      type: r.type,
      location: 'To be confirmed',
      date: r.preferredDate,
      time: '09:00 AM',
    });

    requests.splice(idx, 1);

    renderStats();
    renderUpcoming();
    renderRequests();
    showToast(`Request approved — ${r.requester} added to the schedule.`);
  }


  /* ------------------------------------------
     4. RENDER — Completed Blessings (May 2026)
  ------------------------------------------ */
  function renderCompleted() {
    completedCount.textContent = `${completed.length} completed`;

    completedList.innerHTML = completed.map(c => `
      <li>
        <div class="completed-row">
          <div class="completed-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
          </div>
          <div class="completed-info">
            <p class="completed-name">${escapeHtml(c.requester)}</p>
            <p class="completed-meta">${escapeHtml(c.type)}</p>
          </div>
          <div class="completed-date">${formatLongDate(c.date)}</div>
        </div>
      </li>
    `).join('');
  }

  renderStats();
  renderUpcoming();
  renderRequests();
  renderCompleted();


  /* ------------------------------------------
     5. SCHEDULE BLESSING MODAL
  ------------------------------------------ */
  const scheduleModal = document.getElementById('schedule-modal');

  document.getElementById('btn-schedule-blessing').addEventListener('click', () => {
    document.getElementById('schedule-date').value = TODAY_ISO;
    openModal(scheduleModal);
  });

  document.getElementById('schedule-submit').addEventListener('click', () => {
    const requester = document.getElementById('schedule-requester').value.trim();
    const date       = document.getElementById('schedule-date').value;
    const time24     = document.getElementById('schedule-time').value;
    const type        = document.getElementById('schedule-type').value;
    const location     = document.getElementById('schedule-location').value.trim();

    if (!requester || !date || !time24 || !type) {
      showToast('Please fill in requester, date, time, and blessing type.', true);
      return;
    }

    upcoming.push({
      requester,
      type,
      location: location || 'Not specified',
      date,
      time: formatTime12(time24),
    });

    renderStats();
    renderUpcoming();
    closeModal(scheduleModal);
    showToast(`Blessing scheduled for ${requester} on ${formatShortDate(date)}.`);

    // Reset form
    document.getElementById('schedule-requester').value = '';
    document.getElementById('schedule-time').value = '';
    document.getElementById('schedule-type').value = '';
    document.getElementById('schedule-location').value = '';
  });

  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* ------------------------------------------
     6. DECLINE REASON MODAL
  ------------------------------------------ */
  const declineModal = document.getElementById('decline-modal');
  const declineTargetName = document.getElementById('decline-target-name');
  const declineReasonInput = document.getElementById('decline-reason');
  let declineTargetIndex = null;

  function openDeclineModal(idx) {
    declineTargetIndex = idx;
    declineTargetName.textContent = requests[idx].requester;
    declineReasonInput.value = '';
    openModal(declineModal);
  }

  document.getElementById('decline-submit').addEventListener('click', () => {
    if (declineTargetIndex === null) return;

    const r = requests[declineTargetIndex];
    requests.splice(declineTargetIndex, 1);

    renderStats();
    renderRequests();
    closeModal(declineModal);
    showToast(`Request from ${r.requester} declined.`);

    declineTargetIndex = null;
  });


  /* ------------------------------------------
     7. MODAL HELPERS (shared open/close/escape)
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(scheduleModal);
      closeModal(declineModal);
    });
  });

  [scheduleModal, declineModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(scheduleModal);
      closeModal(declineModal);
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
     8. TOAST NOTIFICATIONS
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