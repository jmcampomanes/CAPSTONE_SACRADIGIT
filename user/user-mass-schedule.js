/* ============================================
   SacraDigit — User Mass Schedule Scripts (AWS Amplify)
   Runs after user-shell.js.
   Weekly schedule is backed by the WeeklyMassSchedule
   model — same shared merge logic (live rows + defaults)
   as the admin Masses page, so parishioners always see
   whatever the admin has set. Liturgical season banner
   stays computed. Reminders are saved on this device only
   (localStorage) — no backend model for personal reminders
   exists yet, hence the "(on this phone)" button label.
   ============================================ */

import { client } from '../amplify-init.js';
import { massTypeBadgeHtml, massTypeLegendHtml } from '../mass-types.js';
import { mergeWeeklySchedule, recurringMassesForDate, dayKeyForDate } from '../weekly-mass-schedule.js';

document.addEventListener('DOMContentLoaded', () => {

  // Local date (not toISOString, which is UTC — before 8 AM in Manila that's still yesterday).
  function localISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const todayISO = localISO(new Date());

  const massTypeLegendEl = document.getElementById('mass-type-legend');
  if (massTypeLegendEl) massTypeLegendEl.innerHTML = massTypeLegendHtml();

  let weeklySchedule = mergeWeeklySchedule([]); // merged view (live rows + defaults), see weekly-mass-schedule.js

  const REMINDERS_KEY = 'sacradigit_mass_reminders';
  const reminders = new Set((() => {
    try { return JSON.parse(localStorage.getItem(REMINDERS_KEY)) || []; } catch { return []; }
  })());
  function saveReminders() {
    try { localStorage.setItem(REMINDERS_KEY, JSON.stringify([...reminders])); } catch { /* private mode */ }
  }
  const REMIND_LABEL = 'Remind me (on this phone)';
  const REMINDED_LABEL = 'Reminder on (this phone)';
  let allMasses = [];

  const seasonDot = document.getElementById('season-dot');
  const seasonName = document.getElementById('season-name');
  const seasonWeek = document.getElementById('season-week');
  const seasonProgressFill = document.getElementById('season-progress-fill');
  const seasonProgressLabel = document.getElementById('season-progress-label');

  const datePicker = document.getElementById('date-picker');
  const datePickerLabel = document.getElementById('date-picker-label');
  const btnToday = document.getElementById('btn-today');
  const btnPrevDay = document.getElementById('btn-prev-day');
  const btnNextDay = document.getElementById('btn-next-day');
  const scheduleDateLabel = document.getElementById('schedule-date-label');
  const dateScheduleList = document.getElementById('date-schedule-list');
  const dateScheduleEmpty = document.getElementById('date-schedule-empty');
  const weeklyTbody = document.getElementById('weekly-tbody');

  datePicker.value = todayISO;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
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
  const MONTH_OFFSETS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  function dayOfYear(monthDay) {
    const [mm, dd] = monthDay.split('-').map(Number);
    return MONTH_OFFSETS[mm - 1] + dd;
  }
  function getSeasonInfo(iso) {
    const monthDay = iso.slice(5);
    const doy = dayOfYear(monthDay);
    const season = SEASONS.find(s => doy >= dayOfYear(s.start) && doy <= dayOfYear(s.end)) || SEASONS[5];
    const totalDays = dayOfYear(season.end) - dayOfYear(season.start) + 1;
    const dayIndex  = doy - dayOfYear(season.start) + 1;
    const weekNum   = Math.ceil(dayIndex / 7);
    const pct       = Math.min(100, Math.round((dayIndex / totalDays) * 100));
    return {
      cls: season.cls, name: season.name,
      weekLabel: season.key === 'holy-week' ? `Day ${dayIndex} of Holy Week` : `Week ${weekNum}`,
      progressLabel: `Day ${dayIndex} of ${totalDays}`, pct,
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

  /* --- Live data --- */
  client.models.Mass.observeQuery().subscribe({
    next: ({ items }) => {
      allMasses = items;
      renderDateSchedule();
      renderUpcomingSpecial();
    },
    error: (err) => {
      console.error('Failed to load masses:', err);
      dateScheduleList.innerHTML = `<li class="text-sm text-red-500 py-4">Couldn't load schedule.</li>`;
    },
  });

  // Guarded: if the WeeklyMassSchedule model hasn't been deployed to this
  // backend yet, client.models.WeeklyMassSchedule is undefined — without
  // this guard that throws here and aborts the rest of this script. Until
  // it's deployed, the table just keeps showing its hardcoded defaults.
  if (client.models.WeeklyMassSchedule) {
    client.models.WeeklyMassSchedule.observeQuery().subscribe({
      next: ({ items }) => {
        weeklySchedule = mergeWeeklySchedule(items);
        renderWeeklySchedule();
        renderDateSchedule(); // Date's Schedule includes the recurring pattern too — refresh it when that pattern changes
      },
      error: (err) => {
        console.error('Failed to load weekly mass schedule:', err);
      },
    });
  } else {
    console.warn('WeeklyMassSchedule model not found on this backend yet — showing default weekly schedule only.');
  }

  function renderDateSchedule() {
    const iso = datePicker.value;
    // Individually-scheduled Mass records for this exact date, plus the
    // recurring weekly pattern for whatever day of the week this date
    // falls on — so "today" shows the masses that actually happen today
    // even if no one specifically scheduled them.
    const masses = [
      ...allMasses.filter(m => m.date === iso),
      ...recurringMassesForDate(weeklySchedule, iso, allMasses),
    ];

    scheduleDateLabel.textContent = formatLongDate(iso);
    const short = new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    datePickerLabel.textContent = iso === todayISO ? `Today, ${short}` : short;
    btnToday.hidden = iso === todayISO;
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
            <p class="mass-type-name">${escapeHtml(m.title || m.type)}</p>
            ${m.note && m.note !== m.title ? `<p class="mass-note-text">${escapeHtml(m.note)}</p>` : ''}
          </div>
          ${massTypeBadgeHtml(m.type)}
          <button type="button" class="btn-reminder${isSet ? ' set' : ''}" data-key="${reminderKey}" data-type="${escapeHtml(m.title || m.type)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            <span class="btn-reminder-label">${isSet ? REMINDED_LABEL : REMIND_LABEL}</span>
          </button>
        </div>`;
      dateScheduleList.appendChild(li);
    });

    renderSeasonBanner(iso);
  }

  /* --- Upcoming special Masses (bottom of the Date's Schedule box) ---
     Special Masses already appear in the list above on their own date;
     this keeps the next few in view for everyone, whatever date is picked.
     Tapping one opens its date above. */
  const upcomingSpecialWrap = document.getElementById('upcoming-special-wrap');
  const upcomingSpecialList = document.getElementById('upcoming-special-list');
  const MAX_UPCOMING_SPECIAL = 5;

  function renderUpcomingSpecial() {
    const upcoming = allMasses
      .filter(m => m.isSpecial && m.date && m.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date) || to24h(a.time) - to24h(b.time))
      .slice(0, MAX_UPCOMING_SPECIAL);

    upcomingSpecialWrap.classList.toggle('hidden', upcoming.length === 0);
    upcomingSpecialList.innerHTML = upcoming.map(m => `
      <li>
        <button type="button" class="special-row${m.date === datePicker.value ? ' is-selected' : ''}" data-date="${m.date}">
          <span class="special-icon"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg></span>
          <span class="special-info">
            <span class="special-name">${escapeHtml(m.title || m.note || m.type)}</span>
            <span class="special-date-text">${formatLongDate(m.date)}${m.time ? ` · ${escapeHtml(m.time)}` : ''}</span>
          </span>
          <span class="special-view">View ›</span>
        </button>
      </li>`).join('');
  }

  upcomingSpecialList.addEventListener('click', (e) => {
    const row = e.target.closest('.special-row');
    if (!row) return;
    datePicker.value = row.dataset.date;
    renderDateSchedule();
    renderUpcomingSpecial();
    dateScheduleList.closest('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function showDate(iso) {
    datePicker.value = iso;
    renderDateSchedule();
    renderUpcomingSpecial();
  }
  function shiftDay(delta) {
    const d = new Date((datePicker.value || todayISO) + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    showDate(localISO(d));
  }

  // Clearing the native picker (some browsers allow it) falls back to today.
  datePicker.addEventListener('change', () => showDate(datePicker.value || todayISO));
  btnToday.addEventListener('click', () => showDate(todayISO));
  btnPrevDay.addEventListener('click', () => shiftDay(-1));
  btnNextDay.addEventListener('click', () => shiftDay(1));

  dateScheduleList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reminder');
    if (!btn) return;
    const key = btn.dataset.key;
    const type = btn.dataset.type;
    const label = btn.querySelector('.btn-reminder-label');
    if (reminders.has(key)) {
      reminders.delete(key);
      btn.classList.remove('set');
      label.textContent = REMIND_LABEL;
      window.showToast?.(`Reminder removed for ${type}.`);
    } else {
      reminders.add(key);
      btn.classList.add('set');
      label.textContent = REMINDED_LABEL;
      window.showToast?.(`Reminder saved on this phone for ${type}.`);
    }
    saveReminders();
  });

  function renderWeeklySchedule() {
    const todayKey = dayKeyForDate(todayISO);
    weeklyTbody.innerHTML = weeklySchedule.map(w => `
      <tr${w.dayKey === todayKey ? ' class="is-today" aria-current="date"' : ''}>
        <td class="font-semibold text-gray-900">${escapeHtml(w.dayLabel)}${w.dayKey === todayKey ? ' <span class="today-tag">Today</span>' : ''}</td>
        <td>${w.times.map(t => `<span class="time-pill">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${escapeHtml(w.displayType)}</td>
      </tr>`).join('');
  }

  renderWeeklySchedule();

});