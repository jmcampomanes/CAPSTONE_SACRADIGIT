/* ============================================
   SacraDigit Admin — Masses (Special Masses) Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" is fixed to match the rest of the
     app's sample data (dashboard, archives).
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  // Masses keyed by ISO date. Each entry: { time, type, note, special }
  let massesByDate = {
    '2026-06-19': [
      { time: '06:00 AM', type: 'Daily Mass',      note: 'For the souls in purgatory', special: false },
      { time: '07:00 AM', type: 'Daily Mass',      note: '',                            special: false },
      { time: '05:30 PM', type: 'Anticipated Mass', note: '',                           special: false },
    ],
    '2026-06-21': [
      { time: '06:00 AM', type: 'Sunday Mass',  note: '', special: false },
      { time: '08:00 AM', type: 'Sunday Mass',  note: '', special: false },
      { time: '10:00 AM', type: 'Sunday Mass',  note: '', special: false },
      { time: '05:00 PM', type: 'Sunday Mass',  note: '', special: false },
      { time: '03:00 PM', type: 'Special Mass', note: 'Feast of the Sacred Heart of Jesus', special: true },
    ],
    '2026-06-27': [
      { time: '06:00 PM', type: 'Special Mass', note: 'Our Lady of Fatima Novena — Day 1', special: true },
    ],
  };

  // Upcoming special masses (separate from the date-keyed map, shown regardless of selected date)
  const specialMasses = [
    { name: 'Feast of the Sacred Heart of Jesus',     date: '2026-06-21' },
    { name: 'Our Lady of Fatima Novena — Day 1',       date: '2026-06-27' },
    { name: 'Solemnity of Sts. Peter and Paul',        date: '2026-06-29' },
    { name: 'First Friday Mass — Sacred Heart Devotion', date: '2026-07-03' },
  ];

  const weeklySchedule = [
    { day: 'Monday',    times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Tuesday',   times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Wednesday', times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Thursday',  times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Friday',    times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Saturday',  times: ['7:00 AM', '5:30 PM'],            type: 'Anticipated Mass' },
    { day: 'Sunday',    times: ['6:00 AM', '8:00 AM', '10:00 AM', '5:00 PM'], type: 'Sunday Mass' },
  ];

  const datePicker          = document.getElementById('date-picker');
  const scheduleDateLabel     = document.getElementById('schedule-date-label');
  const dateScheduleList      = document.getElementById('date-schedule-list');
  const dateScheduleEmpty     = document.getElementById('date-schedule-empty');
  const specialMassesList      = document.getElementById('special-masses-list');
  const weeklyTbody            = document.getElementById('weekly-tbody');

  datePicker.value = TODAY_ISO;

  /* ------------------------------------------
     1. RENDER — Date's Schedule
  ------------------------------------------ */
  function renderDateSchedule() {
    const iso = datePicker.value;
    const masses = massesByDate[iso] || [];

    scheduleDateLabel.textContent = formatLongDate(iso);
    dateScheduleList.innerHTML = '';

    if (masses.length === 0) {
      dateScheduleEmpty.classList.remove('hidden');
      return;
    }
    dateScheduleEmpty.classList.add('hidden');

    masses
      .slice()
      .sort((a, b) => to24h(a.time) - to24h(b.time))
      .forEach(m => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="schedule-row">
            <span class="schedule-time">${escapeHtml(m.time)}</span>
            <div class="schedule-info">
              <p class="schedule-type">${escapeHtml(m.type)}</p>
              ${m.note ? `<p class="schedule-note">${escapeHtml(m.note)}</p>` : ''}
            </div>
            ${m.special ? '<span class="schedule-special-tag">Special</span>' : ''}
          </div>
        `;
        dateScheduleList.appendChild(li);
      });
  }

  function to24h(timeStr) {
    const [time, meridiem] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  function formatLongDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  datePicker.addEventListener('change', renderDateSchedule);


  /* ------------------------------------------
     2. RENDER — Upcoming Special Masses
     (independent of the date picker — always
     shows what's coming up next)
  ------------------------------------------ */
  function renderSpecialMasses() {
    const today = new Date(TODAY_ISO + 'T00:00:00');

    const upcoming = specialMasses
      .filter(s => new Date(s.date + 'T00:00:00') >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    specialMassesList.innerHTML = upcoming.map(s => `
      <li>
        <div class="special-row">
          <div class="special-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
          </div>
          <div class="special-info">
            <p class="special-name">${escapeHtml(s.name)}</p>
            <p class="special-date">${formatLongDate(s.date)}</p>
          </div>
        </div>
      </li>
    `).join('');
  }


  /* ------------------------------------------
     3. RENDER — Regular Weekly Mass Schedule
  ------------------------------------------ */
  function renderWeeklySchedule() {
    weeklyTbody.innerHTML = weeklySchedule.map((w, idx) => `
      <tr>
        <td class="day-cell">${escapeHtml(w.day)}</td>
        <td>${w.times.map(t => `<span class="time-pill">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${escapeHtml(w.type)}</td>
        <td class="text-right"><button type="button" class="row-action" data-day-index="${idx}">Edit ›</button></td>
      </tr>
    `).join('');
  }

  weeklyTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-action');
    if (btn) {
      const idx = parseInt(btn.dataset.dayIndex, 10);
      showToast(`Editing ${weeklySchedule[idx].day}'s schedule… (not yet wired to a form)`);
      // TODO: open an edit modal for the weekly schedule once that flow is designed.
    }
  });

  renderDateSchedule();
  renderSpecialMasses();
  renderWeeklySchedule();


  /* ------------------------------------------
     4. PRINT SCHEDULE
  ------------------------------------------ */
  document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
  });


  /* ------------------------------------------
     5. SCHEDULE MASS MODAL
  ------------------------------------------ */
  const scheduleModal = document.getElementById('schedule-modal');

  document.getElementById('btn-schedule-mass').addEventListener('click', () => {
    document.getElementById('schedule-date').value = datePicker.value;
    openModal(scheduleModal);
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(scheduleModal));
  });

  scheduleModal.addEventListener('click', (e) => {
    if (e.target === scheduleModal) closeModal(scheduleModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(scheduleModal);
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

  document.getElementById('schedule-submit').addEventListener('click', () => {
    const date    = document.getElementById('schedule-date').value;
    const time24  = document.getElementById('schedule-time').value;
    const type    = document.getElementById('schedule-type').value;
    const note     = document.getElementById('schedule-note').value.trim();
    const isSpecial = document.getElementById('schedule-special').checked;

    if (!date || !time24 || !type) {
      showToast('Please fill in date, time, and mass type.', true);
      return;
    }

    const time12 = formatTime12(time24);

    if (!massesByDate[date]) massesByDate[date] = [];
    massesByDate[date].push({ time: time12, type, note, special: isSpecial });

    if (isSpecial) {
      specialMasses.push({ name: note || type, date });
      renderSpecialMasses();
    }

    // Jump the date picker to the newly scheduled date so the user sees it land
    datePicker.value = date;
    renderDateSchedule();

    closeModal(scheduleModal);
    showToast(`Mass scheduled for ${formatShortDate(date)} at ${time12}.`);

    // Reset form
    document.getElementById('schedule-time').value = '';
    document.getElementById('schedule-type').value = '';
    document.getElementById('schedule-note').value = '';
    document.getElementById('schedule-special').checked = false;
  });

  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const meridiem = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  }


  /* ------------------------------------------
     6. TOAST NOTIFICATIONS
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