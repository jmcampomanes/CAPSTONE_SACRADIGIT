/* ============================================
   SacraDigit Admin — Masses (Special Masses) Scripts (AWS Amplify)
   Backed by the Mass model. The Regular Weekly Mass
   Schedule table is backed by the WeeklyMassSchedule
   model (one row per day of the week) — see
   weekly-mass-schedule.js for the shared merge logic
   with the parishioner-facing page.

   Masses can't overlap: each one is treated as lasting
   MASS_LENGTH_MINUTES, so two Masses on the same date
   (scheduled or from the weekly pattern) must start at
   least that far apart. The Schedule and Edit Weekly
   modals check this as soon as a date/time is picked.
   ============================================ */

import { client } from '../amplify-init.js';
import { printReport, tableHtml, esc } from '../print-report.js';
import { massTypeInfo, massTypeBadgeHtml, massTypeLegendHtml } from '../mass-types.js';
import { mergeWeeklySchedule, recurringMassesForDate } from '../weekly-mass-schedule.js';
import { checkInReady } from '../mass-checkin.js';
import { isoDate } from '../badges.js';
import { initCheckInDisplay } from './mass-checkin-display.js';
import { createTimePicker } from '../time-picker.js';
import { showToast } from './admin-ui.js';

document.addEventListener('DOMContentLoaded', () => {

  // Mass check-in (QR) — see mass-checkin-display.js. showToast is a
  // function declaration further down, so it's available here.
  const checkInDisplay = initCheckInDisplay({ showToast });
  let openCheckIns = []; // MassCheckInSession rows that are open right now
  // Subscribed after the rest of this setup has run (queueMicrotask), since
  // the first update re-renders Date's Schedule, which needs the page ready.
  if (checkInReady()) queueMicrotask(() => {
    client.models.MassCheckInSession.observeQuery({ filter: { status: { eq: 'open' } } }).subscribe({
      next: ({ items }) => {
        const now = new Date().toISOString();
        openCheckIns = items.filter(s => s.closesAt > now);
        renderDateSchedule();
      },
      error: (err) => console.error('Failed to load check-in sessions:', err),
    });
  });

  // Local date — toISOString() is UTC, which in the Philippines (UTC+8)
  // is still "yesterday" before 8 AM.
  const todayISO = isoDate(new Date());

  const massTypeLegendEl = document.getElementById('mass-type-legend');
  if (massTypeLegendEl) massTypeLegendEl.innerHTML = massTypeLegendHtml();

  let allMasses = []; // kept in sync via observeQuery, each has .id
  let currentDateMasses = []; // sorted masses for the currently selected date

  let weeklyLive = []; // raw WeeklyMassSchedule rows, kept in sync via observeQuery
  let weeklySchedule = mergeWeeklySchedule([]); // merged view (live rows + defaults), see weekly-mass-schedule.js

  const datePicker          = document.getElementById('date-picker');
  const scheduleDateLabel     = document.getElementById('schedule-date-label');
  const dateScheduleList      = document.getElementById('date-schedule-list');
  const dateScheduleEmpty     = document.getElementById('date-schedule-empty');
  const specialMassesList      = document.getElementById('special-masses-list');
  const weeklyTbody            = document.getElementById('weekly-tbody');

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

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* --- Overlap rules --- */
  const MASS_LENGTH_MINUTES = 60; // a Mass is treated as taking an hour

  // The Masses individually scheduled on a date (real Mass records).
  function massesOnDate(iso) {
    return allMasses.filter(m => m.date === iso);
  }

  // The regular weekly Masses still happening on a date — the ones a
  // scheduled Mass has replaced are already left out.
  function regularMassesOnDate(iso) {
    return recurringMassesForDate(weeklySchedule, iso, allMasses);
  }

  // The Masses in `list` that would overlap one starting at `minutes`.
  function clashesWith(list, minutes) {
    return list.filter(m => m.time && Math.abs(to24h(m.time) - minutes) < MASS_LENGTH_MINUTES);
  }

  const massName = (m) => m.title || massTypeInfo(m.type).label;
  const weekdayKey = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();



  /* --- Live data --- */
  client.models.Mass.observeQuery().subscribe({
    next: ({ items }) => {
      allMasses = items;
      renderDateSchedule();
      renderSpecialMasses();
      renderStats();
      if (showingCalendar) renderCalendar();
      // Keep an open Day Plan modal in sync with live updates.
      if (selectedDateIso && !dayPlanModal.classList.contains('hidden')) openDayPlanModal(selectedDateIso);
    },
    error: (err) => {
      console.error('Failed to load masses:', err);
      dateScheduleList.innerHTML = `<li class="text-sm text-red-500 py-4">Couldn't load masses.</li>`;
    },
  });

  // Guarded: if the WeeklyMassSchedule model hasn't been deployed to this
  // backend yet, client.models.WeeklyMassSchedule is undefined — without
  // this guard that throws here and aborts the rest of this script (stats,
  // modals, everything below never runs). Until it's deployed, the table
  // just keeps showing its hardcoded defaults and Edit saves will fail
  // with a clear toast instead of the whole page breaking silently.
  if (client.models.WeeklyMassSchedule) {
    client.models.WeeklyMassSchedule.observeQuery().subscribe({
      next: ({ items }) => {
        weeklyLive = items;
        weeklySchedule = mergeWeeklySchedule(weeklyLive);
        renderWeeklySchedule();
        renderDateSchedule(); // Date's Schedule includes the recurring pattern too — refresh it when that pattern changes
        if (showingCalendar) renderCalendar();
      },
      error: (err) => {
        console.error('Failed to load weekly mass schedule:', err);
      },
    });
  } else {
    console.warn('WeeklyMassSchedule model not found on this backend yet — showing default weekly schedule only. Deploy the updated amplify/data/resource.ts to enable live editing.');
  }


  /* --- Date's Schedule --- */
  function renderDateSchedule() {
    const iso = datePicker.value;
    // Individually-scheduled Mass records for this exact date, plus the
    // recurring weekly pattern for whatever day of the week this date
    // falls on (e.g. every Monday's 6:00 AM / 7:00 AM Daily Mass) — so
    // "today" shows the masses that actually happen today even if no
    // one ever specifically scheduled them via "Schedule Mass".
    const masses = [
      ...allMasses.filter(m => m.date === iso),
      ...regularMassesOnDate(iso),
    ];

    scheduleDateLabel.textContent = formatLongDate(iso);
    dateScheduleList.innerHTML = '';

    if (masses.length === 0) {
      currentDateMasses = [];
      dateScheduleEmpty.classList.remove('hidden');
      return;
    }
    dateScheduleEmpty.classList.add('hidden');

    currentDateMasses = masses.slice().sort((a, b) => to24h(a.time) - to24h(b.time));

    // Check-in is offered for today's Masses (local date, not UTC).
    const isToday = iso === isoDate(new Date());

    currentDateMasses.forEach((m, idx) => {
      const overlaps = clashesWith(currentDateMasses.filter(x => x !== m), to24h(m.time));
      const open = openCheckIns.find(s => s.massDate === m.date && s.massTime === m.time) ||
        openCheckIns.find(s => s.massDate === iso && s.massTime === m.time);
      const checkInBtn = !isToday ? '' : open
        ? `<button type="button" class="schedule-checkin-btn is-open" data-index="${idx}" data-session="${open.id}">● Check-in open</button>`
        : `<button type="button" class="schedule-checkin-btn" data-index="${idx}">Start Check-in</button>`;
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="schedule-row">
          <span class="schedule-time">${escapeHtml(m.time)}</span>
          <div class="schedule-info">
            <p class="schedule-type">${escapeHtml(m.title || m.type)} ${massTypeBadgeHtml(m.type)}</p>
            ${m.note && m.title !== m.note ? `<p class="schedule-note">${escapeHtml(m.note)}</p>` : ''}
            ${overlaps.length ? `<span class="schedule-overlap" title="Masses need at least 1 hour between start times">Overlaps ${escapeHtml(overlaps.map(o => o.time).join(', '))}</span>` : ''}
          </div>
          <div class="schedule-actions act-row">
            ${checkInBtn}
            <button type="button" class="act-btn schedule-details-btn" data-index="${idx}">View</button>
          </div>
        </div>
      `;
      dateScheduleList.appendChild(li);
    });
  }

  datePicker.addEventListener('change', renderDateSchedule);

  dateScheduleList.addEventListener('click', async (e) => {
    const ciBtn = e.target.closest('.schedule-checkin-btn');
    if (ciBtn) {
      const m = currentDateMasses[parseInt(ciBtn.dataset.index, 10)];
      if (!m) return;
      const open = ciBtn.dataset.session && openCheckIns.find(s => s.id === ciBtn.dataset.session);
      if (open) { await checkInDisplay.resume(open); return; } // reopen on any device, any time
      ciBtn.disabled = true;
      await checkInDisplay.start({
        id: m.id,
        date: m.date || datePicker.value,
        time: m.time,
        title: m.title || massTypeInfo(m.type)?.label || 'Holy Mass',
      });
      ciBtn.disabled = false;
      return;
    }
    const btn = e.target.closest('.schedule-details-btn');
    if (!btn) return;
    openMassDetailsModal(parseInt(btn.dataset.index, 10));
  });


  /* --- Upcoming Special Masses --- */
  function renderSpecialMasses() {
    const today = new Date(todayISO + 'T00:00:00');

    const upcoming = allMasses
      .filter(m => m.isSpecial && new Date(m.date + 'T00:00:00') >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    specialMassesList.innerHTML = upcoming.map(m => `
      <li>
        <div class="special-row">
          <div class="special-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
          </div>
          <div class="special-info">
            <p class="special-name">${escapeHtml(m.title || m.note)}</p>
            <p class="special-date">${formatLongDate(m.date)}</p>
          </div>
        </div>
      </li>
    `).join('');
  }


  /* --- Stat cards (this week's totals) --- */
  const statMassesWeekEl  = document.getElementById('stat-masses-week');
  const statSpecialWeekEl = document.getElementById('stat-special-week');

  function renderStats() {
    const weekStart = new Date(todayISO + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndISO = isoDate(weekEnd);

    const thisWeek = allMasses.filter(m => m.date >= todayISO && m.date < weekEndISO);

    statMassesWeekEl.textContent = thisWeek.length;
    statSpecialWeekEl.textContent = thisWeek.filter(m => m.isSpecial === true).length;
  }

  const statSpecialCard = statSpecialWeekEl.closest('.stat-card');
  statSpecialCard.classList.add('stat-card-clickable');
  statSpecialCard.setAttribute('role', 'button');
  statSpecialCard.setAttribute('tabindex', '0');
  statSpecialCard.addEventListener('click', () => {
    window.location.href = 'special-schedules.html';
  });
  statSpecialCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = 'special-schedules.html';
    }
  });


  /* --- Regular Weekly Mass Schedule (backed by WeeklyMassSchedule) --- */
  function renderWeeklySchedule() {
    weeklyTbody.innerHTML = weeklySchedule.map((w, idx) => `
      <tr>
        <td class="day-cell">${escapeHtml(w.dayLabel)}</td>
        <td>${w.times.map(t => `<span class="time-pill">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${escapeHtml(w.displayType)}</td>
        <td class="text-right"><button type="button" class="act-btn row-action head-admin-only" data-day-index="${idx}">Edit</button></td>
      </tr>
    `).join('');
  }

  weeklyTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-action');
    if (btn) openWeeklyEditModal(parseInt(btn.dataset.dayIndex, 10));
  });

  renderWeeklySchedule();


  /* ------------------------------------------
     CALENDAR VIEW
     Every Mass record is pinned to its own
     confirmed date/time — regular masses and
     special masses (isSpecial) are styled
     differently so admins can spot feast days
     and novenas at a glance.
  ------------------------------------------ */
  let calendarDate = new Date(todayISO + 'T00:00:00');
  let selectedDateIso = null;

  const calMonthLabel = document.getElementById('cal-month-label');
  const calGrid          = document.getElementById('calendar-grid');

  const dayPlanModal = document.getElementById('day-plan-modal');
  const dayPlanTitle   = document.getElementById('day-plan-title');
  const dayPlanList      = document.getElementById('day-plan-list');
  const dayPlanEmpty       = document.getElementById('day-plan-empty');

  function isoFromParts(y, m, d) {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  // Every Mass on a date for the calendar: the ones scheduled for that date
  // plus the regular weekly Masses they haven't replaced, by time.
  function calendarItemsOn(iso) {
    return [...massesOnDate(iso), ...regularMassesOnDate(iso)]
      .map(m => ({ ...m, title: m.title || m.type, isSpecial: !!m.isSpecial }))
      .sort((a, b) => to24h(a.time) - to24h(b.time));
  }

  function renderCalendar() {
    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    calMonthLabel.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cellsHtml = '';
    for (let i = 0; i < startWeekday; i++) cellsHtml += `<div class="calendar-cell empty"></div>`;

    const MAX_VISIBLE = 2;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(year, month, day);
      const dayItems = calendarItemsOn(iso);
      const isToday = iso === todayISO;
      const isSelected = iso === selectedDateIso;

      const visible = dayItems.slice(0, MAX_VISIBLE);
      const remaining = dayItems.length - visible.length;

      // Colored per Mass type (not just a binary special/regular flag)
      // so every mass on the calendar is visually distinguishable, not
      // only the special ones.
      const itemsHtml = visible.map(item => {
        const info = massTypeInfo(item.type);
        return `
        <div class="calendar-cell-booking" style="background-color:${info.bg};color:${info.color};">
          <span class="calendar-cell-booking-time">${escapeHtml(item.time || '—')}</span>
          <span class="calendar-cell-booking-facility">${escapeHtml(item.title)}</span>
        </div>
      `;
      }).join('') + (remaining > 0 ? `<div class="calendar-cell-more">+${remaining} more</div>` : '');

      cellsHtml += `
        <div class="calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${iso}">
          <span class="calendar-date-num">${day}</span>
          <div class="calendar-cell-bookings">${itemsHtml}</div>
        </div>
      `;
    }

    calGrid.innerHTML = cellsHtml;
    calGrid.querySelectorAll('.calendar-cell:not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const iso = cell.dataset.date;
        selectedDateIso = iso;
        renderCalendar();
        openDayPlanModal(iso);
      });
    });
  }

  let dayPlanItems = [];

  function openDayPlanModal(iso) {
    const dayItems = dayPlanItems = calendarItemsOn(iso);
    const label = new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    dayPlanTitle.textContent = label;

    if (dayItems.length === 0) {
      dayPlanList.innerHTML = '';
      dayPlanList.classList.add('hidden');
      dayPlanEmpty.classList.remove('hidden');
    } else {
      dayPlanList.innerHTML = dayItems.map((item, idx) => `
        <div class="day-plan-item">
          <span class="day-plan-item-time">${escapeHtml(item.time || '—')}</span>
          <div class="day-plan-item-body">
            <p class="day-plan-item-facility">${escapeHtml(item.title)}</p>
            ${item.note && item.note !== item.title ? `<p class="day-plan-item-purpose">${escapeHtml(item.note)}</p>` : ''}
          </div>
          ${massTypeBadgeHtml(item.type)}
          ${item.isRecurring ? `<button type="button" class="act-btn head-admin-only" data-replace-index="${idx}" title="Hold a special Mass at this time on this date instead">Replace</button>` : ''}
        </div>
      `).join('');
      dayPlanList.classList.remove('hidden');
      dayPlanEmpty.classList.add('hidden');
    }

    openModal(dayPlanModal);
  }

  dayPlanList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-replace-index]');
    const m = btn && dayPlanItems[parseInt(btn.dataset.replaceIndex, 10)];
    if (!m) return;
    closeModal(dayPlanModal);
    openReplaceWithSpecial(m);
  });

  document.getElementById('cal-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });


  /* --- View toggle: list panels vs. calendar --- */
  const listViewPanel      = document.getElementById('list-view-panel');
  const calendarViewPanel  = document.getElementById('calendar-view-panel');
  const calendarToggleBtn  = document.getElementById('btn-calendar-view');
  const calendarToggleLabel = document.getElementById('calendar-toggle-label');

  let showingCalendar = false;

  calendarToggleBtn.addEventListener('click', () => {
    showingCalendar = !showingCalendar;
    calendarToggleBtn.setAttribute('aria-pressed', String(showingCalendar));
    calendarToggleLabel.textContent = showingCalendar ? 'List View' : 'Calendar View';
    listViewPanel.classList.toggle('hidden', showingCalendar);
    calendarViewPanel.classList.toggle('hidden', !showingCalendar);
    if (showingCalendar) renderCalendar();
  });


  /* --- Print --- */
  // Print: the selected day's masses, the regular weekly schedule, and the
  // upcoming special masses, on the parish letterhead (../print-report.js).
  document.getElementById('btn-print').addEventListener('click', () => {
    const iso = datePicker.value || todayISO;
    const longDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const dayRows = currentDateMasses.map(m => [
      `<b>${esc(m.time)}</b>`,
      esc(m.title || massTypeInfo(m.type).label),
      esc(massTypeInfo(m.type).label),
      esc(m.officiant || '—'),
      esc(m.note && m.note !== m.title ? m.note : ''),
    ]);
    const weeklyRows = weeklySchedule.map(w => [
      `<b>${esc(w.dayLabel)}</b>`,
      w.times.map(t => `<span class="pill">${esc(t)}</span>`).join('') || '<span class="muted">—</span>',
      esc(w.displayType),
    ]);
    const special = allMasses
      .filter(m => m.isSpecial && m.date >= todayISO)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 12)
      .map(m => [esc(longDate(m.date)), esc(m.time), esc(m.title || m.note || 'Special Mass'), esc(m.officiant || '—')]);
    const body = `
      <h2>${esc(longDate(iso))}</h2>
      ${tableHtml([{ label: 'Time', cls: 'nowrap' }, { label: 'Mass' }, { label: 'Type' }, { label: 'Officiant' }, { label: 'Intention / Note' }], dayRows, { empty: 'No masses scheduled on this date.' })}
      <h2>Regular Weekly Mass Schedule</h2>
      ${tableHtml([{ label: 'Day' }, { label: 'Time(s)' }, { label: 'Mass Type' }], weeklyRows)}
      <h2>Upcoming Special Masses</h2>
      ${tableHtml([{ label: 'Date' }, { label: 'Time', cls: 'nowrap' }, { label: 'Mass' }, { label: 'Officiant' }], special, { empty: 'No upcoming special masses.' })}`;
    printReport({ title: 'Mass Schedule', subtitle: longDate(iso), chips: [['Masses that day', dayRows.length]], body });
  });


  /* --- Schedule Mass Modal --- */
  const scheduleModal = document.getElementById('schedule-modal');
  const scheduleDateInput = document.getElementById('schedule-date');
  const scheduleConflict = document.getElementById('schedule-conflict');
  const scheduleSubmitBtn = document.getElementById('schedule-submit');
  const scheduleTimeAdd = document.getElementById('schedule-time-add');
  const scheduleTimeList = document.getElementById('schedule-time-list');
  const scheduleTime = createTimePicker(document.getElementById('schedule-time-picker'), { onChange: checkScheduleSlot });

  const scheduleQuickTimes = document.getElementById('schedule-quick-times');

  // Times added for this date — one Mass is saved per time, all at once.
  let scheduleTimes = []; // "h:mm AM/PM" strings, chronologically sorted

  /* Quick-add buttons under the time picker for the usual Mass times, so
     repeated scheduling is one tap per time. Monday–Saturday show the two
     daily times; Sunday shows every usual time. Same "07:00 AM" format the
     time picker gives. Edit these lists to change the buttons. */
  const QUICK_TIMES = {
    weekday: ['06:30 AM', '06:00 PM'],
    sunday:  ['06:00 AM', '06:30 AM', '08:00 AM', '10:00 AM', '05:00 PM', '06:00 PM'],
  };
  const quickTimesFor = (date) => !date ? [] : (new Date(date + 'T00:00:00').getDay() === 0 ? QUICK_TIMES.sunday : QUICK_TIMES.weekday);
  const sameTime = (a, b) => to24h(a) === to24h(b);

  function renderQuickTimes(date) {
    const times = quickTimesFor(date);
    scheduleQuickTimes.classList.toggle('hidden', !times.length);
    if (!times.length) { scheduleQuickTimes.innerHTML = ''; return; }
    const isSunday = times === QUICK_TIMES.sunday;
    scheduleQuickTimes.innerHTML = `<span class="quick-times-label">${isSunday ? 'Sunday times' : 'Usual times'}:</span>` + times.map((t) => {
      const added = scheduleTimes.some(s => sameTime(s, t));
      const problem = added ? '' : scheduleTimeProblem(date, t, scheduleTimes);
      const label = t.replace(/^0/, '');
      return `<button type="button" class="quick-time${added ? ' is-added' : ''}" data-quick-time="${t}" aria-pressed="${added}"
        ${problem ? `disabled title="${escapeHtml(problem)}"` : `title="${added ? `Remove ${label}` : `Add ${label}`}"`}>
        ${added ? '<span aria-hidden="true">✓</span>' : '<span aria-hidden="true">+</span>'}${label}</button>`;
    }).join('');
  }

  scheduleQuickTimes.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-time]');
    if (!btn || btn.disabled) return;
    const t = btn.dataset.quickTime;
    const i = scheduleTimes.findIndex(s => sameTime(s, t));
    if (i >= 0) scheduleTimes.splice(i, 1);
    else {
      scheduleTimes.push(t);
      scheduleTimes.sort((a, b) => to24h(a) - to24h(b));
    }
    checkScheduleSlot();
  });

  const joinTimes = (list) => list.length < 3 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;

  /* The regular weekly Masses on `date` that a new Mass at `time12` would
     replace for that date. Overlapping a regular Mass isn't a conflict —
     the new Mass takes its place on that one date. */
  function regularReplacedBy(date, time12) {
    return clashesWith(regularMassesOnDate(date), to24h(time12));
  }

  /* Why `time12` can't be booked on `date` (taken by a Mass already
     scheduled on that date, or too close to one of `others` being added
     with it), or ''. */
  function scheduleTimeProblem(date, time12, others) {
    const minutes = to24h(time12);
    const clashes = clashesWith(massesOnDate(date), minutes);
    if (clashes.length) {
      return `${time12} on ${formatShortDate(date)} is taken — it overlaps ${clashes.map(c => `the ${c.time} ${massName(c)}`).join(' and ')}. Masses need at least 1 hour between start times.`;
    }
    const near = clashesWith(others.filter(t => t !== time12).map(t => ({ time: t })), minutes);
    if (near.length) {
      return `${time12} is less than 1 hour from ${joinTimes(near.map(c => c.time))}, which you're also adding. Masses need at least 1 hour between start times.`;
    }
    return '';
  }

  function renderScheduleTimeChips(badTimes = []) {
    scheduleTimeList.innerHTML = scheduleTimes.map((t, i) => `
      <span class="name-chip${badTimes.includes(t) ? ' is-conflict' : ''}">
        ${escapeHtml(t)}
        <button type="button" class="name-chip-remove" data-remove-time="${i}" aria-label="Remove ${escapeHtml(t)}">×</button>
      </span>
    `).join('') || `<p class="text-xs text-gray-400">No times added yet.</p>`;
  }

  /* Runs whenever the date or a time changes: says straight away whether
     the added times (and the one in the picker) are free, and keeps Save
     disabled while any isn't. Returns an error message, or '' when every
     time can be booked. */
  function checkScheduleSlot() {
    const date = scheduleDateInput.value;
    const picked = scheduleTime.value();
    let problem = '';
    let pickedProblem = '';
    const badTimes = [];
    // Past dates are allowed (e.g. recording a Mass after the fact).
    if (date) {
      for (const t of scheduleTimes) {
        const p = scheduleTimeProblem(date, t, scheduleTimes);
        if (p) { badTimes.push(t); problem ||= p; }
      }
      if (picked && !scheduleTimes.includes(picked)) {
        pickedProblem = scheduleTimeProblem(date, picked, scheduleTimes);
        problem ||= pickedProblem;
      }
    }
    renderScheduleTimeChips(badTimes);
    renderQuickTimes(date);
    const pending = picked && !scheduleTimes.includes(picked) ? [picked] : [];
    const all = [...scheduleTimes, ...pending].sort((a, b) => to24h(a) - to24h(b));
    if (problem) {
      scheduleConflict.textContent = problem;
      scheduleConflict.classList.remove('hidden', 'is-ok');
    } else if (date && all.length) {
      const replaced = [...new Set(all.flatMap(t => regularReplacedBy(date, t)))];
      const free = all.filter(t => !regularReplacedBy(date, t).length);
      const parts = [];
      if (free.length) parts.push(`${joinTimes(free)} on ${formatShortDate(date)} ${free.length > 1 ? 'are' : 'is'} free.`);
      if (replaced.length) parts.push(`This will replace the regular ${joinTimes(replaced.map(r => `${r.time} ${massName(r)}`))} on ${formatShortDate(date)} only — the weekly schedule stays the same.`);
      if (date < todayISO) parts.push('(This date has already passed — it will be added as a past Mass.)');
      scheduleConflict.textContent = parts.join(' ');
      scheduleConflict.classList.remove('hidden');
      scheduleConflict.classList.add('is-ok');
    } else {
      scheduleConflict.classList.add('hidden');
    }
    scheduleTimeAdd.disabled = !!pickedProblem;
    scheduleSubmitBtn.disabled = !!problem;
    scheduleSubmitBtn.textContent = all.length > 1 ? `Save ${all.length} Masses` : 'Save Mass';
    return problem;
  }

  scheduleDateInput.addEventListener('change', checkScheduleSlot);

  scheduleTimeAdd.addEventListener('click', () => {
    const time12 = scheduleTime.value();
    if (!time12) { showToast('Pick an hour first, then press Add Time.', true); return; }
    if (scheduleTimes.includes(time12)) { scheduleTime.reset(); checkScheduleSlot(); return; }
    const date = scheduleDateInput.value;
    if (date && scheduleTimeProblem(date, time12, scheduleTimes)) { checkScheduleSlot(); return; }
    scheduleTimes.push(time12);
    scheduleTimes.sort((a, b) => to24h(a) - to24h(b));
    scheduleTime.reset();
    checkScheduleSlot();
  });

  scheduleTimeList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-time]');
    if (!btn) return;
    scheduleTimes.splice(parseInt(btn.dataset.removeTime, 10), 1);
    checkScheduleSlot();
  });

  function resetScheduleForm() {
    scheduleTimes = [];
    scheduleTime.reset();
    document.getElementById('schedule-type').value = '';
    document.getElementById('schedule-note').value = '';
    document.getElementById('schedule-special').checked = false;
  }

  document.getElementById('btn-schedule-mass').addEventListener('click', () => {
    scheduleDateInput.value = datePicker.value;
    resetScheduleForm();
    checkScheduleSlot();
    openModal(scheduleModal);
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => { const overlay = btn.closest('.modal-overlay'); if (overlay) closeModal(overlay); });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(closeModal); });

  function openModal(modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal(modal) { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }

  document.getElementById('schedule-submit').addEventListener('click', async () => {
    const date    = scheduleDateInput.value;
    const type    = document.getElementById('schedule-type').value;
    const note     = document.getElementById('schedule-note').value.trim();
    const isSpecial = document.getElementById('schedule-special').checked;

    // Last check against the latest data (another admin may have just booked it)
    const problem = checkScheduleSlot();
    if (problem) { showToast(problem, true); return; }

    // A time still sitting in the picker counts too, even without Add Time.
    const picked = scheduleTime.value();
    const times = [...new Set([...scheduleTimes, ...(picked ? [picked] : [])])].sort((a, b) => to24h(a) - to24h(b));

    if (!date || !times.length || !type) {
      showToast('Please fill in the date, at least one time, and the mass type.', true);
      return;
    }

    scheduleSubmitBtn.disabled = true;
    // One Mass record per time, all saved together.
    const results = await Promise.allSettled(times.map(async (time12) => {
      const result = await client.models.Mass.create({
        date,
        time: time12,
        type,
        // Prefer the admin's own Title/Intention text (e.g. "Sunday
        // Mass" for a plain `daily`-type entry) and only fall back to
        // the type's generic label when none was given.
        title: note || massTypeInfo(type).label,
        note: note || undefined,
        isSpecial,
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      return time12;
    }));
    scheduleSubmitBtn.disabled = false;

    const saved = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = times.filter(t => !saved.includes(t));

    if (saved.length) {
      datePicker.value = date;
      renderDateSchedule();
    }

    if (!failed.length) {
      closeModal(scheduleModal);
      showToast(`${saved.length > 1 ? `${saved.length} Masses` : 'Mass'} scheduled for ${formatShortDate(date)} at ${joinTimes(saved)}.`);
      resetScheduleForm();
      return;
    }

    // Keep only the times that didn't save, so Save can simply be pressed again.
    const firstError = results.find(r => r.status === 'rejected').reason;
    console.error('Failed to schedule mass:', firstError);
    scheduleTimes = failed;
    scheduleTime.reset();
    checkScheduleSlot();
    showToast(saved.length
      ? `Scheduled ${joinTimes(saved)}, but couldn't save ${joinTimes(failed)}. Press Save to try again.`
      : (firstError?.message || "Couldn't schedule the mass."), true);
  });


  /* --- Edit Weekly Schedule Modal (Regular Weekly Mass Schedule) --- */
  const weeklyEditModal    = document.getElementById('weekly-edit-modal');
  const weeklyEditTitle    = document.getElementById('weekly-edit-title');
  const weeklyEditConflict  = document.getElementById('weekly-edit-conflict');
  const weeklyEditTimeAdd   = document.getElementById('weekly-edit-time-add');
  const weeklyEditTimeList  = document.getElementById('weekly-edit-time-list');
  const weeklyEditType      = document.getElementById('weekly-edit-type');
  const weeklyEditLabel     = document.getElementById('weekly-edit-label');
  const weeklyEditSubmit    = document.getElementById('weekly-edit-submit');

  let editingDayIndex = null;
  let editingTimes = []; // array of "h:mm AM/PM" strings, chronologically sorted

  function renderWeeklyEditTimeChips() {
    weeklyEditTimeList.innerHTML = editingTimes.map((t, i) => `
      <span class="name-chip">
        ${escapeHtml(t)}
        <button type="button" class="name-chip-remove" data-remove-time="${i}" aria-label="Remove ${escapeHtml(t)}">×</button>
      </span>
    `).join('') || `<p class="text-xs text-gray-400">No times added yet.</p>`;
  }

  /* A new weekly time must be an hour clear of this day's other times,
     and of any Mass already scheduled on an upcoming date that falls on
     this weekday. Returns an error message, or '' when it's free. */
  function weeklyTimeProblem(time12) {
    const minutes = to24h(time12);
    const sameDay = clashesWith(editingTimes.map(t => ({ time: t })), minutes);
    if (sameDay.length) {
      return `${time12} overlaps ${sameDay.map(c => c.time).join(' and ')} already on this day. Masses need at least 1 hour between start times.`;
    }
    const w = weeklySchedule[editingDayIndex];
    const upcoming = allMasses
      .filter(m => m.date >= todayISO && w && weekdayKey(m.date) === w.dayKey)
      .filter(m => clashesWith([m], minutes).length)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming.length) {
      const first = upcoming[0];
      const more = upcoming.length > 1 ? ` (and ${upcoming.length - 1} more)` : '';
      return `${time12} overlaps the ${first.time} ${massName(first)} on ${formatShortDate(first.date)}${more}.`;
    }
    return '';
  }

  function showWeeklyProblem(message) {
    weeklyEditConflict.textContent = message;
    weeklyEditConflict.classList.toggle('hidden', !message);
  }

  const weeklyEditTime = createTimePicker(document.getElementById('weekly-edit-time-picker'), {
    onChange: () => {
      const time12 = weeklyEditTime.value();
      const problem = time12 ? weeklyTimeProblem(time12) : '';
      showWeeklyProblem(problem);
      weeklyEditTimeAdd.disabled = !!problem;
    },
  });

  function addEditingTime(time12) {
    const problem = weeklyTimeProblem(time12);
    if (problem) { showWeeklyProblem(problem); return; }
    editingTimes.push(time12);
    editingTimes.sort((a, b) => to24h(a) - to24h(b));
    renderWeeklyEditTimeChips();
  }

  weeklyEditTimeAdd.addEventListener('click', () => {
    const time12 = weeklyEditTime.value();
    if (!time12) { showWeeklyProblem('Pick an hour first.'); return; }
    addEditingTime(time12);
    if (!weeklyEditConflict.textContent || weeklyEditConflict.classList.contains('hidden')) weeklyEditTime.reset();
  });

  weeklyEditTimeList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-time]');
    if (!btn) return;
    editingTimes.splice(parseInt(btn.dataset.removeTime, 10), 1);
    renderWeeklyEditTimeChips();
  });

  function openWeeklyEditModal(idx) {
    const w = weeklySchedule[idx];
    if (!w) return;

    editingDayIndex = idx;
    editingTimes = w.times.slice();
    weeklyEditTime.reset();
    showWeeklyProblem('');
    weeklyEditTimeAdd.disabled = false;

    weeklyEditTitle.textContent = `Edit ${w.dayLabel}'s Schedule`;
    weeklyEditType.value = w.massType;
    weeklyEditLabel.value = w.label || '';
    renderWeeklyEditTimeChips();

    openModal(weeklyEditModal);
  }

  weeklyEditSubmit.addEventListener('click', async () => {
    const w = weeklySchedule[editingDayIndex];
    if (!w) return;

    if (!client.models.WeeklyMassSchedule) {
      showToast('This feature needs a backend update that hasn\'t been deployed yet — ask your developer to deploy the latest schema.', true);
      return;
    }

    if (editingTimes.length === 0) {
      showToast('Add at least one time.', true);
      return;
    }

    const massType = weeklyEditType.value;
    const label = weeklyEditLabel.value.trim();

    try {
      if (w.id) {
        const result = await client.models.WeeklyMassSchedule.update({
          id: w.id,
          times: JSON.stringify(editingTimes), // AWSJSON field — must be a JSON string
          massType,
          label: label || null,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      } else {
        const result = await client.models.WeeklyMassSchedule.create({
          dayOfWeek: w.dayKey,
          times: JSON.stringify(editingTimes),
          massType,
          label: label || null,
        });
        if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      }

      closeModal(weeklyEditModal);
      showToast(`Saved ${w.dayLabel}'s schedule.`);
    } catch (err) {
      console.error('Failed to save weekly schedule:', err);
      showToast(err.message || "Couldn't save this day's schedule.", true);
    }
  });


  /* --- Mass Details Modal --- */
  const massDetailsModal = document.getElementById('mass-details-modal');
  const massDetailsBody   = document.getElementById('mass-details-body');

  function openMassDetailsModal(idx) {
    const m = currentDateMasses[idx];
    if (!m) return;

    massDetailsBody.innerHTML = `
      <div class="so-detail-grid">
        <div>
          <p class="so-detail-label">Date</p>
          <p class="so-detail-value">${escapeHtml(formatLongDate(datePicker.value))}</p>
        </div>
        <div>
          <p class="so-detail-label">Time</p>
          <p class="so-detail-value">${escapeHtml(m.time)}</p>
        </div>
        <div>
          <p class="so-detail-label">Mass Type</p>
          <p class="so-detail-value">${massTypeBadgeHtml(m.type)}</p>
        </div>
        <div>
          <p class="so-detail-label">Special Mass</p>
          <p class="so-detail-value">${m.isSpecial ? 'Yes' : 'No'}</p>
        </div>
      </div>
      <div class="mt-3">
        <p class="so-detail-label">Intention / Note</p>
        <p class="so-detail-value">${m.note ? escapeHtml(m.note) : '—'}</p>
      </div>
      ${m.isRecurring ? `
        <div class="mt-4 head-admin-only">
          <button type="button" class="btn-lavender" id="mass-details-replace">Replace with a Special Mass</button>
          <p class="text-xs text-gray-400 mt-2">Schedules a special Mass at ${escapeHtml(m.time)} on ${escapeHtml(formatShortDate(m.date))} instead of this regular Mass. Only this date changes — the weekly schedule stays the same.</p>
        </div>` : ''}
    `;

    document.getElementById('mass-details-replace')?.addEventListener('click', () => {
      closeModal(massDetailsModal);
      openReplaceWithSpecial(m);
    });

    openModal(massDetailsModal);
  }

  // Opens Schedule Mass already filled in to take over a regular Mass's slot.
  function openReplaceWithSpecial(m) {
    resetScheduleForm();
    scheduleDateInput.value = m.date;
    scheduleTimes = [m.time];
    document.getElementById('schedule-type').value = 'special';
    document.getElementById('schedule-special').checked = true;
    checkScheduleSlot();
    openModal(scheduleModal);
    document.getElementById('schedule-note').focus();
  }



});