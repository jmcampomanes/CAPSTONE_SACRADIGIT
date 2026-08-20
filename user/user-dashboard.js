/* ============================================
   SacraDigit — User Dashboard Scripts (AWS Amplify)
   Runs after user-shell.js.
   No parishioner login exists yet, so "My Recent
   Requests" shows all CertificateRequest records
   community-wide rather than filtered to one person.
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const todayISO = new Date().toISOString().slice(0, 10);

  const greetingName = document.getElementById('greeting-name');
  if (greetingName) greetingName.textContent = 'Maria';

  const quickActions = [
    { label: 'Request Certificate', sub: 'Baptismal, Marriage, etc.', href: 'user-request-certificate.html',
      iconBg: 'rgba(139,143,199,0.16)', iconColor: '#5b5fa8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>` },
    { label: 'Submit Intention', sub: 'Mass offering & prayer', href: 'user-mass-intentions.html',
      iconBg: 'rgba(201,168,76,0.16)', iconColor: '#b5943e',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>` },
    { label: 'Book a Facility', sub: 'Hall, chapel, or room', href: 'user-facility-booking.html',
      iconBg: 'rgba(30,42,74,0.08)', iconColor: '#1e2a4a',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>` },
    { label: 'Make a Donation', sub: 'Support the parish', href: 'user-donations.html',
      iconBg: 'rgba(21,128,61,0.12)', iconColor: '#15803d',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` },
  ];

  const qGrid = document.getElementById('quick-actions-grid');
  if (qGrid) {
    qGrid.innerHTML = quickActions.map(a => `
      <a href="${a.href}" class="quick-action-card">
        <div class="quick-action-icon" style="background-color:${a.iconBg};color:${a.iconColor};">${a.icon}</div>
        <div><p class="quick-action-label">${a.label}</p><p class="quick-action-sub">${a.sub}</p></div>
      </a>`).join('');
  }

  function formatLongDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function formatShortDate(input) {
    if (!input) return '';
    const d = input.length === 10 ? new Date(input + 'T00:00:00') : new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* --- Today's Mass Schedule --- */
  const massesList = document.getElementById('todays-masses');
  if (massesList) {
    client.models.Mass.observeQuery({ filter: { date: { eq: todayISO } } }).subscribe({
      next: ({ items }) => {
        const sorted = items.slice().sort((a, b) => a.time.localeCompare(b.time));
        massesList.innerHTML = sorted.length === 0
          ? `<li class="text-sm text-gray-400 py-4">No masses scheduled today.</li>`
          : sorted.map(m => `
              <li><div class="mass-row">
                <span class="mass-time">${m.time}</span>
                <div class="flex-1 min-w-0">
                  <p class="mass-type">${m.title || m.type}</p>
                  ${m.note ? `<p class="mass-note">${m.note}</p>` : ''}
                </div>
              </div></li>`).join('');
      },
      error: (err) => { console.error(err); massesList.innerHTML = `<li class="text-sm text-red-500 py-4">Couldn't load schedule.</li>`; },
    });
  }

  /* --- Upcoming Special Masses --- */
  const specialList = document.getElementById('special-masses');
  if (specialList) {
    client.models.Mass.observeQuery({ filter: { isSpecial: { eq: true }, date: { ge: todayISO } } }).subscribe({
      next: ({ items }) => {
        const sorted = items.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
        specialList.innerHTML = sorted.length === 0
          ? `<li class="text-sm text-gray-400 py-4">No upcoming special masses.</li>`
          : sorted.map(s => `
              <li><div class="special-mass-row">
                <div class="special-mass-icon"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg></div>
                <div class="special-mass-info">
                  <p class="special-mass-name">${s.title || s.note}</p>
                  <p class="special-mass-date">${formatLongDate(s.date)}</p>
                </div>
              </div></li>`).join('');
      },
      error: (err) => console.error(err),
    });
  }

  /* --- Recent Announcements --- */
  const annGrid = document.getElementById('announcements-grid');
  if (annGrid) {
    client.models.Announcement.observeQuery({ filter: { published: { eq: true } } }).subscribe({
      next: ({ items }) => {
        const sorted = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
        annGrid.innerHTML = sorted.map(a => `
          <div class="user-ann-card">
            <p class="user-ann-title">${a.title}</p>
            <p class="user-ann-excerpt">${a.body}</p>
            <div class="user-ann-meta">
              <span class="user-ann-date">${formatShortDate(a.createdAt)}</span>
              <span class="user-ann-audience">${a.audience || 'All Parishioners'}</span>
            </div>
          </div>`).join('');
      },
      error: (err) => console.error(err),
    });
  }

  /* --- My Recent Requests (community-wide, no login yet) --- */
  const badgeClass = { approved: 'badge-green', released: 'badge-green', pending: 'badge-amber', rejected: 'badge-red' };
  const reqTbody = document.getElementById('my-requests-tbody');
  if (reqTbody) {
    client.models.CertificateRequest.observeQuery().subscribe({
      next: ({ items }) => {
        const sorted = items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        reqTbody.innerHTML = sorted.length === 0
          ? `<tr><td colspan="3" class="text-center text-gray-400 text-sm py-8">No requests yet.</td></tr>`
          : sorted.map(r => {
              const key = (r.status || '').toLowerCase();
              const label = r.status ? r.status[0].toUpperCase() + r.status.slice(1) : 'Pending';
              return `<tr>
                <td class="font-medium text-gray-900">${r.certificateType}</td>
                <td>${formatShortDate(r.createdAt)}</td>
                <td><span class="badge ${badgeClass[key] || 'badge-gray'}">${label}</span></td>
              </tr>`;
            }).join('');
      },
      error: (err) => { console.error(err); reqTbody.innerHTML = `<tr><td colspan="3" class="text-center text-red-500 text-sm py-8">Couldn't load requests.</td></tr>`; },
    });
  }

});
