/* ============================================
   SacraDigit Admin — Special Schedules Scripts (AWS Amplify)
   Backed by the SpecialSchedule model.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  let schedules = []; // kept in sync via observeQuery, each has .id

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
    div.textContent = str || '';
    return div.innerHTML;
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

  function parseDate(iso) {
    return new Date(iso + 'T00:00:00');
  }

  function formatDisplayDate(iso) {
    return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function progressPercent(startIso, endIso) {
    const today  = parseDate(todayISO).getTime();
    const start  = parseDate(startIso).getTime();
    const end    = parseDate(endIso).getTime();
    if (today <= start) return 0;
    if (today >= end)   return 100;
    return Math.round(((today - start) / (end - start)) * 100);
  }

  function durationLabel(startIso, endIso) {
    const start = parseDate(startIso);
    const end   = parseDate(endIso);
    const today = parseDate(todayISO);
    const totalDays = Math.round((end - start) / 86400000) + 1;

    if (today < start) {
      const daysUntil = Math.round((start - today) / 86400000);
      return `Starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    }
    if (today > end) return 'Completed';
    const daysPassed = Math.round((today - start) / 86400000) + 1;
    return `Day ${daysPassed} of ${totalDays}`;
  }


  /* --- Live data --- */
  client.models.SpecialSchedule.observeQuery().subscribe({
    next: ({ items }) => {
      schedules = items;
      renderGrid();
    },
    error: (err) => {
      console.error('Failed to load schedules:', err);
      grid.innerHTML = '';
      schedulesEmpty.classList.remove('hidden');
    },
  });


  function renderGrid() {
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
      const typeClass = typeClassMap[s.type] || 'special';
      const progress   = progressPercent(s.startDate, s.endDate);
      const durLabel    = durationLabel(s.startDate, s.endDate);

      return `
        <div class="schedule-card ${typeClass}">
          <div class="schedule-card-body">
            <div class="schedule-card-top">
              <p class="schedule-name">${escapeHtml(s.name)}</p>
              <span class="status-tag ${(s.status || '').toLowerCase()}">${escapeHtml(s.status)}</span>
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
              <button type="button" class="sched-edit" data-id="${s.id}">Edit</button>
              <button type="button" class="sched-delete" data-id="${s.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  grid.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.sched-edit');
    const deleteBtn  = e.target.closest('.sched-delete');

    if (editBtn) openEditModal(editBtn.dataset.id);
    if (deleteBtn) openDeleteModal(deleteBtn.dataset.id);
  });


  /* --- Add/Edit Schedule Modal --- */
  const modal       = document.getElementById('schedule-modal');
  const modalTitle   = document.getElementById('schedule-modal-title');
  const submitBtn     = document.getElementById('sched-submit');
  const nameInput      = document.getElementById('sched-name');
  const typeSelect      = document.getElementById('sched-type');
  const statusSelect    = document.getElementById('sched-status');
  const startInput       = document.getElementById('sched-start');
  const endInput         = document.getElementById('sched-end');
  const noteInput         = document.getElementById('sched-note');

  let editTargetId = null;

  document.getElementById('btn-add-schedule').addEventListener('click', () => {
    editTargetId = null;
    modalTitle.textContent = 'Add Special Schedule';
    submitBtn.textContent = 'Save Schedule';
    nameInput.value = '';
    typeSelect.value = 'Liturgical Season';
    statusSelect.value = 'Upcoming';
    startInput.value = '';
    endInput.value = '';
    noteInput.value = '';
    [nameInput, startInput, endInput].forEach(clearFieldError);
    openModal(modal);
  });

  function openEditModal(id) {
    const s = schedules.find(x => x.id === id);
    if (!s) return;
    editTargetId = id;
    modalTitle.textContent = 'Edit Special Schedule';
    submitBtn.textContent = 'Save Changes';
    nameInput.value = s.name;
    typeSelect.value = s.type;
    statusSelect.value = s.status;
    startInput.value = s.startDate;
    endInput.value = s.endDate;
    noteInput.value = s.note;
    [nameInput, startInput, endInput].forEach(clearFieldError);
    openModal(modal);
  }

  [nameInput, startInput, endInput].forEach(input => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  submitBtn.addEventListener('click', async () => {
    const name   = nameInput.value.trim();
    const type    = typeSelect.value;
    const status   = statusSelect.value;
    const start    = startInput.value;
    const end      = endInput.value;
    const note     = noteInput.value.trim();

    [nameInput, startInput, endInput].forEach(clearFieldError);

    let hasError = false;
    if (!name)  { setFieldError(nameInput, 'Event or season name is required.'); hasError = true; }
    if (!start) { setFieldError(startInput, 'Start date is required.'); hasError = true; }
    if (!end)   { setFieldError(endInput, 'End date is required.'); hasError = true; }

    if (!hasError && parseDate(start) > parseDate(end)) {
      setFieldError(endInput, 'End date must be on or after the start date.');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fix the highlighted fields.', true);
      return;
    }

    try {
      if (editTargetId !== null) {
        const result = await client.models.SpecialSchedule.update({
          id: editTargetId, name, type, status, startDate: start, endDate: end, note,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${name}" updated.`);
      } else {
        const result = await client.models.SpecialSchedule.create({
          name, type, status, startDate: start, endDate: end, note,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
        showToast(`"${name}" added.`);
      }
      closeModal(modal);
    } catch (err) {
      console.error('Failed to save schedule:', err);
      showToast(err.message || "Couldn't save the schedule.", true);
    }
  });


  /* --- Delete Confirmation Modal --- */
  const deleteModal      = document.getElementById('delete-modal');
  const deleteTargetName  = document.getElementById('delete-target-name');
  let deleteTargetId = null;

  function openDeleteModal(id) {
    const s = schedules.find(x => x.id === id);
    if (!s) return;
    deleteTargetId = id;
    deleteTargetName.textContent = s.name;
    openModal(deleteModal);
  }

  document.getElementById('delete-confirm-submit').addEventListener('click', async () => {
    if (deleteTargetId === null) return;
    const s = schedules.find(x => x.id === deleteTargetId);

    try {
      const result = await client.models.SpecialSchedule.delete({ id: deleteTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal(deleteModal);
      showToast(`"${s ? s.name : 'Schedule'}" removed.`);
      deleteTargetId = null;
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      showToast(err.message || "Couldn't delete the schedule.", true);
    }
  });


  /* --- Modal helpers --- */
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(modal); closeModal(deleteModal); });
  });

  [modal, deleteModal].forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(modal); closeModal(deleteModal); }
  });

  function openModal(m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) { if (m.classList.contains('hidden')) return; m.classList.add('hidden'); document.body.style.overflow = ''; }


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