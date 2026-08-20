/* ============================================
   SacraDigit — User Mass Schedule Scripts
   (user-mass-schedule.js)
   Runs after user-shell.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     "Today" is fixed to match the rest of the
     app's sample data (dashboard, my-requests).
  ------------------------------------------ */
  const TODAY_ISO = '2026-06-19';

  // Masses keyed by ISO date. Each entry: { time, type, note, special }
  const massesByDate = {
    '2026-06-19': [
      { time: '06:00 AM', type: 'Daily Mass',       note: 'For the souls in purgatory', special: false },
      { time: '07:00 AM', type: 'Daily Mass',       note: '',                            special: false },
      { time: '05:30 PM', type: 'Anticipated Mass', note: '',                            special: false },
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
    { name: 'Feast of the Sacred Heart of Jesus',        date: '2026-06-21' },
    { name: 'Our Lady of Fatima Novena — Day 1',          date: '2026-06-27' },
    { name: 'Solemnity of Sts. Peter and Paul',           date: '2026-06-29' },
    { name: 'First Friday Mass — Sacred Heart Devotion',   date: '2026-07-03' },
  ];

  const weeklySchedule = [
    { day: 'Monday',    times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Tuesday',   times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Wednesday', times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Thursday',  times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Friday',    times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Saturday',  times: ['7:00 AM', '5:30 PM'],                       type: 'Anticipated Mass' },
    { day: 'Sunday',    times: ['6:00 AM', '8:00 AM', '10:00 AM', '5:00 PM'], type: 'Sunday Mass' },
  ];

  // Reminders the parishioner has set, keyed by "date|time"
  const reminders = new Set();


  /* ------------------------------------------
     1. DOM REFERENCES
  ------------------------------------------ */
  const seasonDot            = document.getElementById('season-dot');
  const seasonName            = document.getElementById('season-name');
  const seasonWeek             = document.getElementById('season-week');
  const seasonProgressFill      = document.getElementById('season-progress-fill');
  const seasonProgressLabel      = document.getElementById('season-progress-label');

  const datePicker          = document.getElementById('date-picker');
  const btnToday              = document.getElementById('btn-today');
  const scheduleDateLabel       = document.getElementById('schedule-date-label');
  const dateScheduleList          = document.getElementById('date-schedule-list');
  const dateScheduleEmpty          = document.getElementById('date-schedule-empty');
  const specialMassesList             = document.getElementById('special-masses-list');
  const weeklyTbody                     = document.getElementById('weekly-tbody');

  datePicker.value = TODAY_ISO;


  /* ------------------------------------------
     2. HELPERS
  ------------------------------------------ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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


  /* ------------------------------------------
     3. LITURGICAL SEASON BANNER
     Approximate 2026 liturgical calendar dates,
     used for a friendly at-a-glance banner —
     matches the rest of the app's fixed sample data.
  ------------------------------------------ */
  const SEASONS = [
    { key: 'christmas', cls: 'christmas', name: 'Christmas Season', start: '01-01', end: '01-11' },
    { key: 'ordinary-1', cls: 'ordinary', name: 'Ordinary Time',    start: '01-12', end: '02-17' },
    { key: 'lent',       cls: 'lent',      name: 'Lent',             start: '02-18', end: '03-28' },
    { key: 'holy-week',  cls: 'holy-week', name: 'Holy Week',        start: '03-29', end: '04-04' },
    { key: 'easter',     cls: 'easter',    name: 'Easter Season',    start: '04-05', end: '05-23' },
    { key: 'ordinary-2', cls: 'ordinary',  name: 'Ordinary Time',    start: '05-24', end: '11-28' },
    { key: 'advent',     cls: 'advent',    name: 'Advent',           start: '11-29', end: '12-24' },
    { key: 'christmas-2',cls: 'christmas', name: 'Christmas Season', start: '12-25', end: '12-31' },
  ];

  // Cumulative day-of-year offsets for a non-leap year, indexed by month (0 = Jan)
  const MONTH_OFFSETS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  function dayOfYear(monthDay) {
    const [mm, dd] = monthDay.split('-').map(Number);
    return MONTH_OFFSETS[mm - 1] + dd;
  }

  function getSeasonInfo(iso) {
    const monthDay = iso.slice(5); // 'MM-DD'
    const doy = dayOfYear(monthDay);

    const season = SEASONS.find(s => doy >= dayOfYear(s.start) && doy <= dayOfYear(s.end)) || SEASONS[5];

    const totalDays = dayOfYear(season.end) - dayOfYear(season.start) + 1;
    const dayIndex  = doy - dayOfYear(season.start) + 1;
    const weekNum   = Math.ceil(dayIndex / 7);
    const pct       = Math.min(100, Math.round((dayIndex / totalDays) * 100));

    return {
      cls: season.cls,
      name: season.name,
      weekLabel: season.key === 'holy-week' ? `Day ${dayIndex} of Holy Week` : `Week ${weekNum}`,
      progressLabel: `Day ${dayIndex} of ${totalDays}`,
      pct,
    };
  }

  function renderSeasonBanner(iso) {
    const info = getSeasonInfo(iso);

    seasonDot.className = `season-dot ${info.cls}`;
    seasonName.textContent = info.name;
    seasonWeek.textContent = info.weekLabel;

    seasonProgressFill.className = `season-progress-fill ${info.cls}`;
    seasonProgressFill.style.width = `${info.pct}%`;
    seasonProgressLabel.textContent = info.progressLabel;
  }


  /* ------------------------------------------
     4. RENDER — Date's Schedule
  ------------------------------------------ */
  function renderDateSchedule() {
    const iso = datePicker.value;
    const masses = massesByDate[iso] || [];

    scheduleDateLabel.textContent = formatLongDate(iso);
    dateScheduleList.innerHTML = '';

    if (masses.length === 0) {
      dateScheduleEmpty.classList.remove('hidden');
      renderSeasonBanner(iso);
      return;
    }
    dateScheduleEmpty.classList.add('hidden');

    const sorted = masses.slice().sort((a, b) => to24h(a.time) - to24h(b.time));

    sorted.forEach(m => {
      const reminderKey = `${iso}|${m.time}`;
      const isSet = reminders.has(reminderKey);

      const li = document.createElement('li');
      li.innerHTML = `
        <div class="mass-row">
          <span class="mass-time-col">${escapeHtml(m.time)}</span>
          <div class="mass-info">
            <p class="mass-type-name">${escapeHtml(m.type)}</p>
            ${m.note ? `<p class="mass-note-text">${escapeHtml(m.note)}</p>` : ''}
          </div>
          ${m.special ? '<span class="mass-special-tag">Special</span>' : ''}
          <button type="button" class="btn-reminder${isSet ? ' set' : ''}" data-key="${reminderKey}" data-type="${escapeHtml(m.type)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            ${isSet ? 'Reminder Set' : 'Set Reminder'}
          </button>
        </div>
      `;
      dateScheduleList.appendChild(li);
    });

    renderSeasonBanner(iso);
  }

  datePicker.addEventListener('change', renderDateSchedule);

  btnToday.addEventListener('click', () => {
    datePicker.value = TODAY_ISO;
    renderDateSchedule();
  });

  dateScheduleList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reminder');
    if (!btn) return;

    const key = btn.dataset.key;
    const type = btn.dataset.type;

    if (reminders.has(key)) {
      reminders.delete(key);
      btn.classList.remove('set');
      btn.innerHTML = btn.innerHTML.replace('Reminder Set', 'Set Reminder');
      window.showToast(`Reminder removed for ${type}.`);
    } else {
      reminders.add(key);
      btn.classList.add('set');
      btn.innerHTML = btn.innerHTML.replace('Set Reminder', 'Reminder Set');
      window.showToast(`We'll remind you before ${type} starts.`);
    }
  });


  /* ------------------------------------------
     5. RENDER — Upcoming Special Masses
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
            <p class="special-date-text">${formatLongDate(s.date)}</p>
          </div>
        </div>
      </li>
    `).join('');
  }


  /* ------------------------------------------
     6. RENDER — Regular Weekly Mass Schedule
  ------------------------------------------ */
  function renderWeeklySchedule() {
    weeklyTbody.innerHTML = weeklySchedule.map(w => `
      <tr>
        <td class="font-semibold text-gray-900">${escapeHtml(w.day)}</td>
        <td>${w.times.map(t => `<span class="time-pill">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${escapeHtml(w.type)}</td>
      </tr>
    `).join('');
  }


  /* ------------------------------------------
     7. INIT
  ------------------------------------------ */
  renderDateSchedule();
  renderSpecialMasses();
  renderWeeklySchedule();

});