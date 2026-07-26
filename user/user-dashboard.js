/* ============================================
   SacraDigit — User Dashboard Scripts
   (user-dashboard.js)
   Runs after user-shell.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  const TODAY_ISO = '2026-06-19';

  /* ------------------------------------------
     0. GREETING — personalized first name
  ------------------------------------------ */
  const greetingName = document.getElementById('greeting-name');
  if (greetingName) greetingName.textContent = 'Maria';


  /* ------------------------------------------
     1. QUICK ACTION CARDS
  ------------------------------------------ */
  const quickActions = [
    {
      label: 'Request Certificate',
      sub: 'Baptismal, Marriage, etc.',
      href: 'user-request-certificate.html',
      iconBg: 'rgba(139,143,199,0.16)',
      iconColor: '#5b5fa8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
    },
    {
      label: 'Submit Intention',
      sub: 'Mass offering & prayer',
      href: 'user-mass-intentions.html',
      iconBg: 'rgba(201,168,76,0.16)',
      iconColor: '#b5943e',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
    },
    {
      label: 'Book a Facility',
      sub: 'Hall, chapel, or room',
      href: 'user-facility-booking.html',
      iconBg: 'rgba(30,42,74,0.08)',
      iconColor: '#1e2a4a',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
    },
    {
      label: 'Make a Donation',
      sub: 'Support the parish',
      href: 'user-donations.html',
      iconBg: 'rgba(21,128,61,0.12)',
      iconColor: '#15803d',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    },
  ];

  const qGrid = document.getElementById('quick-actions-grid');
  if (qGrid) {
    qGrid.innerHTML = quickActions.map(a => `
      <a href="${a.href}" class="quick-action-card">
        <div class="quick-action-icon" style="background-color:${a.iconBg};color:${a.iconColor};">
          ${a.icon}
        </div>
        <div>
          <p class="quick-action-label">${a.label}</p>
          <p class="quick-action-sub">${a.sub}</p>
        </div>
      </a>
    `).join('');
  }


  /* ------------------------------------------
     2. TODAY'S MASS SCHEDULE
  ------------------------------------------ */
  const todaysMasses = [
    { time: '06:00 AM', type: 'Daily Mass',       note: '' },
    { time: '07:00 AM', type: 'Daily Mass',       note: 'For the souls in purgatory' },
    { time: '05:30 PM', type: 'Anticipated Mass', note: '' },
  ];

  const massesList = document.getElementById('todays-masses');
  if (massesList) {
    massesList.innerHTML = todaysMasses.map(m => `
      <li>
        <div class="mass-row">
          <span class="mass-time">${m.time}</span>
          <div class="flex-1 min-w-0">
            <p class="mass-type">${m.type}</p>
            ${m.note ? `<p class="mass-note">${m.note}</p>` : ''}
          </div>
        </div>
      </li>
    `).join('');
  }


  /* ------------------------------------------
     3. UPCOMING SPECIAL MASSES
  ------------------------------------------ */
  const specialMasses = [
    { name: 'Feast of the Sacred Heart of Jesus', date: '2026-06-21' },
    { name: 'Our Lady of Fatima Novena — Day 1',   date: '2026-06-27' },
    { name: 'Solemnity of Sts. Peter and Paul',    date: '2026-06-29' },
    { name: 'First Friday Mass',                    date: '2026-07-03' },
  ];

  function formatLongDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  const specialList = document.getElementById('special-masses');
  if (specialList) {
    specialList.innerHTML = specialMasses.map(s => `
      <li>
        <div class="special-mass-row">
          <div class="special-mass-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
          </div>
          <div class="special-mass-info">
            <p class="special-mass-name">${s.name}</p>
            <p class="special-mass-date">${formatLongDate(s.date)}</p>
          </div>
        </div>
      </li>
    `).join('');
  }


  /* ------------------------------------------
     4. RECENT ANNOUNCEMENTS (mini cards)
  ------------------------------------------ */
  const announcements = [
    {
      title: 'Parish Fiesta Schedule — June 2026',
      excerpt: 'Join us in celebrating Our Lady of Fatima Parish Fiesta this June! Mass schedules, procession routes, and activity highlights are now available.',
      date: '2026-06-17',
      audience: 'All Parishioners',
    },
    {
      title: 'Online Giving Now Available',
      excerpt: 'You can now give your Sunday offering, mass intentions, and other contributions online through SacraDigit.',
      date: '2026-06-14',
      audience: 'All Parishioners',
    },
    {
      title: 'Youth Ministry Summer Retreat Sign-ups',
      excerpt: 'Registration is now open for the Youth Ministry Summer Retreat this July. Slots are limited.',
      date: '2026-06-10',
      audience: 'Youth Ministry',
    },
  ];

  function formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const annGrid = document.getElementById('announcements-grid');
  if (annGrid) {
    annGrid.innerHTML = announcements.map(a => `
      <div class="user-ann-card">
        <p class="user-ann-title">${a.title}</p>
        <p class="user-ann-excerpt">${a.excerpt}</p>
        <div class="user-ann-meta">
          <span class="user-ann-date">${formatShortDate(a.date)}</span>
          <span class="user-ann-audience">${a.audience}</span>
        </div>
      </div>
    `).join('');
  }


  /* ------------------------------------------
     5. MY RECENT REQUESTS (status at a glance)
  ------------------------------------------ */
  const myRequests = [
    { type: 'Baptismal Certificate',    submitted: '2026-06-15', status: 'Approved' },
    { type: 'Confirmation Certificate', submitted: '2026-06-10', status: 'Pending' },
  ];

  const badgeClass = {
    Approved: 'badge-green',
    Pending:  'badge-amber',
    Rejected: 'badge-red',
  };

  const reqTbody = document.getElementById('my-requests-tbody');
  if (reqTbody) {
    if (myRequests.length === 0) {
      reqTbody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-400 text-sm py-8">No requests yet.</td></tr>`;
    } else {
      reqTbody.innerHTML = myRequests.map(r => `
        <tr>
          <td class="font-medium text-gray-900">${r.type}</td>
          <td>${formatShortDate(r.submitted)}</td>
          <td><span class="badge ${badgeClass[r.status] || 'badge-gray'}">${r.status}</span></td>
        </tr>
      `).join('');
    }
  }

});