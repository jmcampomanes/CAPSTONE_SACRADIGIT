/* ============================================
   SacraDigit — User Mass Schedule Scripts
   (user-mass-schedule.js)
   Runs after user-shell.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  const TODAY_ISO = '2026-06-19';

  /* ------------------------------------------
     0. DATA — masses keyed by ISO date
  ------------------------------------------ */
  const massesByDate = {
    '2026-06-19': [
      { time: '06:00 AM', type: 'Daily Mass',       note: '',                             special: false },
      { time: '07:00 AM', type: 'Daily Mass',       note: 'For the souls in purgatory',   special: false },
      { time: '05:30 PM', type: 'Anticipated Mass', note: '',                             special: false },
    ],
    '2026-06-20': [
      { time: '06:00 AM', type: 'Daily Mass',       note: '',  special: false },
      { time: '07:00 AM', type: 'Daily Mass',       note: '',  special: false },
    ],
    '2026-06-21': [
      { time: '06:00 AM', type: 'Sunday Mass',  note: '',                                       special: false },
      { time: '08:00 AM', type: 'Sunday Mass',  note: '',                                       special: false },
      { time: '10:00 AM', type: 'Sunday Mass',  note: '',                                       special: false },
      { time: '03:00 PM', type: 'Special Mass', note: 'Feast of the Sacred Heart of Jesus',     special: true  },
      { time: '05:00 PM', type: 'Sunday Mass',  note: '',                                       special: false },
    ],
    '2026-06-27': [
      { time: '06:00 PM', type: 'Special Mass', note: 'Our Lady of Fatima Novena — Day 1', special: true },
    ],
    '2026-06-28': [
      { time: '06:00 AM', type: 'Daily Mass',   note: '',                              special: false },
      { time: '07:00 PM', type: 'Vigil Mass',   note: 'Sts. Peter and Paul — Vigil',  special: true  },
    ],
    '2026-06-29': [
      { time: '06:00 AM', type: 'Daily Mass',    note: '',                                   special: false },
      { time: '09:00 AM', type: 'Solemn Mass',   note: 'Solemnity of Sts. Peter and Paul',  special: true  },
    ],
  };

  const weeklySchedule = [
    { day: 'Monday',    times: ['6:00 AM', '7:00 AM'],                          type: 'Daily Mass' },
    { day: 'Tuesday',   times: ['6:00 AM', '7:00 AM'],                          type: 'Daily Mass' },
    { day: 'Wednesday', times: ['6:00 AM', '7:00 AM'],                          type: 'Daily Mass' },
    { day: 'Thursday',  times: ['6:00 AM', '7:00 AM'],                          type: 'Daily Mass' },
    { day: 'Friday',    times: ['6:00 AM', '7:00 AM'],                          type: 'Daily Mass' },
    { day: 'Saturday',  times: ['7:00 AM', '5:30 PM'],                          type: 'Anticipated Mass' },
    { day: 'Sunday',    times: ['6:00 AM', '8:00 AM', '10:00 AM', '5:00 PM'],  type: 'Sunday Mass' },
  ];

  const upcomingSpecial = [
    { name: 'Feast of the Sacred Heart of Jesus',      date: '2026-06-21' },
    { name: 'Our Lady of Fatima Novena — Day 1',       date: '2026-06-27' },
    { name: 'Solemnity of Sts. Peter and Paul',        date: '2026-06-29' },
    { name: 'First Friday Mass — Sacred Heart Devotion', date: '2026-07-03' },
  ];

  /* ------------------------------------------
     1. LITURGICAL SEASON BANNER
     Ordinary Time (Year C, 2026):
     Weeks 1-8:   Jan 11 – Mar 1  (before Lent)
     Lent:        Mar 2 – Apr 16
     Holy Week:   Apr 13 – Apr 19
     Easter:      Apr 20 – Jun 7
     Ordinary:    Jun 8 onwards
  ------------------------------------------ */
  const seasons = [
    { name: 'Ordinary Time',   cssClass: 'ordinary',  start: '2026-01-11', end: '2026-03-01', totalWeeks: 8  },
    { name: 'Lent',            cssClass: 'lent',      start: '2026-03-02', end: '2026-04-12', totalWeeks: 6  },
    { name: 'Holy Week',       cssClass: 'holy-week', start: '2026-04-13', end: '2026-04-19', totalWeeks: 1  },
    { name: 'Easter Season',   cssClass: 'easter',    start: '2026-04-20', end: '2026-06-07', totalWeeks: 7  },
    { name: 'Ordinary Time',   cssClass: 'ordinary',  start: '2026-06-08', end: '2026-11-28', totalWeeks: 26 },
    { name: 'Advent',          cssClass: 'advent',    start: '2026-11-29', end: '2026-12-24', totalWeeks: 4  },
    { name: 'Christmas Season', cssClass: 'christmas', start: '2026-12-25', end: '2027-01-10', totalWeeks: 2 },
  ];

  function renderSeasonBanner() {
    const today = new Date(TODAY_ISO + 'T00:00:00');
    const season = seasons.find(s =>
      today >= new Date(s.start + 'T00:00:00') && today <= new Date(s.end + 'T00:00:00')
    );
    if (!season) return;

    const start   = new Date(season.start + 'T00:00:00');
    const end     = new Date(season.end   + 'T00:00:00');
    const elapsed  = Math.max(0, today - start);
    const total    = end - start;
    const percent  = Math.min(100, Math.round((elapsed / total) * 100));
    const weekNum  = Math.ceil(elapsed / (7 * 86400000)) || 1;

    document.getElementById('season-name').textContent  = season.name;
    document.getElementById('season-week').textContent  = `Week ${weekNum} of ${season.totalWeeks}`;
    document.getElementById('season-progress-label').textContent = `${percent}% of season complete`;
    document.getElementById('season-progress-fill').style.width = `${percent}%`;

    const dot  = document.getElementById('season-dot');
    const fill = document.getElementById('season-progress-fill');
    dot.className  = `season-dot ${season.cssClass}`;
    fill.className = `season-progress-fill ${season.cssClass}`;
  }

  renderSeasonBanner();


  /* ------------------------------------------
     2. DATE PICKER — drive the schedule list
  ------------------------------------------ */
  const datePicker        = document.getElementById('date-picker');
  const scheduleDateLabel  = document.getElementById('schedule-date-label');
  const massList            = document.getElementById('mass-list');
  const massEmpty            = document.getElementById('mass-empty');
  const massCount             = document.getElementById('mass-count');

  // Track which (date+time) combos have reminders set
  const remindersSet = new Set();

  datePicker.value = TODAY_ISO;

  function formatLongDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function to24h(timeStr) {
    const [time, meridiem] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  function renderSchedule() {
    const iso    = datePicker.value;
    const masses  = massesByDate[iso] || [];
    const sorted  = masses.slice().sort((a, b) => to24h(a.time) - to24h(b.time));

    scheduleDateLabel.textContent = formatLongDate(iso);
    massCount.textContent = `${sorted.length} mass${sorted.length === 1 ? '' : 'es'}`;
    massList.innerHTML = '';

    if (sorted.length === 0) {
      massEmpty.classList.remove('hidden');
      return;
    }
    massEmpty.classList.add('hidden');

    sorted.forEach((m, idx) => {
      const key = `${iso}_${m.time}_${idx}`;
      const alreadySet = remindersSet.has(key);

      const li = document.createElement('li');
      li.innerHTML = `
        <div class="mass-row">
          <span class="mass-time-col">${m.time}</span>
          <div class="mass-info">
            <p class="mass-type-name">${m.type}</p>
            ${m.note ? `<p class="mass-note-text">${m.note}</p>` : ''}
          </div>
          ${m.special ? '<span class="mass-special-tag">Special</span>' : ''}
          <button type="button"
            class="btn-reminder ${alreadySet ? 'set' : ''}"
            data-key="${key}"
            data-time="${m.time}"
            data-type="${m.type}"
            data-date="${iso}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            ${alreadySet ? 'Reminder Set' : 'Remind Me'}
          </button>
        </div>
      `;
      massList.appendChild(li);
    });
  }

  // Delegate reminder button clicks
  massList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reminder');
    if (!btn) return;

    const key  = btn.dataset.key;
    const time  = btn.dataset.time;
    const type  = btn.dataset.type;
    const date  = btn.dataset.date;

    if (remindersSet.has(key)) {
      remindersSet.delete(key);
      btn.classList.remove('set');
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        Remind Me`;
      window.showToast('Reminder removed.');
    } else {
      remindersSet.add(key);
      btn.classList.add('set');
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Reminder Set`;
      const d = new Date(date + 'T00:00:00');
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      window.showToast(`Reminder set for ${type} on ${label} at ${time}.`);
    }
  });

  datePicker.addEventListener('change', renderSchedule);

  // "Today" shortcut button
  document.getElementById('btn-today').addEventListener('click', () => {
    datePicker.value = TODAY_ISO;
    renderSchedule();
  });

  renderSchedule();


  /* ------------------------------------------
     3. REGULAR WEEKLY SCHEDULE TABLE
  ------------------------------------------ */
  const weeklyTbody = document.getElementById('weekly-tbody');
  if (weeklyTbody) {
    weeklyTbody.innerHTML = weeklySchedule.map(w => `
      <tr>
        <td class="font-semibold text-gray-900">${w.day}</td>
        <td>${w.times.map(t => `<span class="time-pill">${t}</span>`).join('')}</td>
        <td class="text-gray-500">${w.type}</td>
      </tr>
    `).join('');
  }


  /* ------------------------------------------
     4. UPCOMING SPECIAL MASSES LIST
  ------------------------------------------ */
  const specialList = document.getElementById('special-list');
  if (specialList) {
    const today = new Date(TODAY_ISO + 'T00:00:00');
    const upcoming = upcomingSpecial
      .filter(s => new Date(s.date + 'T00:00:00') >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    specialList.innerHTML = upcoming.map(s => {
      const d = new Date(s.date + 'T00:00:00');
      const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      return `
        <li>
          <div class="special-row">
            <div class="special-icon">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
              </svg>
            </div>
            <div class="special-info">
              <p class="special-name">${s.name}</p>
              <p class="special-date-text">${label}</p>
            </div>
            <button type="button"
              class="btn-reminder"
              data-key="special_${s.date}"
              data-time="TBD"
              data-type="${s.name}"
              data-date="${s.date}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              Remind Me
            </button>
          </div>
        </li>
      `;
    }).join('');

    // Delegate clicks for special mass reminders
    specialList.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-reminder');
      if (!btn) return;

      const key  = btn.dataset.key;
      const type  = btn.dataset.type;
      const date  = btn.dataset.date;

      if (remindersSet.has(key)) {
        remindersSet.delete(key);
        btn.classList.remove('set');
        btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg> Remind Me`;
        window.showToast('Reminder removed.');
      } else {
        remindersSet.add(key);
        btn.classList.add('set');
        btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Reminder Set`;
        const d   = new Date(date + 'T00:00:00');
        const lbl = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        window.showToast(`Reminder set for ${type} on ${lbl}.`);
      }
    });
  }

});