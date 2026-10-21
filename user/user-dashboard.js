/* ============================================
   SacraDigit — User Dashboard Scripts (AWS Amplify)
   Runs after user-shell.js.
   No parishioner login exists yet, so "My Recent
   Requests" shows all CertificateRequest records
   community-wide rather than filtered to one person.
   ============================================ */

import { client } from '../amplify-init.js';
import { getUrl } from 'aws-amplify/storage';
import { currentUser } from '../auth.js';
import { mergeWeeklySchedule, recurringMassesForDate, timeToMinutes } from '../weekly-mass-schedule.js';
import { watchLivestream } from '../livestream-status.js';
import { mountBadgeStrip } from './faith-journey-widgets.js';
import { mountCheckInCard } from './checkin-card.js';
import { openCheckInScanner } from './checkin-scanner.js';
import { checkInReady } from '../mass-checkin.js';

document.addEventListener('DOMContentLoaded', () => {
  mountCheckInCard(document.getElementById('checkin-card'));

  mountBadgeStrip(document.getElementById('fj-badge-strip'));

  const todayISO = new Date().toISOString().slice(0, 10);

  /* --- Watch Live banner ---
     Appears the moment the media team clicks "Go Live" on
     Sacramedia/livestream.html, and hides again when they end it. */
  const watchLiveBanner = document.getElementById('watch-live-banner');
  const watchLiveSub = document.getElementById('watch-live-sub');
  if (watchLiveBanner) {
    watchLivestream(client, (live) => {
      const show = live.isLive && /^https?:\/\//i.test(live.url);
      watchLiveBanner.classList.toggle('hidden', !show);
      if (show) {
        watchLiveBanner.href = live.url;
        watchLiveSub.textContent = `Join us online on ${live.platform || 'our page'}`;
      }
    });
  }
  // "Welcome back, <first name>" — from the signed-in account (cached by auth.js,
  // then refreshed from Cognito when the sacradigit:user event fires).
  const greetingName = document.getElementById('greeting-name');
  const paintGreeting = (u) => {
    if (!greetingName || !u) return;
    greetingName.textContent = u.firstName || (u.name || '').split(' ')[0] || 'Parishioner';
  };
  paintGreeting(currentUser());
  document.addEventListener('sacradigit:user', (e) => paintGreeting(e.detail));

  const quickActions = [
    // First: opens the camera to scan the church screen's QR code
    // (checkin-scanner.js). Only once the parish has check-in set up.
    ...(checkInReady() ? [{ label: 'Check in at Mass', sub: 'Scan the QR code at church', action: 'checkin',
      iconBg: 'rgba(29,78,216,0.12)', iconColor: '#1d4ed8',
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3.5" stroke-width="1.8"/></svg>` }] : []),
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
    // Five cards with Check in: it takes a full row on phones, then 3 / 5 across.
    if (quickActions.length === 5) qGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3';
    qGrid.innerHTML = quickActions.map(a => {
      const inner = `
        <div class="quick-action-head">
          <div class="quick-action-icon" style="background-color:${a.iconBg};color:${a.iconColor};">${a.icon}</div>
          <p class="quick-action-label">${a.label}</p>
        </div>
        <p class="quick-action-sub">${a.sub}</p>`;
      return a.action
        ? `<button type="button" class="quick-action-card quick-action-btn col-span-2 sm:col-span-1" data-action="${a.action}">${inner}</button>`
        : `<a href="${a.href}" class="quick-action-card">${inner}</a>`;
    }).join('');
    qGrid.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action="checkin"]')) return;
      openCheckInScanner({ onCheckedIn: () => window.dispatchEvent(new CustomEvent('sacradigit:checked-in')) });
    });
  }

  function formatShortDate(input) {
    if (!input) return '';
    const d = input.length === 10 ? new Date(input + 'T00:00:00') : new Date(input);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* --- Today's Mass Schedule ---
     Combines individually-scheduled Mass records for today with the
     recurring weekly pattern for today's day of the week (see
     weekly-mass-schedule.js), so parishioners see the masses that
     actually happen today even on a day nobody specifically scheduled
     one as its own Mass record.

     Only shows masses that aren't done yet — a mass drops off an hour
     after its start time (masses run about an hour), re-checked every
     minute so it disappears live without a reload. */
  const massesList = document.getElementById('todays-masses');
  if (massesList) {
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

    // When today is done, point to the next Mass in the weekly pattern
    // instead of ending on "No more masses today."
    function nextMassText() {
      for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const [first] = recurringMassesForDate(weeklySchedule, iso)
          .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        if (first) {
          const day = i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long' });
          return `<p class="next-mass-when">Next Mass: ${day}, ${first.time}</p>
                  <a href="user-mass-schedule.html" class="panel-link">See the full schedule →</a>`;
        }
      }
      return '<a href="user-mass-schedule.html" class="panel-link">See the full schedule →</a>';
    }

    function renderTodaysMasses() {
      const sorted = [
        ...todaysMassRecords,
        ...recurringMassesForDate(weeklySchedule, todayISO),
      ].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

      const upcoming = sorted.filter(m => !isMassDone(m));

      massesList.innerHTML = upcoming.length === 0
        ? `<li class="next-mass-empty">
             <p class="next-mass-note">${sorted.length === 0 ? 'No Masses scheduled today' : 'No more Masses today'}</p>
             ${nextMassText()}
           </li>`
        : upcoming.map(m => `
            <li><div class="mass-row">
              <span class="mass-time">${m.time}</span>
              <div class="flex-1 min-w-0">
                <p class="mass-type">${m.title || m.type}</p>
                ${m.note ? `<p class="mass-note">${m.note}</p>` : ''}
              </div>
            </div></li>`).join('');
    }

    client.models.Mass.observeQuery({ filter: { date: { eq: todayISO } } }).subscribe({
      next: ({ items }) => { todaysMassRecords = items; renderTodaysMasses(); },
      error: (err) => { console.error(err); massesList.innerHTML = `<li class="text-sm text-red-500 py-4">Couldn't load schedule.</li>`; },
    });

    // Guarded the same way as Sacradigit/masses.js: client.models.WeeklyMassSchedule
    // is undefined until the WeeklyMassSchedule model is deployed to this backend.
    if (client.models.WeeklyMassSchedule) {
      client.models.WeeklyMassSchedule.observeQuery().subscribe({
        next: ({ items }) => { weeklySchedule = mergeWeeklySchedule(items); renderTodaysMasses(); },
        error: (err) => console.error('Failed to load weekly mass schedule:', err),
      });
    } else {
      console.warn('WeeklyMassSchedule model not found on this backend yet — Today\'s Mass Schedule will only show individually-scheduled masses.');
    }

    // Re-render every minute so a mass drops off the list right after
    // its hour is up, even if nothing in the database changes.
    setInterval(renderTodaysMasses, 60 * 1000);
  }

  /* --- Recent Announcements ---
     Each card shows the announcement's photo (or video) when it has one.
     Media lives in a private Storage bucket — the record only holds the S3
     path, which getUrl() turns into a temporary signed URL (same as the
     Announcements page). Cards open the full announcement there. */
  const annGrid = document.getElementById('announcements-grid');
  if (annGrid) {
    const meta = (a) => { try { const m = JSON.parse(a.media || '{}'); return Array.isArray(m) ? { items: m } : m; } catch { return {}; } };
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
    const CAMERA_ICON = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3.5" stroke-width="2"/></svg>';

    const urlCache = new Map(); // S3 path -> { url, expiresAt } (signed URLs last an hour)
    async function mediaUrl(path) {
      if (!path) return '';
      if (/^(https?:|data:|blob:)/.test(path)) return path;
      const hit = urlCache.get(path);
      if (hit && hit.expiresAt > Date.now()) return hit.url;
      try {
        const { url } = await getUrl({ path, options: { expiresIn: 3600 } });
        urlCache.set(path, { url: url.toString(), expiresAt: Date.now() + 55 * 60 * 1000 });
        return url.toString();
      } catch (err) {
        console.error(`Couldn't load announcement media "${path}":`, err);
        return '';
      }
    }

    // A photo is the best cover; fall back to a video if that's all there is.
    const coverItem = (items = []) => items.find(m => m.type !== 'video') || items[0] || null;

    let renderToken = 0;
    client.models.Announcement.observeQuery({ filter: { published: { eq: true } } }).subscribe({
      next: async ({ items }) => {
        const myToken = ++renderToken;
        const today = new Date().toLocaleDateString('en-CA');
        // Only what's live today (not scheduled for later, not past its End Date)
        const sorted = items
          .filter(a => { const m = meta(a); return (!m.startDate || m.startDate <= today) && (!m.endDate || m.endDate >= today); })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);

        const covers = await Promise.all(sorted.map(async (a) => {
          const item = coverItem(meta(a).items);
          const url = item ? await mediaUrl(item.url) : '';
          return url ? { ...item, url } : null;
        }));
        if (myToken !== renderToken) return; // a newer update arrived while URLs were loading

        annGrid.innerHTML = sorted.length === 0
          ? '<p class="text-sm text-gray-400 px-1 py-4">No announcements right now.</p>'
          : sorted.map((a, i) => {
            const m = meta(a);
            const cover = covers[i];
            const count = (m.items || []).length;
            return `
          <a class="user-ann-card${cover ? ' has-cover' : ''}" href="user-announcements.html?id=${encodeURIComponent(a.id)}">
            ${cover ? `
            <div class="user-ann-cover">
              ${cover.type === 'video'
                ? `<video src="${cover.url}" muted playsinline preload="metadata"></video>`
                : `<img src="${cover.url}" alt="${esc(a.title)}" loading="lazy" />`}
              ${count > 1 ? `<span class="user-ann-media-count">${CAMERA_ICON}${count}</span>` : ''}
            </div>` : ''}
            <div class="user-ann-body">
              <p class="user-ann-title">${m.kind === 'post' ? '<span class="user-ann-kind">Update</span> ' : ''}${esc(a.title)}</p>
              <p class="user-ann-excerpt">${esc(a.body)}</p>
              <div class="user-ann-meta">
                <span class="user-ann-date">${formatShortDate(a.createdAt)}</span>
                <span class="user-ann-audience">${esc(a.audience || 'All Parishioners')}</span>
              </div>
            </div>
          </a>`;
          }).join('');
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
          ? `<p class="text-center text-gray-400 text-sm py-8">No requests yet.</p>`
          : sorted.map(r => {
              const key = (r.status || '').toLowerCase();
              const label = r.status ? r.status[0].toUpperCase() + r.status.slice(1) : 'Pending';
              return `<div class="request-row">
                <div class="request-left">
                  <span class="request-name">${r.certificateType}</span>
                  <span class="request-date">${formatShortDate(r.createdAt)}</span>
                </div>
                <div class="request-right"><span class="badge ${badgeClass[key] || 'badge-gray'}">${label}</span></div>
              </div>`;
            }).join('');
      },
      error: (err) => { console.error(err); reqTbody.innerHTML = `<p class="text-center text-red-500 text-sm py-8">Couldn't load requests.</p>`; },
    });
  }

});