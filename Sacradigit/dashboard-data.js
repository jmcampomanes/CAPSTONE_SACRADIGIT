/* ============================================
   SacraDigit Admin — Dashboard Live Data (AWS Amplify)
   Separate from dashboard.js (shared shell logic
   used on every admin page). This file only runs
   on dashboard.html and populates the stat cards,
   schedule list, pending requests, and records table.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  function toLocalISODate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todayISO = toLocalISODate();

  // Recurring weekly pattern — mirrors the "Regular Weekly Mass Schedule"
  // template on masses.html. Not stored in the database; used only to
  // fill in today's schedule when no real Mass record exists yet.
  const weeklySchedule = [
    { day: 'Monday',    times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Tuesday',   times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Wednesday', times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Thursday',  times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Friday',    times: ['6:00 AM', '7:00 AM'],            type: 'Daily Mass' },
    { day: 'Saturday',  times: ['7:00 AM', '5:30 PM'],            type: 'Anticipated Mass' },
    { day: 'Sunday',    times: ['6:00 AM', '8:00 AM', '10:00 AM', '5:00 PM'], type: 'Sunday Mass' },
  ];

  function parseTimeToMinutes(time12) {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time12 || '').trim());
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  const todaysDayName = new Date(todayISO + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const todaysTemplate = weeklySchedule.find(w => w.day === todaysDayName);
  const recurringToday = todaysTemplate
    ? todaysTemplate.times.map(t => ({ time: t, title: todaysTemplate.type, isRecurring: true, isSpecial: false }))
    : [];

  function formatShortDate(input) {
    if (!input) return '—';
    const d = new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const statusBadge = { digitized: 'badge-green', processing: 'badge-amber', queued: 'badge-gray' };
  const statusLabel = { digitized: 'Digitized', processing: 'Processing', queued: 'Queued' };

  /* --- Today's Masses --- */
  const scheduleList = document.getElementById('todays-schedule-list');
  let latestRealMasses = [];

  function renderTodaysSchedule() {
    const nowMinutes = (() => {
      const n = new Date();
      return n.getHours() * 60 + n.getMinutes();
    })();

    const combinedAll = recurringToday.concat(latestRealMasses)
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));

    // Only show masses that haven't happened yet today.
    const upcoming = combinedAll.filter(m => parseTimeToMinutes(m.time) >= nowMinutes);

    const special = latestRealMasses.filter(m => m.isSpecial).length;
    const regular = combinedAll.length - special;

    document.getElementById('stat-todays-masses').textContent = combinedAll.length;
    document.getElementById('stat-todays-masses-sub').textContent = `${regular} regular · ${special} special`;

    scheduleList.innerHTML = upcoming.length === 0
      ? `<li class="list-row text-sm text-gray-400">No more masses today.</li>`
      : upcoming.map(m => `
          <li class="list-row">
            <span class="list-time">${m.time}</span>
            <span class="list-name">${m.title || m.type}${m.isRecurring ? ' <span class="text-xs text-gray-400">(Recurring)</span>' : ''}</span>
            <a href="masses.html" class="list-action">Details ›</a>
          </li>`).join('');
  }

  client.models.Mass.observeQuery({
    filter: { date: { eq: todayISO } },
  }).subscribe({
    next: ({ items }) => {
      latestRealMasses = items.map(m => ({ ...m, isRecurring: false }));
      renderTodaysSchedule();
    },
    error: (err) => {
      console.error('Failed to load masses:', err);
      scheduleList.innerHTML = `<li class="list-row text-sm text-red-500">Couldn't load schedule.</li>`;
    },
  });

  // Re-check every minute so a mass drops off the list right after its
  // time passes, even if nothing in the database changes.
  setInterval(renderTodaysSchedule, 60 * 1000);

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