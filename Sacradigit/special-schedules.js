/* ============================================
   SacraDigit Admin — Special Schedules Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" fixed to match the rest of the app.
     startDate / endDate = ISO strings for the
     full liturgical season/event range.
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  let schedules = [
    {
      name: 'Parish Fiesta — Our Lady of Fatima',
      type: 'Special Event',
      status: 'Ongoing',
      startDate: '2026-06-13',
      endDate: '2026-06-21',
      note: 'Solemn procession on June 21. Special masses every evening at 6:00 PM with choir.',
    },
    {
      name: 'Feast of Sts. Peter and Paul',
      type: 'Feast Day Series',
      status: 'Upcoming',
      startDate: '2026-06-28',
      endDate: '2026-06-29',
      note: 'Vigil Mass on June 28 at 7:00 PM. Solemn Mass on June 29 at 9:00 AM.',
    },
    {
      name: 'Our Lady of Fatima Novena',
      type: 'Novena',
      status: 'Upcoming',
      startDate: '2026-06-27',
      endDate: '2026-07-05',
      note: '9-day novena with evening prayers at 6:00 PM. Final day includes a procession.',
    },
    {
      name: 'Simbang Gabi 2026',
      type: 'Liturgical Season',
      status: 'Upcoming',
      startDate: '2026-12-16',
      endDate: '2026-12-24',
      note: 'Dawn masses at 5:00 AM. Special choir each night. Traditional food stalls in the courtyard.',
    },
    {
      name: 'Advent Season 2026',
      type: 'Liturgical Season',
      status: 'Upcoming',
      startDate: '2026-11-29',
      endDate: '2026-12-24',
      note: 'Weekly Advent reflections after Sunday mass. Penitential services on Saturdays.',
    },
  ];

  const grid           = document.getElementById('schedules-grid');
  const schedulesEmpty  = document.getElementById('schedules-empty');
  const schedulesCount  = document.getElementById('schedules-count');

  const typeClassMap = {
    'Liturgical Season': 'liturgical',
    'Novena':            'novena',
    'Feast Day Series':  'feast',
    'Special Event':     'special',
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function parseDate(iso) {
    return new Date(iso + 'T00:00:00');
  }

  function formatDisplayDate(iso) {
    return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* Duration progress: how far through the season are we today? */
  function progressPercent(startIso, endIso) {
    const today  = parseDate(TODAY_ISO).getTime();
    const start  = parseDate(startIso).getTime();
    const end    = parseDate(endIso).getTime();
    if (today <= start) return 0;
    if (today >= end)   return 100;
    return Math.round(((today - start) / (end - start)) * 100);
  }

  function durationLabel(startIso, endIso) {
    const start = parseDate(startIso);
    const end   = parseDate(endIso);
    const today = parseDate(TODAY_ISO);
    const totalDays = Math.round((end - start) / 86400000) + 1;

    if (today < start) {
      const daysUntil = Math.round((start - today) / 86400000);
      return `Starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    }
    if (today > end) {
      return 'Completed';
    }
    const daysPassed = Math.round((today - start) / 86400000) + 1;
    return `Day ${daysPassed} of ${totalDays}`;
  }


  /* ------------------------------------------
     1. RENDER — Schedule card grid
  ------------------------------------------ */
  function renderGrid() {
    // Sort: ongoing first, then by start date ascending
    const sorted = schedules.slice().sort((a, b) => {
      if (a.status === 'Ongoing' && b.status !== 'Ongoing') return -1;
      if (b.status === 'Ongoing' && a.status !== 'Ongoing') return 1;
      return parseDate(a.startDate) - parseDate(b.startDate);
    });

    schedulesCount.textContent = `${sorted.length} schedule${sorted.length === 1 ? '' : 's'}`;

    if (sorted.length === 0) {
      grid.innerHTML = '';
      schedulesEmpty.classList.remove('hidden');
      return;
    }
    schedulesEmpty.classList.add('hidden');

    grid.innerHTML = sorted.map((s) => {
      const realIndex  = schedules.indexOf(s);
      const typeClass   = typeClassMap[s.type] || 'special';
      const progress     = progressPercent(s.startDate, s.endDate);
      const durLabel      = durationLabel(s.startDate, s.endDate);

      return `
        <div class="schedule-card ${typeClass}">
          <div class="schedule-card-body">
            <div class="schedule-card-top">
              <p class="schedule-name">${escapeHtml(s.name)}</p>
              <span class="status-tag ${s.status.toLowerCase()}">${escapeHtml(s.status)}</span>
            </div>
            <div>
              <span class="type-tag ${typeClass}">${escapeHtml(s.type)}</span>
            </div>
            <div class="schedule-date-bar">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ${formatDisplayDate(s.startDate)} – ${formatDisplayDate(s.endDate)}
            </div>
            <p class="schedule-note">${escapeHtml(s.note)}</p>
          </div>
          <div class="schedule-card-footer">
            <div class="duration-bar-wrap">
              <p class="duration-bar-label">${durLabel}</p>
              <div class="duration-bar-track">
                <div class="duration-bar-fill" style="width: ${progress}%"></div>
              </div>
            </div>
            <div class="schedule-actions">
              <button type="button" class="sched-edit" data-index="${realIndex}">Edit</button>
              <button type="button" class="sched-delete" data-index="${realIndex}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  grid.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.sched-edit');
    const deleteBtn  = e.target.closest('.sched-delete');

    if (editBtn) {
      const idx = parseInt(editBtn.dataset.index, 10);
      openEditModal(idx);
    }

    if (deleteBtn) {
      const idx = parseInt(deleteBtn.dataset.index, 10);
      const name = schedules[idx].name;
      schedules.splice(idx, 1);
      renderGrid();
      showToast(`"${name}" removed.`);
    }
  });

  renderGrid();


  /* ------------------------------------------
     2. ADD / EDIT SCHEDULE MODAL
  ------------------------------------------ */
  const modal       = document.getElementById('schedule-modal');
  const modalTitle   = document.getElementById('schedule-modal-title');
  const submitBtn     = document.getElementById('sched-submit');
  const nameInput      = document.getElementById('sched-name');
  const typeSelect      = document.getElementById('sched-type');
  const statusSelect    = document.getElementById('sched-status');
  const startInput       = document.getElementById('sched-start');
  const endInput         = document.getElementById('sched-end');
  const noteInput         = document.getElementById('sched-note');

  let editTargetIndex = null;

  document.getElementById('btn-add-schedule').addEventListener('click', () => {
    editTargetIndex = null;
    modalTitle.textContent = 'Add Special Schedule';
    submitBtn.textContent = 'Save Schedule';
    nameInput.value = '';
    typeSelect.value = 'Liturgical Season';
    statusSelect.value = 'Upcoming';
    startInput.value = '';
    endInput.value = '';
    noteInput.value = '';
    openModal(modal);
  });

  function openEditModal(idx) {
    editTargetIndex = idx;
    const s = schedules[idx];
    modalTitle.textContent = 'Edit Special Schedule';
    submitBtn.textContent = 'Save Changes';
    nameInput.value = s.name;
    typeSelect.value = s.type;
    statusSelect.value = s.status;
    startInput.value = s.startDate;
    endInput.value = s.endDate;
    noteInput.value = s.note;
    openModal(modal);
  }

  submitBtn.addEventListener('click', () => {
    const name   = nameInput.value.trim();
    const type    = typeSelect.value;
    const status   = statusSelect.value;
    const start    = startInput.value;
    const end      = endInput.value;
    const note     = noteInput.value.trim();

    if (!name || !start || !end) {
      showToast('Please fill in name, start date, and end date.', true);
      return;
    }

    if (parseDate(start) > parseDate(end)) {
      showToast('End date must be on or after the start date.', true);
      return;
    }

    if (editTargetIndex !== null) {
      schedules[editTargetIndex] = { name, type, status, startDate: start, endDate: end, note };
      showToast(`"${name}" updated.`);
    } else {
      schedules.push({ name, type, status, startDate: start, endDate: end, note });
      showToast(`"${name}" added.`);
    }

    renderGrid();
    closeModal(modal);
  });


  /* ------------------------------------------
     3. MODAL HELPERS
  ------------------------------------------ */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(modal));
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(modal);
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


  /* ------------------------------------------
     4. TOAST NOTIFICATIONS
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