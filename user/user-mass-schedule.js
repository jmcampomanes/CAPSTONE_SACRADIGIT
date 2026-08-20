/* ============================================
   SacraDigit — User Mass Schedule Scripts (AWS Amplify)
   Runs after user-shell.js.
   Weekly schedule + liturgical season banner stay
   static/computed (no live data needed). Reminders
   stay a local, in-session Set — no backend model
   for personal reminders exists yet.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  const weeklySchedule = [
    { day: 'Monday',    times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Tuesday',   times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Wednesday', times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Thursday',  times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Friday',    times: ['6:00 AM', '7:00 AM'],                       type: 'Daily Mass' },
    { day: 'Saturday',  times: ['7:00 AM', '5:30 PM'],                       type: 'Anticipated Mass' },
    { day: 'Sunday',    times: ['6:00 AM', '8:00 AM', '10:00 AM', '5:00 PM'], type: 'Sunday Mass' },
  ];

  const reminders = new Set();
  let allMasses = [];

  const seasonDot = document.getElementById('season-dot');
  const seasonName = document.getElementById('season-name');
  const seasonWeek = document.getElementById('season-week');
  const seasonProgressFill = document.getElementById('season-progress-fill');
  const seasonProgressLabel = document.getElementById('season-progress-label');

  const datePicker = document.getElementById('date-picker');
  const btnToday = document.getElementById('btn-today');
  const scheduleDateLabel = document.getElementById('schedule-date-label');
  const dateScheduleList = document.getElementById('date-schedule-list');
  const dateScheduleEmpty = document.getElementById('date-schedule-empty');
  const specialMassesList = document.getElementById('special-masses-list');
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
      renderSpecialMasses();
    },
    error: (err) => {
      console.error('Failed to load masses:', err);
      dateScheduleList.innerHTML = `<li class="text-sm text-red-500 py-4">Couldn't load schedule.</li>`;
    },
  });

  function renderDateSchedule() {
    const iso = datePicker.value;
    const masses = allMasses.filter(m => m.date === iso);

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
            <p class="mass-type-name">${escapeHtml(m.title || m.type)}</p>
            ${m.note ? `<p class="mass-note-text">${escapeHtml(m.note)}</p>` : ''}
          </div>
          ${m.isSpecial ? '<span class="mass-special-tag">Special</span>' : ''}
          <button type="button" class="btn-reminder${isSet ? ' set' : ''}" data-key="${reminderKey}" data-type="${escapeHtml(m.title || m.type)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            ${isSet ? 'Reminder Set' : 'Set Reminder'}
          </button>
        </div>`;
      dateScheduleList.appendChild(li);
    });

    renderSeasonBanner(iso);
  }

  datePicker.addEventListener('change', renderDateSchedule);
  btnToday.addEventListener('click', () => { datePicker.value = todayISO; renderDateSchedule(); });

  dateScheduleList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reminder');
    if (!btn) return;
    const key = btn.dataset.key;
    const type = btn.dataset.type;
    if (reminders.has(key)) {
      reminders.delete(key);
      btn.classList.remove('set');
      btn.innerHTML = btn.innerHTML.replace('Reminder Set', 'Set Reminder');
      window.showToast?.(`Reminder removed for ${type}.`);
    } else {
      reminders.add(key);
      btn.classList.add('set');
      btn.innerHTML = btn.innerHTML.replace('Set Reminder', 'Reminder Set');
      window.showToast?.(`We'll remind you before ${type} starts.`);
    }
  });

  function renderSpecialMasses() {
    const today = new Date(todayISO + 'T00:00:00');
    const upcoming = allMasses
      .filter(m => m.isSpecial && new Date(m.date + 'T00:00:00') >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    specialMassesList.innerHTML = upcoming.map(s => `
      <li><div class="special-row">
        <div class="special-icon"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg></div>
        <div class="special-info">
          <p class="special-name">${escapeHtml(s.title || s.note)}</p>
          <p class="special-date-text">${formatLongDate(s.date)}</p>
        </div>
      </div></li>`).join('');
  }

  function renderWeeklySchedule() {
    weeklyTbody.innerHTML = weeklySchedule.map(w => `
      <tr>
        <td class="font-semibold text-gray-900">${escapeHtml(w.day)}</td>
        <td>${w.times.map(t => `<span class="time-pill">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${escapeHtml(w.type)}</td>
      </tr>`).join('');
  }

  renderWeeklySchedule();

});
