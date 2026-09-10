/* ============================================
   SacraDigit Admin — Dashboard Live Data (AWS Amplify)
   Separate from dashboard.js (shared shell logic
   used on every admin page). This file only runs
   on dashboard.html and populates the stat cards,
   schedule list, pending requests, and records table.
   ============================================ */

import { client } from '../amplify-init.js';
import { mergeWeeklySchedule, recurringMassesForDate, timeToMinutes } from '../weekly-mass-schedule.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  function formatShortDate(input) {
    if (!input) return '—';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const statusBadge = { digitized: 'badge-green', processing: 'badge-amber', queued: 'badge-gray' };
  const statusLabel = { digitized: 'Digitized', processing: 'Processing', queued: 'Queued' };

  /* --- Today's Masses ---
     Combines individually-scheduled Mass records for today with the
     recurring weekly pattern for today's day of the week (see
     weekly-mass-schedule.js), so this stat/list reflects the masses
     that actually happen today even on a day nobody specifically
     scheduled one via "Schedule Mass" on the Masses page.

     The list itself only shows masses that aren't done yet — a mass
     drops off an hour after its start time (masses run about an hour),
     re-checked every minute so it disappears live without a reload.
     The stat count above it still counts the whole day, done or not. */
  const scheduleList = document.getElementById('todays-schedule-list');
  let todaysMassRecords = [];
  let weeklySchedule = mergeWeeklySchedule([]);

  const MASS_DURATION_MINUTES = 60;
  function nowMinutesLocal() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }
  function isMassDone(mass) {
    return nowMinutesLocal() >= timeToMinutes(mass.time) + MASS_DURATION_MINUTES;
  }

  function renderTodaysMasses() {
    const sorted = [
      ...todaysMassRecords,
      ...recurringMassesForDate(weeklySchedule, todayISO),
    ].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    const special = sorted.filter(m => m.isSpecial).length;
    const regular = sorted.length - special;

    document.getElementById('stat-todays-masses').textContent = sorted.length;
    document.getElementById('stat-todays-masses-sub').textContent = `${regular} regular · ${special} special`;

    const upcoming = sorted.filter(m => !isMassDone(m));

    scheduleList.innerHTML = upcoming.length === 0
      ? `<li class="list-row text-sm text-gray-400">${sorted.length === 0 ? 'No masses today.' : 'No more masses today.'}</li>`
      : upcoming.map(m => `
          <li class="list-row">
            <span class="list-time">${m.time}</span>
            <span class="list-name">${m.title || m.type}</span>
            <a href="masses.html" class="list-action">Details ›</a>
          </li>`).join('');
  }

  // Re-render every minute so a mass drops off the list right after its
  // hour is up, even if nothing in the database changes in the meantime.
  setInterval(renderTodaysMasses, 60 * 1000);

  client.models.Mass.observeQuery({
    filter: { date: { eq: todayISO } },
  }).subscribe({
    next: ({ items }) => {
      todaysMassRecords = items;
      renderTodaysMasses();
    },
    error: (err) => {
      console.error('Failed to load masses:', err);
      scheduleList.innerHTML = `<li class="list-row text-sm text-red-500">Couldn't load schedule.</li>`;
    },
  });

  // Guarded the same way as Sacradigit/masses.js: client.models.WeeklyMassSchedule
  // is undefined until the WeeklyMassSchedule model is deployed to this backend.
  if (client.models.WeeklyMassSchedule) {
    client.models.WeeklyMassSchedule.observeQuery().subscribe({
      next: ({ items }) => {
        weeklySchedule = mergeWeeklySchedule(items);
        renderTodaysMasses();
      },
      error: (err) => console.error('Failed to load weekly mass schedule:', err),
    });
  } else {
    console.warn('WeeklyMassSchedule model not found on this backend yet — Today\'s Masses will only show individually-scheduled masses.');
  }

  /* --- Pending Requests --- */
  const pendingList = document.getElementById('pending-requests-list');
  client.models.CertificateRequest.observeQuery({
    filter: { status: { eq: 'pending' } },
  }).subscribe({
    next: ({ items }) => {
      document.getElementById('stat-pending-requests').textContent = items.length;
      document.getElementById('stat-pending-requests-sub').textContent = 'Awaiting review';

      const shown = items.slice(0, 4);
      pendingList.innerHTML = shown.length === 0
        ? `<li class="list-row text-sm text-gray-400">No pending requests.</li>`
        : shown.map(r => `
            <li class="list-row">
              <span class="list-name flex-1">${r.requesterName} — ${r.certificateType}</span>
              <a href="record-requests.html" class="list-action">Details ›</a>
            </li>`).join('');
    },
    error: (err) => {
      console.error('Failed to load requests:', err);
      pendingList.innerHTML = `<li class="list-row text-sm text-red-500">Couldn't load requests.</li>`;
    },
  });

  /* --- Records Digitized + Recent Records table --- */
  client.models.ParishRecord.observeQuery().subscribe({
    next: ({ items }) => {
      const digitized = items.filter(r => r.status === 'digitized');
      document.getElementById('stat-records-digitized').textContent = digitized.length.toLocaleString();

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentCount = digitized.filter(r => r.createdAt && new Date(r.createdAt) >= weekAgo).length;
      document.getElementById('stat-records-digitized-sub').textContent = `+${recentCount} this week`;

      const recordsTbody = document.getElementById('recent-records-tbody');
      const recent = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

      recordsTbody.innerHTML = recent.length === 0
        ? `<tr><td colspan="6" class="text-center text-gray-400 text-sm py-8">No records yet.</td></tr>`
        : recent.map(r => `
            <tr>
              <td class="font-medium text-gray-900">${r.fullName}</td>
              <td>${r.type}</td>
              <td>${formatShortDate(r.createdAt)}</td>
              <td>${r.addedByName || '—'}</td>
              <td><span class="badge ${statusBadge[r.status] || 'badge-gray'}">${statusLabel[r.status] || r.status}</span></td>
              <td class="text-right"><a href="digital-archives.html" class="list-action">View ›</a></td>
            </tr>`).join('');
    },
    error: (err) => console.error('Failed to load records:', err),
  });

});